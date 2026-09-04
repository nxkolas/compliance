# Docker Scope Reduction and Host-Based Local Development

## Status

Implemented 2026-08-04. Option 1 was chosen for the open question below: the
`private_self_hosted` topology is kept, and staging is accepted as its first
integration point.

Two things differed from the plan as written:

- **Step 4 was much smaller than estimated.** The lease-expiry and idempotency
  behaviour did not need porting; `tests/job-execution-db.test.ts` already
  asserts concurrent lease exclusivity and expired-lease reclamation with
  attempt increment. Those tests were gated behind `DATABASE_URL` and simply
  never ran in CI. The work became giving CI a Postgres service, not writing
  tests. The compose-era guard `COMPOSE_PROJECT_NAME=compliancetool-test` was
  replaced by an explicit `DISPOSABLE_DATABASE=1` opt-in.
- **`docker-functional-acceptance.ts` was converted rather than kept as-is.**
  It is now `scripts/functional-acceptance.ts`: the Mailpit email-confirmation
  flow is replaced by pre-confirmed admin user creation, the web URL defaults to
  loopback, and the direct inference probe is optional and provider-agnostic.
  The LiteLLM invalid-key assertion was dropped because it tested LiteLLM, not
  the application.

Known coverage reduction: web/Storage/whole-project restart persistence is no
longer asserted anywhere. This was accepted; those gates were Compose-specific.

## Objective

Stop maintaining the Dockerised local development stack and the private AI
inference host. Keep local development on the host (Node plus hosted Supabase),
keep the production application-host topology, and reduce self-hosted AI to an
optional host-run Ollama endpoint pointed at from `.env.local`.

Roughly 2,000 lines of infrastructure are removed. About 300 lines of
integration test are added so that behaviour currently asserted only by the
local acceptance suite does not silently disappear.

## Verified current state

These were confirmed by inspection, not assumed:

- `.env.local` targets a **hosted Supabase project**
  (`ybsmwaapqdhvmvyddmma.supabase.co`) and OpenAI (`gpt-5.6-luna`,
  `text-embedding-3-small`). The Docker local stack has never been part of the
  actual development loop.
- `AI_DEFAULT_PROVIDER` is unset and defaults to `openai`
  ([common.ts:51-53](../../../src/config/env/common.ts#L51-L53)). `APP_ENV` is
  unset and defaults to `local`, so every production-only refinement in
  `superRefine` is skipped. The current `.env.local` validates cleanly.
- `local-acceptance.ps1` has **never passed**. Both evidence files in
  [docs/qa/](../../qa/) terminate in failure (`web liveness | failed`;
  `Supabase Auth through Caddy | failed`, 401).
- `verify.yml:119` invokes `infra/scripts/migration-rehearsal.ps1`, which **does
  not exist**. The `deployment` CI job is already broken.
- `containers.yml` builds, signs, scans, and publishes six images but never
  starts one. There is no integration coverage in CI.
- `scripts/ai-live-qualification.ts:114` requires `AI_QUALIFICATION_VLLM_IMAGE`
  and is therefore vLLM-specific.
- `.env.local` is covered by `.gitignore` (`.env*.local`) and is untracked.

## Confirmed decisions

- Local development stays on the host: `npm run dev` plus `npm run worker:local`
  against hosted Supabase. No Docker in the daily loop.
- Delete `infra/compose/local/` and its PowerShell tooling entirely.
- Delete the AI host topology: vLLM, LiteLLM, WireGuard, and model provisioning.
- Keep the self-hosted AI *mode* in the environment schema and provider
  abstraction. Delete only the infrastructure that implemented one instance of
  it.
- Optional local model testing runs Ollama natively on the host, exposed on a
  port, configured through `.env.local`.
- Local embedding model is `qwen3-embedding:4b-q4_K_M`.
- Keep `infra/compose/app-host/`, the `Dockerfile` (all six targets),
  `versions.env`, the deploy/backup/restore scripts, and `containers.yml`.
- Supabase CLI adoption is optional and deferred to step 7.

## Open question to resolve before step 4

Once local development runs on hosted Supabase and the local Compose stack is
gone, the `private_self_hosted` production topology has **no test coverage
anywhere**. `compose/app-host/` would deploy a shape never exercised before
staging.

Options:

1. Accept it; treat staging as the first integration point. Cheapest, and
   reasonable while there is no self-hosting customer.
2. Keep one minimal Compose file purely as a staging rehearsal target.
3. Drop `private_self_hosted` entirely and commit to `managed_cloud`, which
   would allow deleting nearly all of `infra/`.

Recommendation: option 1 now, revisit when a self-hosting customer is real.
This plan assumes option 1 and does not touch `compose/app-host/`.

## Step 1 — Delete the local Docker development stack

Delete:

- `infra/compose/local/` — `compose.yml`, `compose.infra.yml`,
  `compose.studio.yml`, `compose.docling.yml`, `compose.observability.yml`,
  `compose.constrained-memory.yml`
- `infra/scripts/local-bootstrap.ps1`, `local-up.ps1`, `local-down.ps1`,
  `local-status.ps1`, `local-acceptance.ps1`
- `infra/scripts/generate-local-env.mjs`,
  `validate-local-compose-security.ps1`, `render-config.ps1`
- `infra/env/examples/local.env.example`
- `.env.docker.local`, `.env.docker.test` (untracked, local only)
- `docs/qa/docker-deployment-2026-07-27T*.md` — failed evidence for a gate that
  no longer exists

Keep `scripts/docker-functional-acceptance.ts`. It is the substance behind the
"functional Auth/Storage/AI/retrieval acceptance" gate and is repurposed in
step 4. Leave the `acceptance:docker` npm script in place until then.

## Step 2 — Delete the AI host topology

Delete:

- `infra/compose/ai-host/` — `compose.yml`, `compose.observability.yml`
- `infra/scripts/deploy-ai-host.sh`, `provision-ai-host.sh`,
  `provision-models.sh`, `provision-wireguard.sh`, `wireguard-metrics.sh`
- `infra/config/litellm/` — `local.yaml`, `production.yaml`, `custom_auth.py`
- `infra/config/prometheus/ai-host.yml`, `alerts-ai-host.yml`
- `infra/security/vllm-critical-header-allowlist.txt` (and `infra/security/` if
  it becomes empty)
- `infra/env/examples/ai-host.env.example`
- `.github/workflows/qualify-ai.yml`
- `docs/runbooks/docker-ai-qualification.md`
- `scripts/ai-live-qualification.ts` — vLLM-specific

Edit:

- `infra/versions.env` — remove `VLLM_IMAGE`, `DCGM_EXPORTER_IMAGE`,
  `LITELLM_IMAGE`, `OLLAMA_IMAGE`
- `infra/env/examples/app-host.env.example` — remove WireGuard and AI-host
  variables

Keep `docs/research/self-hosted-production-model-selection-2026-07-27.md` as
historical research.

## Step 3 — Wire the optional host-run local model

No application code changes are required. The provider abstraction in
[src/server/platform/ai/providers.ts](../../../src/server/platform/ai/providers.ts) already supports an
arbitrary OpenAI-compatible base URL, and Ollama serves `/v1` natively, so
LiteLLM is not replaced by anything.

Install Ollama on the host, then pull the models. Replace the placeholder
`# Local/self-hosted` block in `.env.local` with a commented-out block that is
uncommented only for model testing:

```
AI_DEFAULT_PROVIDER=self_hosted
SELF_HOSTED_AI_BASE_URL=http://127.0.0.1:11434/v1
SELF_HOSTED_AI_API_KEY=ollama
SELF_HOSTED_AI_MODEL=qwen3.5:9b-q4_K_M
SELF_HOSTED_AI_SMALL_MODEL=qwen3.5:9b-q4_K_M
SELF_HOSTED_AI_EMBEDDING_MODEL=qwen3-embedding:4b-q4_K_M
SELF_HOSTED_AI_EMBEDDING_REVISION=qwen3-embedding-4b-q4_K_M
SELF_HOSTED_AI_MAX_CONTEXT_TOKENS=32768
SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS=false
SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS=false
```

Notes that matter:

- `SELF_HOSTED_AI_API_KEY` must be non-empty. `requireEnv` rejects `""`, and
  Ollama ignores the value.
- Start with `SUPPORTS_STRUCTURED_OUTPUTS=false`. The old value of `true`
  described LiteLLM in front of vLLM, not Ollama directly. Raise it only after
  structured generation is confirmed working.
- `isPrivateServiceHost` rejects `localhost`, but that check only runs when
  `APP_ENV=production`. A loopback URL is fine for local testing.
- `qwen3-embedding:4b` emits 2560 dimensions.
  [embeddings.ts:47-54](../../../src/server/documents/embeddings.ts#L47-L54)
  truncates to the configured 1536, which is legitimate because
  Qwen3-Embedding is Matryoshka-trained. Models below 1536 (`nomic-embed-text`
  at 768, `mxbai-embed-large` and `bge-m3` at 1024) throw and cannot be used —
  `AI_EMBEDDING_DIM` is hard-pinned to 1536 by
  [common.ts:56](../../../src/config/env/common.ts#L56) and the `vector(1536)`
  columns in [schema.ts:23](../../../src/db/schema.ts#L23).

**Blocking check before mixing providers.** Qwen and OpenAI embeddings occupy
different vector spaces; searching them together silently degrades retrieval.
`embedding_model` is recorded per row
([schema.ts:648](../../../src/db/schema.ts#L648),
[schema.ts:972](../../../src/db/schema.ts#L972)) and the legal corpus path
guards on it
([processing-service.ts:53](../../../src/server/corpus/processing-service.ts#L53)),
but confirm whether **document retrieval** filters on `embeddingModel` before
running local embeddings against a database that already holds OpenAI vectors.
If it does not, use a separate database or re-embed when switching.

Add `docs/runbooks/local-model-testing.md` covering install, pull, the env
block, and the mixed-embedding caveat.

## Step 4 — Preserve the behaviour that dies with the acceptance suite

`local-acceptance.ps1` is the only place these are asserted. Port them to
vitest integration tests running against hosted Supabase (or a Supabase CLI
instance in CI), so they execute on every pull request rather than never:

| Behaviour | Current gate |
| --- | --- |
| Expired worker lease retry and idempotent completion | `local-acceptance.ps1:324` |
| Worker restart readiness | `local-acceptance.ps1:320` |
| Storage bootstrap idempotence | `local-acceptance.ps1:282` |
| Bounded AI dependency outage | `local-acceptance.ps1:372` |
| Liveness and readiness endpoints | `local-acceptance.ps1:263-267` |

Restart-persistence gates (`web`, `Storage`, whole-project) are Compose-specific
and are dropped rather than ported.

Reuse `scripts/docker-functional-acceptance.ts` as the basis for the Auth,
Storage, and retrieval assertions; re-point it away from Compose service names
and rename it (`scripts/functional-acceptance.ts`).

This is the only step with real engineering cost. It should land before or with
step 5, not after.

## Step 5 — Repair CI

In `.github/workflows/verify.yml`:

- Remove the "Generate isolated non-secret configuration" step (its script is
  deleted).
- Remove local Compose validation (lines 77-87) and ai-host validation
  (lines 111-117).
- Remove the "Rehearse two independent empty database builds" step — it already
  invokes a nonexistent script.
- Keep app-host Compose validation, Caddy/monitoring config validation,
  actionlint, and shell linting.
- Add the step 4 integration tests.

`containers.yml`, `deploy-staging.yml`, and `deploy-production.yml` are
unchanged.

## Step 6 — Documentation

- Rewrite `infra/README.md`: production topology only, plus a short pointer to
  host-based local development.
- Update `docs/runbooks/docker-release.md`, `docker-upgrade.md`,
  `docker-incident-response.md`, and `docker-backup-restore.md` to drop local
  and AI-host references.
- Append a scope-change note to
  `docs/plans/done/complete-docker-deployment.md` recording that the local
  stack and AI host were removed on 2026-08-04, so the superseded plan is not
  read as current.
- Move this plan to `docs/plans/done/` on completion.

## Step 7 — Optional: Supabase CLI for offline development

Deferred, not required. Worth doing if offline work or throwaway databases
become valuable, and strongly worth doing if `.env.local` currently points at a
database that also serves real users.

- `supabase init`, commit `supabase/config.toml`
- Move `infra/config/supabase/db-init/00-vector.sql` into a Supabase migration
- Add a `.env.local.example` variant with CLI defaults

The CLI images already include the roles, JWT, and webhook SQL that
`infra/vendor/supabase/volumes/db/` carries; those vendored files exist only
because the stack was hand-rolled. Accept that CLI image versions drift from
the audited pins in `versions.env`.

## Verification

- Step 1-2: `git grep -n "compose/local\|ai-host\|litellm\|vllm\|wireguard"`
  returns only `docs/research/` and historical plan documents.
- Step 3: with the self-hosted block active, document upload produces
  embeddings and gap generation completes end to end.
- Step 4: the new integration tests pass locally and in CI.
- Step 5: the `Verify` workflow is green for the first time (the `deployment`
  job currently fails on the missing script).
- Step 6: no runbook references a deleted file.

## Out of scope

- `infra/compose/app-host/` and the production deployment path
- The `Dockerfile` and all six build targets
- `containers.yml` image build, signing, scanning, and publication
- The three-mode AI provider abstraction in `src/server/platform/ai/`
- Any change to `AI_EMBEDDING_DIM` or the `vector(1536)` schema

## Housekeeping noted during inspection

`.env.local` is correctly gitignored and untracked, so nothing leaked. Two
things are worth a moment anyway: line 12 is a stray bare password fragment
outside any assignment, and `DATABASE_URL` points at a live hosted Supabase
project. If that project also serves real users, a separate development project
(or step 7) should come before anything that writes test data.
