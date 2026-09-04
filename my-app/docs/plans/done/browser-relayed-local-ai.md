# Browser-Relayed Local AI

## Status

Approved 2026-08-07. Supersedes
[browser-relayed-local-model-inference.md](../done/browser-relayed-local-model-inference.md),
which explored generation-only relay and left embeddings open.

## Context

The application launches on Vercel with exactly two AI options an organization
can choose between:

1. **OpenAI** — the server calls OpenAI, as it does today.
2. **Local** — the user's *browser* calls a model running on the user's own
   machine (Ollama or another OpenAI-compatible server on loopback), for both
   **generation and embeddings**, with the organization free to pick which
   models.

Neither half of option 2 exists today. `self_hosted` assumes the server can
reach the model, which a Vercel function cannot do for a user's `127.0.0.1`.
Model ids and capability flags are single-deployment environment variables
(`SELF_HOSTED_AI_MODEL`, `SELF_HOSTED_AI_SUPPORTS_*`), so one deployment means
one model for everyone. And embedding coordinates are keyed on *provider mode*,
which under this design never changes for a local organization — so a user
swapping embedding models would silently empty their own document retrieval
with no re-index triggered.

The intended outcome: an administrator picks a generation model and an embedding
model; any member's browser can service inference requests for that
organization; changing the generation model is free; changing the embedding
model stages a re-index that the browser performs; OpenAI organizations are
untouched and never involve a client.

## Locked decisions

- Generation model and embedding model are both **organization-level**. Any
  member's browser may serve requests, provided it passes the connect probe for
  those exact model ids.
- A document uploaded while no browser is connected is **accepted** and sits at
  `indexing_status = 'pending'` until a client appears. Retrieval already filters
  to succeeded versions, so an unindexed document is invisible rather than wrong.
- **`company_hosted` is removed.** Two options means two provider modes.
- `document_chunks.embedding` becomes an **undimensioned pgvector column**. There
  is no ANN index on it today — only a GIN index on the tsvector
  ([schema.ts](../../../src/db/schema.ts)) — so similarity search is already a
  sequential scan and nothing is lost now. Reintroducing an ANN index later
  across heterogeneous dimensions is the deferred cost.
- Generation model and embedding model are **independent**. Only the embedding
  record feeds the vector key, so changing the generation model never
  invalidates vectors.

## Architecture

```text
OpenAI org      job -> gateway -> provider.run() inline -> validate -> persist
                (unchanged; no client, API key stays server-side)

Local org       job -> gateway -> suspending provider persists request, throws
                     -> job parked (state=queued, availableAt=lease horizon)
                     -> browser claims request, calls 127.0.0.1, POSTs result
                     -> resume route validates, stores, sets availableAt=now
                     -> handler's after-response drain resumes the job
                     -> gateway re-enters, recoverValidatedRun skips the provider
```

Two existing facts make this cheap on Vercel: `scheduleAfterResponseDrain` is
already wired into every route through
[handler.ts](../../../src/server/api/handler.ts), so the resume POST wakes the
job with no new machinery; and `background_jobs.availableAt` with `state='queued'`
([jobs/service.ts](../../../src/server/jobs/service.ts)) is already a parking
mechanism, so **no new job state is needed**.

## Phase 0 — Vector identity becomes explicit and stored

Server-only. Everything else depends on it.

A vector's identity is `(model, revision, native dimensions, instruction
profile, chunking version)`. Only `embedding_model` is stored; revision and
instruction id are computed in
[document-config.ts](../../../src/server/documents/document-config.ts) and
discarded. Invalidation is keyed on provider mode in
[embedding-migration-service.ts](../../../src/server/organizations/embedding-migration-service.ts),
which early-returns whenever the provider is unchanged — permanently true for a
local organization.

Schema ([schema.ts](../../../src/db/schema.ts)):

- `document_versions` gains `embedding_revision`, `embedding_dimensions`,
  `embedding_instruction_profile`, and `embedding_key` (a content hash of the
  tuple). `embedding_model` stays for readability.
- `organization_embedding_migrations` gains `from_embedding_key` /
  `to_embedding_key` plus the target coordinates the re-index job needs.
  `from_provider_mode` / `to_provider_mode` become nullable: retained for audit,
  no longer driving anything.

Code:

- `resolveEmbeddingConfig` returns the full tuple plus the derived key. Reuse the
  existing `contentHash` helper that backs `recoveryCompatibility` in
  [gateway.ts](../../../src/server/ai/grounding/gateway.ts) rather than adding a
  second hash.
- [retrieval.ts](../../../src/server/documents/retrieval.ts) filters on
  `embedding_key` instead of `embedding_model`, preserving the property that a
  half-finished re-index yields *missing* results rather than confident nonsense.
- `requestProviderChange` becomes `requestEmbeddingConfigChange` and compares
  keys, not provider modes. Its discipline is unchanged: active coordinates do
  not advance until the migration succeeds, and it remains the single write path.

## Phase 1 — Variable dimensions

- The `vector` custom type's `dataType` becomes `"vector"` with no dimension;
  `toDriver` / `fromDriver` unchanged.
- `adaptEmbeddings` in
  [embeddings.ts](../../../src/server/documents/embeddings.ts) **drops the
  truncation** and stores native width. Truncating is only defensible for
  Matryoshka-trained models, and which kind the user picked is no longer known.
  The zero-norm and non-finite guards in `normalizeEmbedding` stay.
- Remove the 1536 pin from [common.ts](../../../src/config/env/common.ts),
  [migrate.ts](../../../src/config/env/migrate.ts), and the throw in
  `document-config.ts`.

Cross-dimension comparison raises a Postgres error rather than returning
garbage, which is safe because the Phase 0 key filter means only same-space rows
are ever compared.

## Phase 2 — Per-org model records replace env; `company_hosted` removed

New table `organization_model_settings`, one row per organization: generation
model id, generation max context tokens, generation supports-structured-outputs,
embedding model id, embedding revision, embedding dimensions, embedding
instruction profile, probe timestamp, `updated_by`, `updated_at`.

Embedding fields are the organization's **active** coordinates and follow the
Phase 0 discipline — they advance only when a migration succeeds. Generation
fields are freely updatable.

Remove `company_hosted` from [types.ts](../../../src/server/platform/ai/types.ts),
[providers.ts](../../../src/server/platform/ai/providers.ts),
[models.ts](../../../src/server/platform/ai/models.ts),
[model-capabilities.ts](../../../src/server/platform/ai/model-capabilities.ts), the `COMPANY_AI_*`
env block, the `ai_provider_mode` pgEnum, [i18n.ts](../../../src/i18n/index.ts), and
the organization settings selector.

Two model-family quirks are currently hardcoded to the provider mode and are no
longer implied once the user picks the model:

- the Qwen `"Instruct: … / Query: …"` prefix applied to every `self_hosted` query
  embedding (`embeddings.ts`)
- the literal `retrievalInstructionId: "qwen3-query-v1"` (`document-config.ts`)

Both become the `embedding_instruction_profile` field, which is part of the
Phase 0 key — the same model with a different prefix is a different vector
space. Similarly `getGenerationOptions`
([generation-options.ts](../../../src/server/platform/ai/generation-options.ts)) reads thinking
style from the generation record instead of branching on the provider mode.

`resolveOrganizationEmbeddingConfig`
([documents/service.ts](../../../src/server/documents/service.ts)) is the single
choke point — eight call sites already route through it. Widen its return value;
do not add a second resolution path.

Add `import "server-only"` to `src/server/platform/ai/providers.ts` and `src/server/platform/ai/models.ts` while
touching them, so the OpenAI key's server-side confinement is enforced by the
build rather than by convention.

## Phase 3 — Suspend/resume infrastructure

New table `client_inference_requests`: `id`, `organization_id`, `kind`
(`generation` | `embedding`), `job_id` (nullable FK), `run_id` (nullable FK to
`ai_processing_runs`, generation only), `request_payload`, `input_hash`,
`model_id`, `status`, `claimed_by`, `claimed_at`, `lease_expires_at`,
`heartbeat_at`, `attempt_count`, `response`, `responded_at`, `created_at`,
`expires_at`. RLS-scoped to the organization.

Add `awaiting_client` to the `processing_status` enum. It is shared by several
tables; only `ai_processing_runs` uses the new value initially.

The suspending provider is a second `GroundedProvider` implementation alongside
[ai-sdk.ts](../../../src/server/ai/grounding/providers/ai-sdk.ts), satisfying the
same contract in [types.ts](../../../src/server/ai/grounding/types.ts). Its `run`
persists a `client_inference_requests` row and throws a typed
`ClientInferenceSuspended` rather than returning. The gateway catches it, marks
the run `awaiting_client`, and re-throws so the job parks instead of failing.

On suspension the job returns to `queued` with `availableAt` at the client lease
horizon. The resume route sets `availableAt = now` and the handler's
after-response drain does the rest. The daily cron in
[vercel.json](../../../vercel.json) remains the recovery net.

`recoverValidatedRun` is extended to accept a client-supplied output under its
existing `recoveryCompatibility` content-hash gate, which already pins job,
definition hash, locale, query units, evidence ids, and legal snapshots.

Routes, all under the standard handler so they inherit auth, RLS, and the drain:
claim next pending request, heartbeat, submit result, fail/abandon.

Client-returned output is untrusted. `validateGroundedClaims` and the coverage
check in `gateway.ts` re-validate every claim against server-held context, so a
hostile client can cause a failure but cannot manufacture a supported finding.
Resume requests pass the same identity checks as `assertGenerationAttemptInput`.

## Phase 4 — Call-site coverage

Generation, three sites — the third builds its provider directly and must be
routed through the gateway:

- [atomic-gap-generation.ts](../../../src/server/gap-analysis/atomic-gap-generation.ts)
- [action-plans/generation-service.ts](../../../src/server/action-plans/generation-service.ts)
- [contradiction-resolution-service.ts](../../../src/server/gap-analysis/contradiction-resolution-service.ts)

Repair phases and the locale retry in
[language-policy.ts](../../../src/server/ai/grounding/language-policy.ts) each
become an independent round trip, so one gap analysis is *categories × phases ×
attempts* suspensions.

Embedding, all through `createDocumentEmbeddingProvider`: the precomputed gap
query batch (`AI_EMBEDDING_BATCH_SIZE`, default 64 — one relayed call at job
start), upload ingestion, and the re-index executor, which already resumes where
it stopped rather than restarting.

`withProviderPermit`
([provider-limiter.ts](../../../src/server/ai/grounding/provider-limiter.ts))
must not hold its semaphore across a client wait: released at suspension,
re-acquired on resume.

## Phase 5 — Client

Connect flow, with a load-bearing probe whose results are stored on the Phase 2
record:

- `GET /v1/models` — confirm both chosen ids exist
- one `json_schema` generation probe — **a model that ignores it must be
  unselectable, not merely warned about.** Its failure mode is the worst
  available: HTTP 200, invented keys, Zod rejects, reported as a provider failure
  with nothing failed in the Ollama log.
- one embedding probe — record native dimensions
- `/api/ps` for the real loaded context length, not `/api/show`, which reports a
  much larger theoretical maximum

Poller and worker: claims requests for the organization, heartbeats while the
local call runs, POSTs results, aborts on cancellation, bounded local
concurrency since Ollama serialises by default.

UI: local model settings in organization settings; connection status;
gap-analysis progress surfacing "waiting for a connected client"; and a re-index
screen with explicit tab-open messaging, since a large re-index spans many
suspend/resume round trips.

Setup requirements to document and detect: `OLLAMA_ORIGINS` must include the
deployment origin or the CORS preflight fails. An HTTPS page calling
`http://localhost` is permitted — browsers treat loopback as potentially
trustworthy — but verify per target browser.

## Phase 6 — Provenance and metering

Both generation and embedding are client-executed, so `promptHash` hashes what
the **server** sent
([prompt-provenance.ts](../../../src/server/ai/generation/prompt-provenance.ts)),
never what the client reports. Token counts and model identity become client
*attestations*: `ai_processing_runs` already persists `provider` and `model` per
row, which is the right slot, but the values must be marked unverified and kept
out of the columns carrying metered OpenAI usage. Mixing them corrupts cost
reporting.

## Phase 7 — Documentation

Rewrite [local-model-testing.md](../../runbooks/local-model-testing.md): its
embedding-dimension table is wrong once Phase 1 lands, and it needs CORS setup,
the tab-open re-index, per-organization model selection, and the diagnostic path
when a client stalls. Update
[adding-ai-models.md](../../ai/adding-ai-models.md), whose `company_hosted`
examples and "add a provider" checklist no longer describe the system.

## Verification

**Corpus reseeded (2026-08-07).** The development database was cleared to apply
the Phase 0-2 schema, which truncated the legal corpus and guidance along with
everything else. Both have been restored to their previous counts and verified:
575 legal source chunks across two families, 32 provision bindings, two
activated snapshots, and 13 guidance chunks with 13 bindings.

The sequence, for the next time it is needed. `CORPUS_OPERATOR_IDENTITY` is
required by every step, and the fixture downloads the official PDFs itself:

```bash
CORPUS_OPERATOR_IDENTITY=<identity> npm run db:seed:legal-corpus-fixture
npm run worker:once                       # twice: one processing job per source
CORPUS_OPERATOR_IDENTITY=<identity> npm run db:bind:gap-corpus-provisions
CORPUS_OPERATOR_IDENTITY=<identity> npm run db:activate:legal-snapshot -- <family> <generation-id>
npm run db:verify:active-corpus
```

Guidance is separate and needs the ENISA PDF, which the script does not
download. Fetch it from the URL in `scripts/provision-guidance.ts`, then:

```bash
npx tsx --env-file=.env.local scripts/provision-guidance.ts --pdf <path> --dry
npx tsx --env-file=.env.local scripts/provision-guidance.ts --pdf <path> --reviewer <name>
```

Note that most operator scripts load `.env` rather than `.env.local`, so they
need `--env-file=.env.local` or the variables exported.

Tenant data (organizations, assessments, gap cycles) was not restored: it was
user-created test data with no seeder. A new organization is needed to exercise
the relay end to end.

**Schema.** New tables must be added to `tablesFilter` in
[drizzle.config.ts](../../../drizzle.config.ts) or `db:push` will not manage
them, and to the inventories in `verify-server-only-rls.ts` *and*
`tests/server-only-rls-schema.test.ts`, which are maintained separately and have
drifted before. Remaining phases apply schema with `npx drizzle-kit push`
directly; the full guarded workflow is for the final pass.

**Tests.** `npm run test:ai`, `npm run test:worker`, then the full `npm test`.
Existing files to update rather than delete: `ai-provider-boundary.test.ts`,
`client-server-boundary.test.ts`,
`document-retrieval-embedding-model-db.test.ts`,
`generation-options-thinking.test.ts`, `deployment-env.test.ts`. New coverage:
embedding-key invalidation stages a migration where a provider change no longer
does; suspend/resume round-trips a gap analysis; a client cannot claim another
organization's request; a tampered client response fails validation without
producing a finding.

**End to end.** Pull a generation model and an embedding model with different
dimensions (for example `gemma3` plus `embeddinggemma` at 768) to prove Phase 1.
Set `OLLAMA_ORIGINS`, run `npm run dev`, connect the client, and confirm: the
probe rejects a model that ignores `json_schema`; an upload with no client
connected stays `pending` and indexes once a client appears; a full gap analysis
completes across suspensions; changing the embedding model stages a migration and
re-indexes; changing the generation model does not.

**Regression.** With an organization on `openai`, gap analysis and action-plan
generation complete with no `client_inference_requests` row created and no client
involvement.

**Vercel.** A multi-category gap analysis makes forward progress across `after()`
invocation boundaries, and an abandoned client lease is recovered rather than
leaving the job parked until the daily cron.
