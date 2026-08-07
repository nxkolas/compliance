# Browser-Relayed Local Model Inference

## Status

**Superseded on 2026-08-07 by
[browser-relayed-local-ai.md](../pending/browser-relayed-local-ai.md). Not
implemented as written.** That plan adopts this design's execution model — a suspending
provider, a client-claimed inference queue, and resume through
`recoverValidatedRun` — and extends it to cover embeddings as well as
generation, which is Open decision 1 below. It also settles the two questions
this document could not: the application ships on Vercel with OpenAI and local
inference as the only two provider modes, and the local model is chosen per
organization rather than fixed per deployment.

The constraints recorded in this file were verified against the code and remain
accurate; they are the reason the superseding plan is shaped the way it is. Read
this document for the *why*, and the superseding plan for the *what*.

Original status, retained: exploratory. Not approved, not scheduled, and not
recommended over the alternatives recorded below. Written up on 2026-08-07 so
the shape and the cost of this option are on record before anyone commits to it.

## Objective

Let an organization run gap analysis against a model deployed on a user's own
computer — `http://localhost:11434` or similar — without exposing that machine
to the internet.

The application server cannot reach a user's loopback address. The user's
browser can. So the browser becomes the transport: the server prepares the
prompt, the browser performs the inference call against the local model, and the
server resumes with the returned object.

## Why this is the hard path

Recorded so it does not get re-litigated later.

**This does not deliver data residency.** Documents already live in the
application's Postgres, and the grounded prompt — evidence excerpts included — is
assembled server-side in
[context-builder.ts](../../../src/server/ai/grounding/context-builder.ts) and
would be shipped *to* the browser to be forwarded. What changes is which model
vendor sees the prompt, not where the customer's data lives. If the requirement
is "nothing leaves the premises," this design does not satisfy it.

**Two cheaper options exist:**

- *Per-organization endpoint.* The user exposes their model at a reachable HTTPS
  URL and the server calls it directly. Contained refactor: thread a resolved
  config object through the provider constructors, add per-org columns, build
  secret encryption, add SSRF defense.
- *Ship the application to the user's machine.* Already a supported and
  validated topology — `DEPLOYMENT_TOPOLOGY=private_self_hosted` with
  `AI_DEFAULT_PROVIDER=self_hosted`, provisioned per
  [infra/README.md](../../../infra/README.md). No code change at all, and it is
  the only one of the three that actually delivers residency.

Proceed with this plan only if the requirement is specifically "the model runs
on the end user's own machine, unreachable from our network."

## Constraints imposed by the current architecture

These are the facts that make the work large. Each is verified against the code.

### Inference is synchronous inside a worker job

[gateway.ts:342-360](../../../src/server/ai/grounding/gateway.ts#L342-L360) calls
`provider.run(...)` inline and persists context, claims, and output in the same
`try` block. There is no suspend point anywhere in the path.

### One job is many provider calls, not one

Gap generation fans out over categories at `AI_CATEGORY_CONCURRENCY` (default 3)
through `coordinateCategoryGeneration`
([atomic-gap-generation.ts:137-183](../../../src/server/gap-analysis/atomic-gap-generation.ts#L137-L183)),
each category has an `initial` phase and possible repair phases, and each phase
carries a `providerAttempt` counter. On top of that,
`executeLanguageValidatedProvider`
([language-policy.ts:95-100](../../../src/server/ai/grounding/language-policy.ts#L95-L100))
can call `provider.run` twice for a locale mismatch.

A single gap analysis is therefore *categories x phases x attempts* round trips
to the browser, not one.

### Three call sites, not one

- [atomic-gap-generation.ts:183](../../../src/server/gap-analysis/atomic-gap-generation.ts#L183)
- [action-plans/generation-service.ts:391](../../../src/server/action-plans/generation-service.ts#L391)
- [contradiction-resolution-service.ts:331](../../../src/server/gap-analysis/contradiction-resolution-service.ts#L331)
  — this one builds its provider directly rather than going through the gateway.

### The concurrency permit wraps the provider call

`withProviderPermit`
([provider-limiter.ts:70-92](../../../src/server/ai/grounding/provider-limiter.ts#L70-L92))
holds a process-global semaphore slot for the duration of `provider.run`. If that
call becomes a wait on a browser, the permit is held across client latency and
the limiter stops measuring what it was built to measure.

### Embeddings have no browser attached

Document ingestion and re-indexing run in the worker on upload
([documents/service.ts:521](../../../src/server/documents/service.ts#L521),
[:587](../../../src/server/documents/service.ts#L587)), and gap analysis
precomputes its query vector server-side *before* generation starts, using the
organization's own embedder
([atomic-gap-generation.ts:128-136](../../../src/server/gap-analysis/atomic-gap-generation.ts#L128-L136)) —
because retrieval filters rows on `document_versions.embedding_model` and a
vector from a different space would be silently incomparable.

There is no point in that flow where a browser is present. This is the hardest
constraint in the plan; see Open decisions.

### The run status enum has nowhere to park a suspended run

`processing_status` is `pending | processing | succeeded | failed`
([schema.ts:868](../../../src/db/schema.ts#L868)). A run waiting on a client is
none of those.

## What already works in our favour

**The resume seam half-exists.** `recoverValidatedRun`
([gateway.ts:531-581](../../../src/server/ai/grounding/gateway.ts#L531-L581))
already models "a `processing` run carries a `validatedOutput`, so skip the
provider and finish the remaining work," gated on a `recoveryCompatibility`
content hash that pins job, release, locale, query units, evidence ids, and
pinned legal snapshots. That is most of a resume protocol.

**Client-returned output cannot inject findings.** `validateGroundedClaims` plus
the coverage check
([gateway.ts:361-389](../../../src/server/ai/grounding/gateway.ts#L361-L389))
re-validate every claim against server-held context. A hostile client can cause a
failure; it cannot manufacture a supported finding. This is what makes the design
defensible at all.

## Design

### Execution model

1. The worker prepares the operation exactly as today — policy, retrieval, prompt
   assembly, schema construction, run row — then, instead of calling the model,
   persists the rendered prompt and marks the run `awaiting_client`. The job
   yields.
2. The browser polls for pending inference requests scoped to its organization,
   receives the system/user prompt and the JSON schema, and POSTs to the local
   model's OpenAI-compatible endpoint.
3. The browser returns the raw object to a resume endpoint.
4. The server validates, persists, and lets the job continue at the point after
   `provider.run`.

### A suspending provider

Implement a `GroundedProvider` whose `run` persists the request and throws a
typed `ClientInferenceSuspended` signal rather than returning. The gateway
catches it, marks the run suspended, and re-throws so the job scheduler parks the
task rather than failing it. Resume re-enters the same code path with the stored
output present, reusing the `recoverValidatedRun` gate.

This keeps `GroundedProvider` as the single seam and avoids forking the gateway.

### Trust boundary

Everything provenance-related must be computed server-side and client-supplied
values discarded:

- `promptHash` — hash what the server sent
  ([prompt-provenance.ts](../../../src/server/ai/generation/prompt-provenance.ts)),
  never what the client reports.
- `attemptCount`, `inputTokens`, `outputTokens`, `cachedInputTokens` — a local
  model reports these through the client, so they are attestations, not
  measurements. Either drop them for this provider or store them in a field that
  is explicitly marked unverified. Silently writing them into the same columns as
  metered provider usage would corrupt cost reporting.
- Resume requests must carry the reservation and attempt keys and pass the same
  identity checks as `assertGenerationAttemptInput`
  ([gateway.ts:480-509](../../../src/server/ai/grounding/gateway.ts#L480-L509)),
  scoped by RLS to the organization.

### Liveness

A suspended run needs a lease with a client heartbeat, distinct from the existing
worker lease in
[job-run-lifecycle.ts](../../../src/server/ai/generation/job-run-lifecycle.ts).
If the tab closes, the run must fail promptly with a clear reason rather than
occupying a slot until a timeout — `AI_PROVIDER_TIMEOUT_MS` caps at 300s
([ai-sdk.ts:123-128](../../../src/server/ai/grounding/providers/ai-sdk.ts#L123-L128)),
which is the wrong instrument here.

### Browser-side requirements

- Ollama must be started with `OLLAMA_ORIGINS` including the application origin,
  or the CORS preflight fails. This is user setup and needs documenting in
  [local-model-testing.md](../../runbooks/local-model-testing.md).
- An HTTPS page calling `http://localhost` is permitted — browsers treat loopback
  as a potentially trustworthy origin — but this should be verified per target
  browser rather than assumed.
- `SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS` must be true. The runbook already
  documents the failure mode when it is not: the request succeeds, the model
  invents keys, and Zod rejects it with no failed HTTP call to point at.

## Work breakdown

**Phase 1 — suspend/resume infrastructure.** Add the suspended run state and its
lease; implement the suspending provider; add request/resume API routes with RLS
scoping; extend `recoverValidatedRun` to accept a client-supplied output under
the existing compatibility hash.

**Phase 2 — call-site coverage.** Route all three call sites through the new
seam, including the contradiction-resolution service that currently constructs
its provider directly. Verify repair phases and the language retry survive
suspension, since each becomes an independent round trip.

**Phase 3 — client.** Local-model connection settings and reachability check;
a poller that claims pending requests and heartbeats; the inference call itself;
progress and failure surfacing in the existing gap-analysis progress UI.

**Phase 4 — provenance and metering.** Separate attested usage from measured
usage. Confirm the limiter is not holding permits across client waits.

**Phase 5 — documentation.** Extend the local-model runbook with the CORS
requirement, the "keep the tab open" constraint, and the diagnostic path when a
client stalls.

## Open decisions

1. **Embeddings.** No option is good. Either (a) embeddings stay server-side,
   which mixes provider families and is exactly what the `embedding_model` filter
   in [retrieval.ts](../../../src/server/documents/retrieval.ts) exists to
   prevent; or (b) ingestion and re-indexing also become browser-driven, meaning
   a user must hold a tab open through a full document re-index; or (c)
   browser-relayed inference is restricted to generation only and the feature is
   documented as *not* keeping embedding work local. **This must be settled
   before Phase 1** — it may invalidate the whole plan.
2. Whether a suspended run blocks the organization's other work or whether
   suspended runs get their own capacity accounting.
3. Whether this is offered to all organizations or gated to an explicit opt-in
   mode, given the provenance weakening.
4. What the UI does when several users of one organization have a local model
   configured — first claim wins, or a designated machine.

## Risks

- **Provenance dilution.** The audit story today rests on the server knowing
  exactly what was sent and what came back. Interposing a client weakens it even
  with server-side hashing, and that is a compliance product.
- **Support burden.** Failures move onto machines you cannot inspect: CORS,
  model not pulled, context window too small, laptop asleep mid-job.
- **Latency.** Local models are slow and Ollama serialises requests by default;
  the runbook already advises `AI_PROVIDER_MAX_CONCURRENCY=1` locally. Multiply
  that by the per-job round-trip count above.
- **Partial completion.** A job abandoned halfway leaves some categories
  generated and some not; the recovery path must handle that cleanly.

## Out of scope

- Per-organization provider credentials for server-reachable endpoints — that is
  the alternative design, not part of this one.
- Any change to the `private_self_hosted` topology, which already works.
- Browser-side document parsing or chunking.
