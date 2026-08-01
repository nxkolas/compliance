# Gap Analysis Cycle, Performance, Progress, and Async Revisions

Status: proposed incremental implementation plan; based on the gap-analysis
architecture review completed on 2026-08-01.

## Outcome

Improve the existing Gap Analysis workflow without redesigning its durability,
grounding, or review model. The completed work must:

1. use **analysis cycle** for the TypeScript, route, client, and user-facing
   concept that currently appears as a reassessment draft;
2. keep one AI operation per category and preserve focused repair, retry,
   cancellation, validation, and citation behavior;
3. measure queue, retrieval, embedding, provider, validation, and persistence
   time before changing concurrency defaults;
4. retrieve legal and organization evidence concurrently;
5. resolve shared grounding dependencies once and embed category queries in
   batches grouped by embedding space;
6. run corrections and guidance regenerations as cancellable background jobs;
7. expose meaningful, monotonic generation progress through the existing job
   resource;
8. load post-generation Results, Inputs, and History through separate read
   interfaces;
9. distinguish locally answered questionnaire questions from answers confirmed
   by the server; and
10. reuse the shared backoff-aware job poller for Action Plan generation.

The desired external seam of the Gap Analysis module remains small:

```ts
prepareGapAnalysisCycle(input): Promise<GapAnalysisCycle>;
replaceGapAnalysisEvidence(input): Promise<GapAnalysisCycle>;
enqueueGapAnalysisGeneration(input): Promise<{ job: BackgroundJob }>;
enqueueGapRevisionMutation(input): Promise<{ job: BackgroundJob }>;
getGapWorkflowSummary(input): Promise<GapWorkflowSummary>;
getGapResults(input): Promise<GapResults>;
getGapInputs(input): Promise<GapInputs>;
getGapHistory(input): Promise<GapHistory>;
```

Provider selection, grounding preparation, retrieval, batching, validation,
retry, persistence, audit history, job ownership, and cancellation remain the
implementation of that module. Browser callers must not coordinate those
steps themselves.

## Confirmed Decisions

- Improve incrementally; do not replace the current workflow.
- Rename TypeScript and user-facing vocabulary first. Do not rename database
  tables or historical persisted identifiers in this plan.
- Use `GapAnalysisCycle` for both an organization's first analysis and later
  repetitions.
- Keep `GapAssessment`, while making `QuestionnaireRevision`,
  `GapAnalysisRevision`, `AiProcessingRun`, and `BackgroundJob` explicit in
  domain-facing code.
- Keep one provider operation per category. Do not split generation by
  question and do not combine all categories into one provider operation.
- Keep evidence preparation and review separate from paid generation.
- Use `/api/jobs/{jobId}` for generation and revision-mutation progress. Do
  not add a Gap-specific progress endpoint.
- Derive immediate questionnaire completion in the browser and return
  authoritative saved completion in the existing answer `PATCH` response.
- Do not add live questionnaire polling or a standalone progress-only read.
  Real-time multi-user synchronization is a separate product decision.
- Prefer category units such as `6 of 10 categories complete` over an
  apparently precise time estimate.
- Keep the default category concurrency at `3` until measurements and a shared
  provider limiter prove that `4` or `5` is safe.
- Preserve immutable prompt and response contracts. Retrieval and orchestration
  changes must not modify released prompt hashes or reinterpret historical
  generated revisions.

## Scope

### Included

- TypeScript symbols, files, DTO properties, client methods, route paths,
  labels, audit projections, tests, and docs that expose `reassessment` as a
  current domain concept;
- compatibility adapters for the existing `gap_reassessment_*` database
  schema and historical audit/job data;
- privacy-safe generation timing and call-count metrics;
- legal/document retrieval parallelism;
- batched query embeddings and shared grounding preparation;
- monotonic job progress and structured progress details;
- asynchronous correction and guidance-regeneration commands;
- lazy post-generation read models;
- questionnaire local-versus-saved progress;
- shared browser job polling; and
- concurrency benchmarks at `3`, `4`, and `5`.

### Excluded

- renaming `gap_reassessment_drafts`, its foreign keys, or existing migrations;
- rewriting historical audit event names, job kinds, or artifact metadata;
- changing the number of category outputs or moving to question-level AI
  operations;
- merging evidence review and generation into one browser command;
- WebSockets, server-sent events, or polling for collaborative questionnaire
  edits;
- a generic progress endpoint separate from `/api/jobs/{jobId}`;
- automatic activation of a higher concurrency setting without benchmark and
  provider-capacity evidence;
- changes to immutable Gap or Action Plan prompt contracts; and
- migrations of existing Gap Analysis revisions.

## Required Invariants

The implementation is complete only if all of these remain true:

1. An analysis cycle pins one questionnaire revision, evidence selection,
   output locale, generation job, AI runs, and output Gap Analysis revision.
2. The first cycle and every later cycle use the same domain workflow.
3. Existing rows in `gap_reassessment_drafts` remain readable and writable
   without data migration.
4. Released prompt names, versions, template hashes, response schemas, and
   historical outputs remain unchanged.
5. Exactly one accepted output exists per required category, with the current
   citation and provenance guarantees.
6. Repairs and transient retries remain bounded and category-local.
7. Cancellation stops queued category work, settles active siblings, and
   cannot leave a `processing` AI run under a terminal job.
8. A revision mutation creates a complete new immutable revision or creates no
   revision at all.
9. A revision mutation whose source is no longer current fails safely with no
   overwrite.
10. Idempotent replay returns the original job or result and never enqueues a
    duplicate operation.
11. Job progress never decreases, including when the worker heartbeat races a
    category update.
12. Terminal jobs report `100` only on success; failed and cancelled jobs keep
    their last truthful progress.
13. Retrieval results retain their query hashes, ranks, scores, channel,
    source identity, and immutable excerpt provenance after batching.
14. Evidence retrieval never crosses the pinned corpus, organization,
    document-version, locale, or authorization scope.
15. The questionnaire can show optimistic local completion, but it clearly
    distinguishes it from server-confirmed saved completion.
16. Opening Results does not fetch Inputs or History; opening either secondary
    view fetches it at most once per current revision unless explicitly
    refreshed.

## Naming and Compatibility Model

Use the following vocabulary in new and touched TypeScript:

| Current | Target |
|---|---|
| `gapReassessmentDraft` | `gapAnalysisCycle` |
| `GapReassessmentDraft` | `GapAnalysisCycle` |
| `prepareGapReassessment` | `prepareGapAnalysisCycle` |
| `updateGapReassessmentEvidence` | `replaceGapAnalysisEvidence` |
| `generateGapReassessment` | `enqueueGapAnalysisGeneration` |
| `workflow.reassessment` | `workflow.analysisCycle` |
| `/gap-analysis/reassessment` | `/gap-analysis/cycles` |
| generated artifact revision used for a Gap result | `GapAnalysisRevision` |
| assessment revision used as the submitted questionnaire snapshot | `QuestionnaireRevision` |

The persistence adapter may continue importing `gapReassessmentDrafts` and
`gapReassessmentDraftDocuments` from `src/db/schema.ts`. Confine those legacy
names to persistence and compatibility files. Domain modules, browser
contracts, and UI copy must not require callers to understand them.

Persisted values that predate the rename remain valid. Readers should project
historical `gap_reassessment.*` events as analysis-cycle activity in the UI.
New event-name migration is deferred; changing event strings without migrating
all consumers would create two audit vocabularies.

## Target Browser Routes

Introduce the new routes before removing the old internal aliases:

```text
POST /api/organizations/{organizationId}/gap-analysis/cycles
GET  /api/organizations/{organizationId}/gap-analysis/cycles/{cycleId}
PUT  /api/organizations/{organizationId}/gap-analysis/cycles/{cycleId}/evidence
POST /api/organizations/{organizationId}/gap-analysis/cycles/{cycleId}/generation-jobs

POST /api/organizations/{organizationId}/gap-analysis/revisions/{revisionId}/corrections
POST /api/organizations/{organizationId}/gap-analysis/revisions/{revisionId}/guidance-regenerations

GET  /api/organizations/{organizationId}/gap-analysis
GET  /api/organizations/{organizationId}/gap-analysis/revisions/{revisionId}
GET  /api/organizations/{organizationId}/gap-analysis/revisions/{revisionId}/inputs
GET  /api/organizations/{organizationId}/gap-analysis/history
```

`POST /cycles/{cycleId}/generation-jobs` handles both first enqueue and an
explicit retry of a failed or cancelled cycle through a discriminated request
body. It returns `202 { data: { job } }`.

The correction routes also return `202 { data: { job } }`. They do not return
the generated revision from the request. The terminal job links to the new Gap
Analysis revision through `background_job_results.generated_artifact_revision_id`.

Because the application API is internal, remove the old reassessment route
aliases after the checked-in client and route-contract tests use only the new
paths. Keep database and historical-data compatibility indefinitely.

## Job Progress Contract

Extend the existing job DTO with nullable progress detail:

```ts
type JobProgressPhase =
  | "preparing_evidence"
  | "generating_categories"
  | "validating"
  | "saving_result"
  | "completed";

type JobProgress = {
  progress: number;
  phase: JobProgressPhase | null;
  completedUnits: number | null;
  totalUnits: number | null;
};
```

Persist `phase`, `completed_units`, and `total_units` on `background_jobs` so
progress survives worker restarts and is available to every execution adapter.
Add checks for `0 <= progress <= 100`, non-negative units, and
`completed_units <= total_units` when both are present.

Use a single job-module command to advance progress. Its update must:

- require the current live lease and running job state;
- set numeric progress with SQL `greatest(existing, proposed)`;
- set completed units with SQL `greatest(existing, proposed)`;
- reject a changed total after it is first set;
- permit only forward phase transitions; and
- update the lease independently of progress.

Refactor `heartbeatJob` so a heartbeat renews ownership and observes
cancellation but does not write a stale progress snapshot. This removes the
current race in which the runtime repeatedly sends the progress value captured
when the job was leased.

Suggested Gap generation presentation:

| Phase | User-facing state | Percentage policy |
|---|---|---|
| queued | Waiting to start | `0` |
| `preparing_evidence` | Preparing evidence | `1-9` |
| `generating_categories` | `N of M categories complete` | monotonic `10-89` |
| `validating` | Validating the analysis | `90-94` |
| `saving_result` | Saving the result | `95-99` |
| `completed` | Complete | `100` |

Repairs and provider retries do not increment `completedUnits`. A category
increments the count once, only after its accepted validated output is owned
by the coordinator. The UI may render the progress bar but should lead with
the phase and unit count, not an estimated time remaining.

## Implementation Phases

### Phase 1: Introduce analysis-cycle vocabulary

1. Add domain-facing `GapAnalysisCycle`, `QuestionnaireRevision`, and
   `GapAnalysisRevision` types. Keep database row types inside persistence
   adapters.
2. Rename `reassessment-service.ts` to an analysis-cycle module, or add the new
   module and reduce the old file to temporary compatibility re-exports.
3. Rename exported commands to `prepareGapAnalysisCycle`,
   `replaceGapAnalysisEvidence`, and `enqueueGapAnalysisGeneration`.
4. Change workflow DTOs and React properties from `reassessment` to
   `analysisCycle`.
5. Add the `/cycles` route family and migrate `src/client/gap-analysis.ts` to
   it.
6. Replace UI copy that implies every cycle is a repeat. The first analysis
   and later analyses must use the same labels.
7. Update smoke commands, tests, docs, and error descriptions. Keep stable
   persisted error codes where clients or operators depend on them.
8. Once route-contract tests show no checked-in caller uses the old routes,
   delete the route aliases and compatibility exports. Keep the physical
   schema names.

Verification:

- TypeScript has no domain/UI `reassessment` references outside the named
  persistence and historical compatibility allowlist.
- A seeded legacy draft resumes as an analysis cycle.
- First generation, retry, cancellation, and repeat generation retain their
  existing behavior.
- `npm run typecheck`, targeted Gap workflow tests, route tests, and the
  authenticated Gap smoke workflow pass.

Rollback: restore the old exports and browser routes; no data rollback is
required because this phase does not rename persisted structures.

### Phase 2: Add measurements and truthful progress

1. Extend private generation telemetry with timings for:
   - queue delay (`started_at - created_at`);
   - grounding-policy and provider preparation;
   - legal retrieval;
   - organization-document retrieval;
   - embedding provider calls, including batch size and call count;
   - provider generation attempts;
   - validation and repair;
   - final persistence; and
   - total job duration.
2. Record only privacy-safe dimensions: job kind/version, operation kind,
   provider mode, model identifier, category code, locale, attempt number,
   batch size, outcome, and duration. Never log prompts, answers, excerpts,
   document titles, correction reasons, or generated prose.
3. Add the job progress columns, DTO fields, database checks, and the monotonic
   `advanceJobProgress` command.
4. Decouple heartbeat lease renewal from progress mutation.
5. Add an accepted-category callback at the category coordinator interface and
   use it to advance `completedUnits` once per category.
6. Advance `preparing_evidence`, `validating`, and `saving_result` at their
   actual orchestration seams; finalize `completed` atomically with job
   success.
7. Store the latest job DTO in `gap-analysis-workflow.tsx` through `pollJob`'s
   existing `onUpdate` callback and pass it into
   `gap-generation-progress.tsx`.
8. Add localized phase and unit-count labels. Preserve the generic spinner as
   the fallback for legacy jobs with null progress details.
9. Update `scripts/benchmark-gap-workflow.ts` to report stage p50/p95, provider
   calls, embedding calls, category repair count, and end-to-end duration.

Verification:

- A forced heartbeat/category-update race never decreases progress.
- Restarting a worker preserves the last phase and completed-unit count.
- Repair, transient retry, failure, and cancellation do not overcount units.
- Failed and cancelled jobs never claim completion.
- Job route contracts remain backward-compatible for consumers that only read
  the existing fields.
- Telemetry tests assert that no customer content enters metrics.

Rollback: stop emitting progress details and let clients use the legacy
spinner. Keep additive nullable columns until a later cleanup migration.

### Phase 3: Run legal and organization retrieval concurrently

1. In the grounding gateway, derive both retrieval queries before starting
   I/O.
2. For each query unit, start pinned legal retrieval and authorized
   organization-document retrieval together with `Promise.all`.
3. Return `[]` immediately for the organization branch when the cycle has no
   selected evidence, while still retrieving required legal context.
4. Preserve abort propagation and structured settlement. If either branch
   fails, abort or settle the sibling before returning the category failure.
5. Keep the combined context ordering deterministic: legal results first,
   organization-document results second, each ordered by its existing rank.
6. Emit separate branch timings plus the enclosing retrieval-wall-time metric.

Verification:

- Retrieval wall time is approximately the slower branch rather than the sum
  in a controlled delayed-adapter test.
- Legal-only cycles behave identically to the baseline.
- One failed branch does not leave unobserved work or provenance writes.
- Context identity, ranking, citations, grounding validation, and prompt hashes
  are unchanged.

Rollback: restore sequential awaiting inside the grounding implementation;
there is no schema or contract rollback.

### Phase 4: Make revision mutations asynchronous

Use one deep revision-mutation implementation behind the two browser routes.
Add a versioned durable job kind such as `gap-revision-mutation-v1` with a
strict discriminated payload:

```ts
type GapRevisionMutationPayload =
  | {
      mode: "correction";
      sourceRevisionId: string;
      findingId: string;
      correctedStatus: GapFindingStatus;
      correctedEvidenceSufficiency: EvidenceSufficiency;
      requiresReview: boolean;
      reason: string;
      resolutionReason?: string;
      retryNonce: string;
    }
  | {
      mode: "guidance_regeneration";
      sourceRevisionId: string;
      findingId: string;
      reason: string;
      retryNonce: string;
    };
```

Implementation steps:

1. At enqueue time, authorize the actor, validate the source revision/finding,
   validate correction reasons, require the source to be current, and pin the
   operation in an idempotent background job transaction.
2. Prevent more than one active revision-mutation job for the same organization
   and source revision. A partial unique index over active states is preferred
   to a browser-only lock.
3. Register the job with every portable execution adapter and add a dedicated
   worker handler.
4. Move the current AI call and immutable revision creation out of the route
   and into the handler. Reuse the existing category generation, language
   retry, content repair, grounding, and cancellation machinery.
5. Re-check that the source revision is current immediately before persistence.
   If another revision won the race, fail with `GAP_REVISION_NOT_CURRENT` and
   create no revision.
6. In one transaction, persist the replacement revision, findings, evidence,
   review resolution, AI-run terminal state, audit events, job success, and
   `background_job_results.generated_artifact_revision_id`.
7. On failure or cancellation, settle every linked AI run and finalize the job
   without changing the current Gap revision.
8. Change the routes to plural resource names and return `202 { job }`.
   Idempotent replay returns the original job even if it is terminal.
9. In `gap-results-step.tsx`, keep row-level busy state, poll the returned job,
   show its phase, allow cancellation where safe, and refresh the results only
   on terminal settlement.
10. Preserve a compatibility read of the terminal result link so the UI can
    navigate to or refresh the new revision.

Verification:

- The route returns before a delayed provider responds.
- Duplicate idempotency keys return one job; different keys cannot bypass the
  active-mutation constraint.
- Cancellation during retrieval, provider generation, validation, and
  persistence leaves the original revision current.
- A newer source revision causes a safe terminal conflict with no overwrite.
- Worker retry resumes or replays safely and never creates duplicate revisions
  or audit events.
- The provider timeout can exceed an ordinary HTTP request timeout without
  affecting the browser command.

Rollback: stop enqueueing new mutation jobs and temporarily restore the
synchronous route implementation. Existing queued jobs must still be drained
or cancelled by a worker that retains the versioned handler.

### Phase 5: Split post-generation read models by view

1. Define four server interfaces:
   - `getGapWorkflowSummary()` for permissions, lifecycle, counts, current
     identifiers, active job, and only the preparation data required before a
     result exists;
   - `getGapResults(revisionId)` for the chosen revision, findings, blockers,
     plan state, and staleness;
   - `getGapInputs(revisionId)` for the generated questionnaire/evidence/legal
     input snapshot; and
   - `getGapHistory()` for revision history.
2. Refactor `page-reader.ts` so post-generation summary reads do not start
   document-library, answers, history, generated-inputs, accepted/candidate
   findings, and both staleness branches unconditionally.
3. Keep authorization and safe browser projection at each read seam. Never
   expose document-version identifiers that existing browser-contract checks
   forbid.
4. Reuse the existing revision route for Results, and add Inputs and History
   routes with explicit schemas.
5. Server-render Summary plus the requested view. Default to Results; a direct
   `?view=inputs` or `?view=history` URL may server-render that requested slice.
6. On client-side tab changes, fetch a missing slice, abort superseded
   requests, and cache it by revision ID. Do not refetch a cached slice merely
   because the user switches tabs.
7. After a correction or guidance job succeeds, invalidate Summary and Results
   for the new revision. Inputs and History must be loaded under the new
   revision/history cache keys rather than reused accidentally.
8. Preserve empty, loading, error, unauthorized, and stale-revision states for
   every view.

Verification:

- Query-spy tests prove the default Results page does not call Inputs or
  History readers.
- Opening Inputs calls only the Inputs read once per revision.
- Opening History calls only the History read once until invalidated.
- Direct links to every view render correctly without a prior client session.
- Browser-safe projection, query-count, and performance tests pass.

Rollback: restore the composed `getGapAnalysisWorkflow` reader while leaving
the additive slice routes unused.

### Phase 6: Batch embeddings and prepare grounding once

Deepen the grounding module around one generation attempt. The Gap Analysis
caller should provide pinned domain inputs and receive generated categories;
it should not resolve providers, corpus pins, document scope, or embedding
adapters category by category.

1. Add a private grounding-preparation step for one job/analysis-cycle attempt
   that resolves once:
   - AI provider policy and selected provider;
   - grounding policy;
   - pinned corpus releases;
   - authorized organization-document scope;
   - embedding-space configuration and adapter; and
   - cancellation and job ownership context.
2. Build all legal and organization retrieval queries for every category
   before provider generation begins.
3. Deduplicate identical query strings only within the same embedding space.
   Group the remainder by provider, model, dimensions, and purpose.
4. Call the existing multi-value embedding adapter once per group, splitting
   only when a configured provider batch-size limit requires it.
5. Validate result count, order, finiteness, and dimensions before any database
   search.
6. Map embeddings back by stable `(categoryCode, channel, queryHash)` keys.
   Do not rely on completion order.
7. Change legal and organization retrieval internals to accept the prepared
   pins, validated scope, adapter metadata, and precomputed vector. Retain
   lexical scoring and all existing filters.
8. Run independent database searches concurrently under a bounded database
   limiter. Provider concurrency and database-search concurrency must have
   separate limits.
9. Reuse retrieved context for a repair only when the retrieval query and
   pinned-scope hashes match the initial attempt. Persist the same complete
   provenance beneath each AI run that discloses it.
10. Keep the old single-operation grounding entry point as an adapter for
    non-batched workflows until they migrate. Do not expose the prepared
    context through the Gap Analysis module's external interface.

Verification:

- Ten categories with documents produce the expected one-or-few embedding
  batches per embedding space instead of roughly twenty single-query calls.
- Query-to-vector mapping remains correct when the embedding adapter returns
  asynchronously or batching is chunked.
- Retrieval output matches the unbatched implementation for deterministic
  fixtures within the current ranking tolerances.
- Policy, pins, provider selection, and document authorization are resolved
  once per attempt.
- Repair and worker-retry paths preserve idempotency and provenance.
- No batch crosses organizations, jobs, locales, releases, or embedding spaces.

Rollback: route generation through the retained single-operation adapter.
Keep metrics so the regression is visible.

### Phase 7: Add a shared provider limiter and benchmark concurrency

1. Put the concurrency limiter at the provider-attempt seam so initial calls,
   repairs, language retries, Gap generation, revision mutations, and Action
   Plan generation all consume the same permits.
2. Keep category-worker concurrency separate from provider concurrency. A
   worker may prepare or validate another category while waiting for a provider
   permit.
3. Configure the shared maximum with one validated environment setting. Reject
   invalid production values rather than silently creating unbounded work.
4. Ensure the limiter's scope matches deployment reality:
   - for one resident worker process, a process-wide singleton covers all jobs;
   - if multiple worker processes or after-response executors can run provider
     work concurrently, add a deployment-wide permit adapter or keep the
     aggregate worker count constrained until one exists.
5. Benchmark category concurrency `3`, `4`, and `5` with identical pinned
   inputs and provider settings. Capture at least:
   - end-to-end p50/p95;
   - provider and embedding p50/p95;
   - queue wait for provider permits;
   - rate-limit and transient error rate;
   - repair count;
   - token/cost totals;
   - database pool saturation; and
   - cancellation settlement time.
6. Select the lowest concurrency that captures most of the latency improvement
   without materially increasing throttling, errors, cost, or database
   saturation. If evidence is inconclusive, retain `3`.
7. Record the selected limit, benchmark fixture, date, provider, model, worker
   topology, and rollback threshold in a QA artifact under `docs/qa/`.

Verification:

- Two simultaneous analyses cannot exceed the configured shared provider
  permit count within the supported deployment topology.
- Cancellation while waiting for a permit removes the waiter promptly.
- A failed call always releases its permit.
- Raising category concurrency does not change category ordering, validation,
  citation coverage, or final persistence.

Rollback: set category concurrency and the shared provider limit back to `3`;
no data rollback is required.

### Phase 8: Finish browser progress cleanup

1. In the questionnaire, compute both numerator and denominator from required
   questions.
2. Extend the answer-save result with:

   ```ts
   completion: {
     answeredRequired: number;
     totalRequired: number;
     complete: boolean;
   };
   ```

   Compute it in the same transaction/snapshot as the saved answer. Count only
   required questions belonging to the pinned questionnaire revision.
3. Keep `answers` for immediate optimistic selections and `savedAnswers` for
   confirmed selections. Display local progress while saving and confirmed
   saved progress after success. On failure, retain a clear unsaved/error state
   and do not imply that the local choice is durable.
4. Keep server submission validation as the final source of truth for required
   completeness.
5. Do not add `GET /questions-progress`. If collaborative live updates are
   approved later, add a questionnaire-draft read that returns version,
   answers, and completion together.
6. Replace the fixed one-second Action Plan polling loop in
   `gap-results-step.tsx` with `pollJob`, including visibility awareness,
   exponential backoff, retry-after handling, abort cleanup, terminal error
   handling, and final navigation.

Verification:

- Optional questions never inflate either side of the required completion
  ratio.
- Delayed saves show optimistic answered progress plus saving state.
- Failed saves never show the local answer as confirmed saved work.
- Version conflicts refresh the authoritative draft and retain the existing
  conflict messaging.
- Action Plan polling tests use fake timers and prove increasing backoff,
  visibility pause, cancellation, and terminal navigation.

Rollback: the server may continue returning additive completion metadata while
the client falls back to deriving confirmed counts from `savedAnswers`.

## Commit-Sized Delivery Sequence

Keep each slice independently reviewable and deployable:

1. Add cycle domain types and persistence adapters.
2. Add cycle commands and compatibility exports.
3. Add `/cycles` routes and migrate the typed client.
4. Migrate workflow DTO/UI vocabulary; update docs and tests.
5. Add baseline timing metrics and benchmark output.
6. Add nullable job progress persistence and DTO fields.
7. Make heartbeat progress-neutral and add monotonic progress advancement.
8. Wire category/unit progress into generation UI.
9. Parallelize legal/document retrieval with deterministic settlement.
10. Add revision-mutation job contract, enqueue transaction, and handler.
11. Move correction persistence/finalization into the job transaction.
12. Migrate correction and guidance UI to job polling.
13. Split Summary and Results readers.
14. Add Inputs and History readers/routes and lazy tab loading.
15. Add once-per-attempt grounding preparation.
16. Add grouped embedding batches and precomputed-vector retrieval.
17. Add the shared provider limiter.
18. Run and document concurrency benchmarks; change the default only if the
    acceptance evidence supports it.
19. Return questionnaire saved-completion metadata and update the UI.
20. Replace Action Plan's custom polling loop.
21. Remove old reassessment route/export aliases after repository-wide checks.

Do not combine the terminology migration, asynchronous revision mutation, read
split, and embedding batching into one release. Each has a separate rollback
path and a different failure surface.

## Test and Qualification Matrix

### Static and unit verification

- `npm run lint`
- `npm run typecheck`
- `npm run check:i18n`
- naming allowlist test for persistence-only `reassessment` usage;
- retrieval concurrency and deterministic ordering tests;
- embedding batch grouping/mapping/dimension tests;
- job-progress transition and monotonic-update tests;
- questionnaire local/saved completion component tests;
- read-slice query-spy and safe-projection tests; and
- job-polling fake-timer tests.

### Route and worker contracts

- `npm run test:routes`
- `npm run test:worker`
- cycle create/evidence/enqueue/retry/cancel route contracts;
- correction and guidance `202`/idempotency contracts;
- job result-link and progress-detail contracts;
- legacy job DTO parsing without progress detail; and
- portable execution through resident worker, polling, recovery route,
  after-response execution, and scripts.

### Database-backed integration

- legacy reassessment row projected as an analysis cycle;
- active revision-mutation uniqueness;
- source-revision race and rollback;
- atomic revision/job/AI-run/audit finalization;
- heartbeat/progress race using concurrent connections;
- restart/retry/cancellation recovery;
- read-model query counts; and
- batched retrieval authorization and release-pin isolation.

### End-to-end and operational qualification

- `npm run db:smoke:authenticated-gap`
- `npm run db:benchmark:gap`
- initial analysis with no organization documents;
- initial analysis with selected documents;
- later cycle based on an accepted revision;
- category repair and transient provider retry;
- cancellation during preparation and provider generation;
- correction and guidance regeneration through background jobs;
- direct links to Results, Inputs, and History;
- German and English output; and
- concurrency runs at `3`, `4`, and `5` using the same pinned fixture.

Run the full `npm run verify` gate before merging each deployable phase that
changes shared contracts or persistence.

## Performance Acceptance Evidence

Capture a baseline before Phase 3 and compare after Phases 3, 6, and 7. The QA
artifact must contain:

| Metric | Baseline | Concurrent retrieval | Batched preparation | Selected concurrency |
|---|---:|---:|---:|---:|
| total duration p50/p95 | | | | |
| legal retrieval p50/p95 | | | | |
| organization retrieval p50/p95 | | | | |
| retrieval wall time p50/p95 | | | | |
| embedding calls/job | | | | |
| embedding items/call | | | | |
| provider calls/job | | | | |
| provider permit wait p50/p95 | | | | |
| validation/repair time | | | | |
| persistence time | | | | |
| transient/rate-limit failures | | | | |
| cancellation settlement time | | | | |

Accept a performance phase only when correctness and provenance tests remain
green and the measurements show a repeatable improvement. Do not trade a small
latency reduction for higher malformed-output, retry, throttling, or
cancellation-failure rates.

## Rollout

1. Deploy terminology aliases and additive DTO/route changes first.
2. Establish production-like baseline metrics with concurrency `3`.
3. Deploy monotonic progress and concurrent retrieval behind no behavior flag;
   both have direct rollback paths.
4. Deploy asynchronous revision mutation with the versioned worker handler
   enabled before routes begin enqueueing that job kind.
5. Deploy sliced reads and monitor query count, route latency, client error
   rate, and stale-view reports.
6. Deploy batched grounding behind an operational configuration switch that
   can route new jobs back to the single-operation adapter.
7. Run the concurrency qualification and change the default only after its QA
   artifact is reviewed.
8. Remove old route and TypeScript aliases only after logs and repository-wide
   searches show no active caller.

Never remove a versioned job handler while queued, running, retryable, or
recoverable jobs of that kind may still exist.

## Definition of Done

- New domain and UI code consistently uses analysis-cycle terminology.
- Existing database rows and historical revisions require no migration.
- Gap generation still uses one operation per category.
- Legal and organization retrieval run concurrently.
- Shared preparation and embedding batching reduce repeated calls with proven
  query-to-vector correctness.
- Corrections and guidance regenerations return a job immediately and settle
  atomically in the worker.
- `/api/jobs/{jobId}` reports monotonic phase and category-unit progress.
- Results loads independently of Inputs and History.
- Questionnaire progress distinguishes answered from saved and uses required
  questions consistently.
- Action Plan generation uses `pollJob`.
- Concurrency remains `3` unless documented benchmark evidence supports a
  higher value under the deployed shared limit.
- All static, route, worker, database, smoke, bilingual, and performance gates
  pass, and the final QA artifact records the before/after evidence.
