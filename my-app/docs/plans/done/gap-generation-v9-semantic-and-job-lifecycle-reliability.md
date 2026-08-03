# Gap Generation v9 Semantic and Job-Lifecycle Reliability

Status: proposed implementation plan; product, reliability, compatibility, and
rollout decisions confirmed on 2026-07-28.

## Outcome

Ship a new immutable Gap generation contract, `v9`, in an inactive
`nis2-gap/reliability-v2` release. The release must:

1. accept correct German and English wording without weakening the immutable
   missing, partial, or uncertain Gap kind;
2. keep Gap and Action Plan prose style in their prompts and qualification
   suites rather than rejecting natural wording at runtime;
3. repair a rejected category at most once and only for objective structured,
   identity, coverage, citation, provenance, or safety failures;
4. abort and settle every active sibling category before a failed job is
   finalized;
5. prevent an AI processing run from being created beneath a parent job that is
   no longer live;
6. atomically finalize the job, its AI runs, its reassessment draft, and its
   audit event;
7. reconcile any terminal job that still owns a `processing` AI run;
8. expose privacy-safe invariant metrics and diagnostics; and
9. pass the existing five end-to-end qualification scenarios in both German
   and English before activation.

Ship a new immutable Action Plan contract, `v3`, with the same objective
runtime-validation boundary. Existing Gap v8 and Action Plan v2 assessments,
reassessment drafts, generated revisions, and audit history remain pinned to
their existing contracts and are not migrated or retried under v9/v3.

## Incident Evidence

Job `67d29cee-4cf0-4fed-aa3d-1bcaae1d1128` failed with
`GENERATION_CATEGORY_REPAIR_EXHAUSTED`.

The minimized semantic failure was:

- category: `NIS2-RISK-02`;
- question: `gap.risk.critical_dependencies`;
- German question: `Ist bekannt, welche Geschäftsprozesse, IT-Systeme, Daten
  und Dienstleister für den Betrieb besonders wichtig sind?`;
- pinned answer: `not_implemented`;
- deterministic Gap kind: `missing`;
- generated statement: `Die kritischen Geschäftsprozesse, IT-Systeme, Daten
  und Dienstleister sind nicht bekannt.`;
- validator result: `gap_kind_mismatch`.

The v8 German heuristic classifies every `nicht bekannt` occurrence as
uncertainty. In this question context, however, the statement is a direct,
confirmed-negative rendering of the pinned answer. The initial category and
its single repair therefore produced valid natural wording that the validator
rejected.

The same incident also proved a job-lifecycle race:

- the coordinator returned after the first category repair was exhausted;
- sibling category provider calls continued running;
- category diagnostics were written for approximately 11 seconds after the
  background job reached `failed`; and
- four linked AI processing runs remained permanently `processing` because
  they were inserted after failure finalization had already swept the runs
  visible at that time.

## Confirmed Decisions

- Implement the complete reliability fix, not a regex-only patch.
- Introduce immutable Gap contract v9 rather than changing v8 behavior.
- Introduce immutable Action Plan contract v3 rather than changing v2
  behavior.
- Publish `reliability-v2` inactive, qualify it, and activate it only after all
  gates pass.
- Keep one targeted repair attempt per category, limited to objective
  validation failures.
- Pass question and answer semantics into the v9 prompt, while keeping the
  expected Gap kind server-owned and out of natural-language runtime
  validation.
- Preserve the first terminal category error as the job's primary error.
- Record internally aborted siblings as cancelled diagnostics without allowing
  them to replace the primary error.
- Use structured concurrency: abort siblings and wait for all workers to
  settle.
- Require a live parent-job check before inserting a job-linked AI run.
- Finalize generation jobs and their domain state in one database transaction.
- Reconcile orphaned runs through the existing scheduled cleanup job.
- Add and execute an idempotent, dry-run-first operator repair command for
  existing orphaned runs.
- Use the connected disposable database for database-backed integration tests.
- Leave existing v8 assessments and failed drafts pinned to v8.
- Pin Action Plan v3 in `reliability-v2`; keep v2 immutable for releases
  already using it.
- Run the existing five qualification scenarios in both locales, including a
  German translation of the contradictory organization-evidence fixture.

## Scope

### Included

- Gap prompt, response, objective validation, and repair contract v9;
- Action Plan prompt, response, objective validation, and repair contract v3;
- a new `gap-generation-v9` durable job kind;
- structured category cancellation and settlement;
- parent-job gating for AI processing-run creation;
- atomic generation-job failure and cancellation finalization;
- scheduled reconciliation of terminal-parent/processing-child anomalies;
- a one-time operator repair command;
- privacy-safe invariant metrics and audit events;
- deterministic unit and database-backed integration tests;
- bilingual end-to-end Gap and Action Plan qualification;
- publication and gated activation of `nis2-gap/reliability-v2`; and
- documentation of the release and operational cleanup result.

### Excluded

- mutation of Gap v8 prompt hashes, schemas, or validation behavior;
- migration, repinning, or automatic retry of existing v8 assessments;
- a second category repair attempt;
- storing rejected generated prose in diagnostics or audit history;
- weakening grounding, language, citation, cardinality, or review invariants;
- changing historical generated revisions; and
- a dedicated reconciliation scheduler.

## Required Invariants

The implementation is complete only if these invariants hold:

1. A direct negative answer to a localized question can be expressed naturally
   without runtime code reclassifying its wording as epistemic uncertainty.
2. Generated prose cannot change the server-owned Gap kind or Action Plan
   mode.
3. Bilingual qualification demonstrates correct missing, partial, uncertain,
   remediation, and verification wording before activation without making
   those semantic checks live-job rejection gates.
4. Successful categories are never regenerated because a sibling category
   fails.
5. No queued category starts after the first terminal category failure.
6. No active category provider call survives coordinator settlement.
7. No category diagnostic is written after the coordinator returns.
8. The first terminal category failure remains the public job failure.
9. No AI processing run is inserted after its parent job becomes terminal,
   requests cancellation, or loses its live lease.
10. A terminal job has no linked AI processing run in `processing`.
11. Job, run, draft, and audit terminal state either commit together or roll
    back together.
12. Reconciliation and one-time repair are idempotent.
13. Existing v7/v8 and Action Plan v2 artifacts and release hashes remain
    unchanged.
14. Successful Gap v9 findings remain compatible with Action Plan v3.
15. Natural Gap or Action Plan wording never invokes runtime repair merely
    because it omits an approved synonym, keyword, sentence shape, or style
    phrase.

## Target Design

### 1. Preserve v8/v2 and add separate v9/v3 contracts

Do not route v8 through changed semantic logic.

Add v9-specific modules beside the current v8 modules:

- `src/server/gap-analysis/generation-schema-v9.ts`;
- `src/server/gap-analysis/prompt-contract-v9.ts`.

Add v3-specific modules beside the current Action Plan v2 modules:

- `src/server/action-plans/generation-schema-v3.ts`;
- `src/server/ai/generation/action-plan-v3-contract.ts`; and
- `src/server/action-plans/prompt-contract-v3.ts` as the public re-export.

The v9 response JSON shape may remain structurally identical to v8. Its
response-schema version must still be `9` because the objective validation and
repair boundary is part of the immutable output contract. Action Plan v3 may
retain v2's structured modes and fields while versioning its prompt, response
schema, normalization, and validation boundary.

Keep the v8 constants, hashes, schema builder, normalizer, and validator
unchanged. Keep the Action Plan v2 constants, hashes, schema builder,
normalizer, and validator unchanged. Add compatibility tests that snapshot the
v8 and v2 prompt and schema hashes before any refactoring.

### 2. Keep decisions structured and prose validation objective

Pass an explicit semantic context to the v9 prompt:

```ts
type GapStatementSemanticContext = {
  locale: "de" | "en";
  questionStableKey: string;
  questionText: string;
  selectedAnswer:
    | "partially_implemented"
    | "not_implemented"
    | "unsure"
    | "not_applicable";
  expectedKind: "missing" | "partial" | "uncertain";
};
```

The caller derives `expectedKind` deterministically from the pinned answer. The
model never selects or changes it. The Action Plan caller likewise owns
category, priority, final ordering, Gap coverage, `remediation` versus
`verification` eligibility, mandatory citations, and conditional-remediation
assembly. Models write prose around those facts.

Hard runtime validation for v9 and v3 may enforce:

- valid structured output with no extra fields;
- exact supplied Gap keys, action modes, coverage, and cardinality;
- known, allowlisted citation IDs and server-assigned mandatory citations;
- nonblank customer-visible fields with generous character ceilings;
- no URLs, raw internal IDs, or invented citation IDs in prose;
- the pinned output locale; and
- grounding, authorization, cancellation, and persistence invariants.

Hard runtime validation must not reject or repair prose because it:

- omits an approved missing, partial, uncertainty, verification, or
  completed-state keyword;
- uses an unlisted but correct synonym or sentence construction;
- exceeds a preferred word count or sentence count while remaining within the
  generous character ceiling;
- contains a verb caught by a broad recommendation, action-content,
  legal-language, example-leakage, or verification-first regex; or
- is judged by a second AI call to semantically agree or disagree with the
  server-owned kind or mode.

Do not add `gap-style-v9.ts` or reuse `gap-style.ts` to infer Gap kind from
prose. Do not route Action Plan v3 through the lexical gates in
`action-style.ts`. Preserve the existing deterministic trigger-policy behavior
for `fully_implemented` and `not_applicable`; test both all-not-applicable and
mixed-category policy contexts.

Concise one-sentence Gap statements, imperative Action Plan titles, preferred
word counts, verification-first phrasing, absence of legal exposition, and
not copying prompt examples remain explicit prompt instructions. Score these
properties in bilingual release qualification and monitor them after
activation. They do not reject an individual live generation.

### 3. Repair objective contract failures only

Keep one repair attempt. Use prose-free issues for every objectively rejected
path:

```ts
type GenerationRepairIssueV9 = {
  code: GenerationIssueCode;
  path: Array<string | number>;
};
```

The repair prompt must provide only stable objective issue codes and field
paths, request the complete corrected category object, and tell the model not
to alter valid structured facts. Eligible issues include invalid schema,
unknown or missing keys, incomplete coverage, invalid mode, wrong cardinality,
unknown citations, raw IDs, URLs, blank fields, and character-ceiling
violations.

Never invoke repair for word choice, synonyms, semantic-kind wording,
sentence count, word count, imperative style, legal exposition,
verification-first phrasing, or example resemblance.

The rejected category candidate may remain provider-visible during repair, as
it is today. Persisted diagnostics must continue to contain only allowlisted
issue codes and sanitized paths. They must not persist generated prose,
question text, source excerpts, or correction examples.

### 4. Give the coordinator structured concurrency

Refactor `coordinateCategoryGeneration` so it owns an internal failure
controller:

1. Combine the caller signal and the internal failure signal.
2. Start at most the configured number of worker loops.
3. On the first terminal category failure:
   - store that error exactly once as `primaryFailure`;
   - stop workers from dequeuing new tasks; and
   - abort the internal failure controller.
4. Treat abort errors from sibling work as secondary cancellation results.
5. Await `Promise.allSettled(workerPromises)`.
6. After all workers settle, throw `primaryFailure`.
7. If there is no primary failure, propagate external user cancellation.
8. Return success only after every worker has settled.

Do not use a rejecting `Promise.all` boundary that returns while siblings are
still active.

The current controller created in Gap category generation is not sufficient
because nothing aborts it on coordinator failure. Move failure ownership into
the shared coordinator so Gap and Action Plan category workflows receive the
same guarantee.

Diagnostic ordering requirements:

- the failed repair receives `disposition: "rejected"`;
- active siblings aborted because of that failure receive
  `disposition: "cancelled"`;
- the sibling diagnostics are recorded before coordinator rejection; and
- the sibling abort code never replaces
  `GENERATION_CATEGORY_REPAIR_EXHAUSTED`.

### 5. Gate job-linked AI run creation

Add one server-side creation seam for job-linked `ai_processing_runs`.

In the same transaction that inserts the run:

1. lock the parent `background_jobs` row;
2. require `state = 'running'`;
3. reject `cancellation_requested_at is not null`;
4. require a non-expired lease; and
5. insert the child run only while the locked parent remains live.

The gate applies only when `jobId` is present. Non-job synchronous AI
operations preserve their current behavior.

Map failed checks deliberately:

- cancellation requested or cancelled parent:
  `GENERATION_CANCELLED`;
- failed or succeeded parent: terminal job-ownership failure;
- expired/missing lease: transient worker-ownership failure only when the job
  state machine can safely retry it.

Do not hold this transaction open during provider I/O. The row lock guarantees
the child insert is ordered before or after parent terminalization. Structured
concurrency and atomic finalization handle a child that was validly inserted
immediately before a sibling failed.

### 6. Finalize generation failure atomically

The worker currently calls generic `failJob(...)` and then separately calls
`recordWorkerDomainFailure(...)`. Replace that split for Gap and Action Plan
generation with a generation-specific transactional finalizer.

For a terminal failure, one transaction must:

1. lock and verify the leased running job;
2. mark the background job `failed`;
3. clear its lease and set its safe error;
4. mark every linked `processing` AI run `failed`;
5. set a safe run error and `completedAt`;
6. update the linked Gap reassessment draft to `failed`;
7. write the privacy-safe domain audit event; and
8. commit once.

For cancellation, apply the corresponding cancelled job/draft state and safe
run cancellation code in the same transaction.

For a transient retry, preserve the existing retry semantics:

- requeue only failures classified as transient;
- do not terminalize the draft;
- close the failed provider attempt safely; and
- preserve recoverable accepted category runs according to their idempotency
  contract.

Generic non-generation jobs may continue using the generic finalizer.

Success already persists the artifact, marks all category runs succeeded,
updates the draft, completes the job, and writes result/audit records in one
transaction. Add an invariant assertion there rather than creating a second
success path.

### 7. Reconcile terminal parents with processing children

Extend the existing cleanup job with a bounded reconciliation step.

Find `ai_processing_runs` where:

- `status = 'processing'`;
- `job_id` is non-null; and
- the parent job is `failed`, `cancelled`, or `succeeded`.

For each bounded batch:

- lock/recheck the candidate rows;
- update only rows still in `processing`;
- set `completedAt`;
- use a dedicated safe code such as `PARENT_JOB_TERMINATED`, with a distinct
  cancellation code when appropriate;
- write one privacy-safe reconciliation audit event per parent job or batch;
  and
- increment the reconciliation metric.

A succeeded parent with a processing child is also an invariant violation. Do
not silently call the child succeeded because its output may never have been
included in the persisted artifact.

The reconciliation step must be idempotent and safe under concurrent cleanup
workers. Use bounded batches and existing cleanup scheduling rather than a new
scheduler.

### 8. Add a dry-run-first operator repair command

Add an operator command and package script, for example:

```text
npm run db:repair:orphan-ai-runs -- --dry-run
npm run db:repair:orphan-ai-runs -- --apply
```

Requirements:

- default to dry-run when neither flag is supplied;
- print only run IDs, parent job IDs, parent states, timestamps, and proposed
  safe codes;
- never print prompts, generated output, source excerpts, or organization
  document content;
- recheck every row under lock during apply;
- update only rows still matching the invariant violation;
- write the same audit shape used by scheduled reconciliation;
- report selected, changed, skipped, and remaining counts; and
- succeed harmlessly when executed more than once.

After deployment, run dry-run, review the exact four known rows, apply the
repair, and prove that the incident job has zero linked `processing` runs.

Do not repin or retry its v8 reassessment draft.

### 9. Add invariant observability

Emit privacy-safe metrics for:

- category initial acceptance;
- category repair requested, accepted, and exhausted;
- sibling provider calls aborted after a terminal category failure;
- time from primary category failure to final sibling settlement;
- terminal jobs with linked processing runs;
- category diagnostics created after parent `finishedAt`;
- orphan runs reconciled by parent state; and
- atomic finalization failures or rollbacks.

Add a worker-health invariant query that alerts when:

- a terminal job has a linked processing AI run; or
- an `ai_generation.category_diagnostic` event is created after the parent
  job's `finishedAt`.

Logs and metrics may include job ID, run ID, category code, phase, safe issue
code, state, and duration. They must not include generated prose, prompts,
questionnaire excerpts, organization evidence, or signed URLs.

## Prompt, Validation, and Audit Locations

Prompt text remains immutable, code-defined source rather than mutable database
content:

- Gap v8 currently lives in
  `src/server/gap-analysis/prompt-contract-v8.ts`; add v9 beside it;
- Gap v8 response validation currently lives in
  `src/server/gap-analysis/generation-schema-v8.ts` and lexical wording checks
  in `src/server/gap-analysis/gap-style.ts`; v9 must use its new objective
  schema and must not call the lexical kind validator;
- Action Plan v2 currently lives in
  `src/server/ai/generation/action-plan-v2-contract.ts`,
  `src/server/action-plans/generation-schema-v2.ts`, and
  `src/server/action-plans/action-style.ts`; add v3 beside those modules and do
  not route it through the lexical style validator; and
- shared objective repair orchestration remains in
  `src/server/ai/generation/category-coordinator.ts`.

`gap_analysis_releases` pins the Gap and Action Plan prompt names, versions,
template hashes, and response-schema versions. `ai_processing_runs` stores the
selected provider/model, prompt metadata, rendered-input hash, response-schema
version, validated structured output, lifecycle state, token accounting, and
provenance metadata. `ai_processing_run_context` stores the exact admitted
questionnaire, legal, and organization-evidence excerpts linked to each run.
Do not store a second mutable copy of the prompt in the database.

## Contract and Persistence Changes

### Job kind

Add `gap-generation-v9` everywhere versioned Gap job kinds are enumerated:

- job-kind helpers and type guards;
- worker handler dispatch;
- route/job DTO tests;
- active-job uniqueness and typed-result database checks;
- SQL integrity triggers;
- cancellation and domain-state classification; and
- release qualification tests.

Keep `gap-generation`, `gap-generation-v8`, and historical readers supported.

### Release

Publish a new release:

```text
releaseCode: nis2-gap
versionLabel: reliability-v2
gapPromptVersion: 9
gapResponseSchemaVersion: 9
actionPlanPromptVersion: 3
actionPlanResponseSchemaVersion: 3
```

The aggregate hash must differ from `reliability-v1`. Publication must not
change the active release pointer.

### Schema

Prefer existing columns for the fix:

- `background_jobs.state`, lease, safe error, and timestamps;
- `ai_processing_runs.job_id`, status, safe error, and completion timestamp;
- `gap_reassessment_drafts.generation_job_id`, status, and completion
  timestamp; and
- `audit_events`.

Add a schema migration only if query profiling proves the reconciliation join
needs an additional partial index. If needed, add a narrow index supporting
`ai_processing_runs(job_id) where status = 'processing'` and verify its plan.

## Test-Driven Implementation Sequence

### Phase 0: Lock the incident and v8 compatibility

1. Add a regression fixture for the exact German question, answer, and
   statement from the incident.
2. Demonstrate that the v8 validator rejects it.
3. Snapshot v8 and Action Plan v2 prompt, response-schema, and template hashes.
4. Add a failing v9 expectation that accepts the direct confirmed-negative
   wording.
5. Keep the incident database trace query as an operator diagnostic, not as a
   normal test dependency.

Exit gate:

- the v9 incident test is red before implementation;
- v8 compatibility snapshots are green; and
- no production or connected development data is mutated.

### Phase 1: Implement Gap v9 and Action Plan v3 contracts

1. Add the v9 prompt, schema, normalizer, and objective validator.
2. Add the v3 prompt, schema, normalizer, and objective validator.
3. Pass localized question text, pinned answer semantics, and immutable Gap
   kind into the v9 prompt rather than a post-generation wording validator.
4. Keep Gap kinds and Action Plan modes, coverage, priority, ordering, and
   mandatory citations server-owned.
5. Add one focused repair path for objective issue codes and field paths.
6. Keep persisted diagnostics allowlisted and prose-free.
7. Route only v9/v3 releases through the new validators.

Focused tests:

- German direct `nicht bekannt` response for a `not_implemented` known-state
  question is accepted as missing;
- equivalent natural German and English Gap wording succeeds without matching
  an approved missing, partial, or uncertainty keyword list;
- natural Action Plan verification and remediation wording succeeds without
  matching approved completed-state or verification-first verbs;
- preferred sentence count, word count, imperative style, legal-exposition
  avoidance, and example resemblance do not trigger runtime repair;
- unknown IDs, missing coverage, invalid modes, wrong cardinality, invented
  citations, URLs, raw IDs, blanks, and excessive character lengths fail;
- one repair receives only objective issue codes and field paths;
- prose wording never invokes a second semantic-validation model call; and
- v8/v2 behavior and hashes remain unchanged.

### Phase 2: Add structured category concurrency

1. Add the coordinator-owned failure controller.
2. Combine it with external cancellation.
3. stop dequeueing on the first terminal failure.
4. Abort active siblings.
5. Await all worker promises with `allSettled`.
6. Preserve primary-error precedence.
7. Verify no diagnostic callback runs after rejection.

Focused tests:

- one category exhausts repair while another provider call is active;
- the active sibling observes abort;
- coordinator rejection waits until active count is zero;
- queued categories never start;
- the rejected category error remains primary;
- sibling cancellations receive cancelled diagnostics;
- external operator cancellation still returns the cancellation failure;
- accepted categories are not regenerated; and
- successful ordering and bounded concurrency remain unchanged.

### Phase 3: Add parent gating and atomic finalization

1. Introduce the job-linked AI-run creation transaction.
2. Add live state, cancellation, and lease checks.
3. Introduce atomic generation failure finalization.
4. Introduce atomic generation cancellation finalization.
5. Route Gap and Action Plan worker failures through the new seam.
6. Preserve generic job behavior and transient retry rules.

Database-backed integration tests must use records created by the test in the
connected disposable database:

- live running parent permits child insertion;
- queued, failed, succeeded, cancelled, and cancellation-requested parents
  reject insertion;
- expired lease rejects insertion;
- terminal finalization updates job, all linked processing runs, draft, and
  audit event;
- an injected transaction failure rolls everything back;
- cancellation uses the cancellation code without overwriting a prior primary
  terminal error;
- transient retry does not terminalize the draft; and
- successful finalization leaves no processing child.

Every integration test must clean up only its own uniquely prefixed or
ID-tracked fixture records.

### Phase 4: Add reconciliation and operator repair

1. Implement the bounded reconciler.
2. Call it from the existing cleanup job.
3. Add metrics and audit events.
4. Add the dry-run-first operator command and package script.
5. Verify any required partial index with a query plan.

Database-backed tests:

- failed, cancelled, and succeeded terminal parents are reconciled safely;
- running and retryable queued parents are untouched;
- the second reconciliation run changes zero rows;
- concurrent reconcilers do not double-update or double-audit;
- operator dry-run changes nothing;
- operator apply matches the dry-run target set after recheck;
- privacy-sensitive fields never appear in command output; and
- the invariant query returns zero after repair.

### Phase 5: Add v9/v3 job and release support

1. Add `gap-generation-v9` to application and worker job-kind handling.
2. Update database integrity SQL and schema-contract tests.
3. Add v9 and v3 prompt/response metadata to the release compiler and
   publisher.
4. Add release-loader routing for v9/v3 while retaining v7/v8 and Action Plan
   v2 reads.
5. Publish `nis2-gap/reliability-v2` without activation.
6. Verify aggregate hashes, question mappings, legal mappings, localization,
   and Action Plan v3 compatibility metadata.

Exit gate:

- v7/v8 historical loading passes;
- v8 and Action Plan v2 immutable hashes are unchanged;
- v9 jobs enqueue and dispatch correctly;
- database integrity checks accept v9 and reject unknown job kinds; and
- the active release pointer still identifies `reliability-v1`.

### Phase 6: Make the five scenarios bilingual

Refactor `evals/manual-gap-action-plan-evaluation.ts` so scenario identity and
locale are independent.

Retain the existing five scenarios:

1. mature baseline;
2. absent controls;
3. mixed maturity;
4. uncertain evidence; and
5. contradictory backup evidence.

Run each scenario in both `en` and `de`, producing ten complete workflows.

Requirements:

- use the same answer pattern and expected statuses in both locales;
- load `reliability-v2`;
- localize scenario titles, manual correction text, and generated fixture
  metadata where customer-visible;
- provide equivalent English and German synthetic backup evidence;
- preserve the same contradiction and review behavior;
- continue through Gap review/correction where the scenario requires it;
- generate and activate Action Plan v3;
- assert pinned output locale on Gap and Action Plan artifacts;
- assert no stale job errors;
- assert no terminal parent owns a processing run; and
- record category first-pass, repair, latency, and token summaries by locale.

Add natural German and English phrasing outside the old Gap and Action Plan
runtime keyword lists. Review concision, sentence count, imperative style,
verification-first language, legal exposition, example copying, and semantic
consistency as offline qualification dimensions. These findings can block
release activation at the reviewed fixture or aggregate level, but they must
not reject or repair an individual live generation.

Do not replace these scenarios with a 155-question-option matrix. Existing unit
tests may remain, but this ten-run bilingual matrix is the live activation
qualification.

### Phase 7: Qualify, repair, and activate

1. Run the complete automated verification suite.
2. Run database integrity and reconciliation integration tests against the
   connected disposable database.
3. Run the ten live bilingual workflows against inactive `reliability-v2`.
4. Review all German and English customer-visible output.
5. Confirm Action Plan v3 structured compatibility and prose qualification.
6. Run the orphan repair command in dry-run mode.
7. Confirm the four known incident runs are the expected targets.
8. Apply the repair and verify zero remaining violations.
9. Record the repair counts and qualification summary in a QA document.
10. Activate `reliability-v2`.
11. Run a post-activation Gap smoke test for a newly created assessment.

Do not migrate or retry existing v8 assessments after activation.

## Verification Commands

Run targeted checks during implementation:

```text
npx vitest run tests/generation-contract-v8-v2.test.ts
npx vitest run tests/generation-reliability-runtime.test.ts
npx vitest run tests/generation-job-kind-versioning.test.ts
npx vitest run tests/gap-generation-job-contract.test.ts
```

Add focused v9 and database integration test files rather than overloading
unrelated suites.

Before publication:

```text
npm run lint
npm run typecheck
npm test
npm run check:i18n
npm run db:verify:integrity
git diff --check
```

Before activation:

```text
npm run db:publish:gap
npm run db:smoke:gap
npm run db:repair:orphan-ai-runs -- --dry-run
```

The exact live qualification command should reuse the manual evaluation
harness with `--gap-release-version reliability-v2` and emit ten locale-specific
case artifacts plus one summary.

## Acceptance Gates

### Semantic correctness

- The exact German incident wording succeeds under v9.
- Missing, partial, uncertain, fully implemented, and not-applicable policy
  behavior remains deterministic and server-owned.
- Natural Gap and Action Plan wording does not require an approved synonym,
  keyword, sentence shape, or style phrase.
- Repair receives only objective structured issue codes and remains limited to
  one attempt.
- Word choice, sentence count, word count, imperative style, legal exposition,
  example resemblance, and AI-judged semantic consistency never invoke
  runtime repair.
- No grounding, citation, language, cardinality, or review rule is weakened.

### Job lifecycle

- Active sibling provider calls are aborted after the first terminal category
  failure.
- Coordinator rejection occurs only after every sibling settles.
- No queued category starts after terminal failure.
- The first terminal failure remains the job's safe error.
- No diagnostic is written after job finalization.
- No linked processing run remains beneath a terminal job.

### Transaction and recovery

- Parent gating rejects every non-live job state.
- Job, run, draft, and audit terminalization is atomic.
- Cleanup reconciliation is bounded, concurrent-safe, and idempotent.
- Dry-run and apply target the same rows after transactional recheck.
- The four existing incident orphans are closed with safe codes.
- Existing v8 domain artifacts and drafts are not migrated.

### Compatibility

- Gap v7/v8 historical artifacts remain readable.
- Gap v8 and Action Plan v2 hashes and validation behavior remain unchanged.
- New work pins v9/v3 only through `reliability-v2`.
- Action Plan v3 consumes v9 Gap findings without schema or provenance loss.
- All ten bilingual end-to-end workflows pass.

### Observability and privacy

- Invariant metrics and worker-health checks are emitted.
- A terminal-parent/processing-child anomaly triggers an alert.
- Reconciliation activity is auditable.
- Diagnostics, logs, metrics, and operator output contain no generated prose,
  prompts, source excerpts, organization evidence, credentials, or signed
  URLs.

### Release

- `reliability-v2` is published before activation.
- The active pointer remains unchanged during qualification.
- Activation occurs only after automated, database, bilingual live, content,
  and orphan-repair gates pass.
- A newly created post-activation assessment completes Gap v9 and Action Plan
  v3 successfully.

## Commit Plan

Keep commits independently reviewable and green whenever possible:

1. `test: lock gap v8 hashes and reproduce German kind mismatch`
2. `feat: add objective gap v9 and action plan v3 contracts`
3. `fix: settle and abort sibling category generation`
4. `fix: gate ai runs and atomically finalize generation jobs`
5. `feat: reconcile and repair orphan ai processing runs`
6. `feat: add generation lifecycle invariant telemetry`
7. `feat: add gap-generation-v9 job and release support`
8. `test: run five gap action-plan scenarios in both locales`
9. `docs: record reliability-v2 qualification and orphan repair`
10. `ops: activate nis2 gap reliability-v2`

Do not combine publication, live qualification, orphan repair, and activation
into one opaque commit or operator step.

## Rollback

If post-activation metrics or content review fails:

1. repoint the active release to `reliability-v1`;
2. allow already-running v9/v3 generation jobs to settle or cancel them
   through the normal job lifecycle;
3. retain every v9/v3 run, diagnostic, audit event, and generated revision;
4. do not delete the published `reliability-v2` release;
5. keep structured concurrency, atomic finalization, reconciliation, and the
   repaired orphan state—they are runtime safety improvements independent of
   release activation; and
6. diagnose and publish a new immutable release rather than mutating v9.

## Documentation Deliverables

Update:

- the Gap and Action Plan reliability qualification report;
- the current Gap workflow product documentation;
- AI contract/version documentation;
- job and worker architecture documentation;
- database integrity and cleanup runbooks; and
- the implementation-plan index when this plan moves from pending to done.

The final QA report must include:

- v9 and v3 contract metadata plus v8/v2 compatibility hashes;
- ten bilingual scenario outcomes;
- first-pass and repair rates by locale;
- workflow and provider latency;
- token usage;
- terminal-parent/processing-child invariant results;
- dry-run and applied orphan-repair counts;
- confirmation that v8 assessments were not migrated; and
- the release activation decision and timestamp.
