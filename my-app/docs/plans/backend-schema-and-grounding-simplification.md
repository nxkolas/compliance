# Backend Schema and Grounding Simplification Plan

## Status

Completed on 3 September 2026. The later backend module-organization refactor
moved several implementation paths; the paths below remain a historical record
of the plan at the time it was approved.

## Objective

Reduce dead and duplicated backend state while preserving the current product:

- keep every existing API endpoint;
- keep browser-relayed and server-direct self-hosted AI;
- keep ENISA guidance behavior;
- keep the Vercel-compatible Postgres job runtime without a standalone worker;
- preserve immutable compliance and AI audit evidence; and
- make Drizzle `src/db/schema.ts` the schema source of truth.

The target is a smaller schema with one authoritative relationship for each
fact, not a redesign of the application.

## Confirmed decisions

- Use one shared, code-owned NIS2 grounding policy for Gap Analysis, Gap
  contradiction resolution, and Action Plan generation.
- Keep workflow-specific prompts, output contracts, query units, and
  `ai_processing_runs.operation_kind` values.
- Do not create a second grounding policy until a workflow needs a genuinely
  different corpus family, jurisdiction, provider rule, or authority guarantee.
- Keep guidance sources, chunks, provision bindings, retrieval limits, prompt
  inclusion, and non-citable behavior unchanged.
- Remove only the unused guidance `search_vector` column and index; current
  guidance retrieval is provision-binding based and never reads either.
- Store Action Plan result text and suggested evidence separately.
- Keep all current route handlers, including routes with no current browser
  caller.
- Delete only internal code proven to have no caller.
- Use explicit TypeScript DTOs and explicit runtime schemas at HTTP trust
  boundaries. Do not replace genuinely untrusted values such as AI payloads,
  audit metadata, or error details with unsafe casts.
- Use the after-response drain plus the authenticated Vercel cron recovery
  route. Do not deploy or retain a standalone worker entry point.
- Do not hand-author production migrations in this iteration. Apply the Drizzle
  schema to a disposable development database and recreate seed data.
- Format only files touched by the implementation; do not run a repository-wide
  style rewrite.

## Grounding policy architecture

### Decision: one shared policy

The grounding module should expose one small interface that resolves the
organization's provider and the shared NIS2 legal scope. Gap and Action Plan
callers supply the behavior that actually differs: query units, prompts, output
contracts, locale, and run operation kind.

Target interface:

```ts
prepareGroundingOperation({
  organizationId,
  workflowReleaseId,
  jobId,
})
```

Remove the `operation: "gap_analysis"` parameter and the one-entry
`groundingPolicyDefinitions` registry. Name the single constant for what it is,
for example `nis2GroundingPolicy`, and keep it inside the grounding module.

This produces a deep module: callers learn one interface while provider
selection, legal snapshot pinning, legal retrieval, organization evidence,
guidance retrieval, prompt construction, validation, and run provenance remain
inside its implementation.

### When to split it later

Introduce an explicit grounding profile only when at least one of these becomes
true:

- Action Plans use different legal corpus families or jurisdictions from Gap;
- one workflow permits authority tiers that another must reject;
- provider selection differs by workflow;
- retrieval or grounding rules require independent versioning and rollout; or
- tests need two real policy adapters because behavior actually varies.

Different prompts and response schemas do not justify another policy; those are
already workflow-specific inputs to the same grounding interface.

## Target schema

### Action Plan output

Change `action_plan_items`:

- rename `description` to `result`;
- add non-null `suggested_evidence` JSON containing `string[]`;
- add a database check that the JSON value is an array; and
- delete `action-description.ts` and its delimiter-based parser tests.

Generation writes the already-validated `result` and `suggestedEvidence`
values directly. Readers, report rendering, and the UI project those columns
without reparsing localized prose.

### Dead columns

Remove:

| Table | Columns | Reason |
| --- | --- | --- |
| `ai_processing_runs` | `cost_amount`, `cost_currency` | Never populated or read. Token counts remain. |
| `idempotency_records` | `error_code` | Never written, read, or constrained. |
| `guidance_chunks` | `search_vector` | Retrieval is binding-driven; remove its GIN index too. |
| `organization_model_settings` | `id` | No reference uses it; `organization_id` is the natural one-to-one identity. |
| `api_rate_limit_windows` | `updated_at` | Write-only transient state. |
| `ai_processing_runs` | `generation_attempt_key` | It is required to equal `idempotency_key`; the existing idempotency uniqueness already enforces call identity. |

Make `organization_model_settings.organization_id` the primary key. Update the
AI generation-attempt check and remove the partial
`ai_processing_runs_generation_attempt_unique` index. Keep:

- `idempotency_key` as the unique provider-call identity;
- `generation_reservation_key` to group repair/retry candidates;
- `durable_execution_attempt` for the job attempt;
- `provider_attempt` for category/provider repair; and
- `attempt_count` for language-validation attempts inside one call.

### Normalize duplicated relationships

Use the shortest authoritative path for each relationship:

```text
gap_item -> finding -> output_revision
action_plan_item_gap -> action_plan_item -> action_plan
resolved_finding -> original_finding -> original_output_revision
legal_chunk -> processing_generation -> rendition -> source_version -> source
snapshot_member -> processing_generation -> rendition -> source_version -> source
published artifact -> generation_job -> ai_processing_runs
```

Apply these changes:

- remove `gap_items.output_revision_id`;
- remove `action_plan_item_gaps.action_plan_id`;
- remove `gap_findings.original_output_revision_id` and add a tenant-safe
  self-reference from `(organization_id, original_finding_id)` to the original
  finding;
- remove `legal_source_processing_generations.source_version_id` because its
  rendition identifies the version;
- remove `legal_source_chunks.source_version_id` and `rendition_id` because the
  processing generation identifies both;
- remove `legal_corpus_snapshot_members.source_version_id` and `rendition_id`;
- key snapshot members by `(snapshot_id, processing_generation_id)` and retain
  their deterministic `position`;
- validate snapshot uniqueness by underlying legal source ID in the snapshot
  module before insertion; and
- update corpus reads and exports to join through the normalized hierarchy.

Do not replace these columns with new cached ancestor columns or JSON lineage.
The global legal corpus is small enough for indexed joins, and the normalized
path cannot contradict itself.

### Make job lineage authoritative

Remove the incomplete single-run pointers:

- `analysis_output_revisions.ai_processing_run_id`;
- `action_plans.ai_processing_run_id`.

Gap and Action Plan generation can produce several selected AI runs, one per
category. Keep `generation_job_id` as the artifact's lineage pointer and find
all runs through `ai_processing_runs.job_id`.

Add tenant-safe composite foreign keys from organization-owned generation-job
columns to `(background_jobs.organization_id, background_jobs.id)` where the
schema currently stores a job UUID without that guarantee. Use the existing
unique background-job identity; do not add a run-link table.

Update the Gap workflow error projection to read the generation job's stable
failure state instead of one arbitrary AI run. Keep audit-event
`groundedRunIds` metadata as a human-readable snapshot, not as the relational
source of truth.

### Applicability projections

Keep `analysis_output_revisions.result`, `outcome_code`, and `gap_eligible`:

- `result` is the immutable full audit/display snapshot;
- `outcome_code` serves dashboard and progress reads; and
- `gap_eligible` serves the Gap prerequisite check.

Keep `jurisdiction_code` in this iteration because report rendering reads it.
Do not broaden this refactor into an applicability-result redesign.

## Implementation sequence

### 1. Lock behavior with focused tests

- Add an Action Plan persistence test proving result text and evidence strings
  round-trip without delimiter or locale parsing.
- Add schema tests for the target removed columns and normalized foreign keys.
- Add corpus tests proving normalized joins return the same source version,
  rendition, processing generation, chunks, and snapshot manifest.
- Add job-lineage tests proving a generated Gap or Action Plan resolves every
  selected AI run through its generation job.
- Keep existing browser-relay, re-embedding, grounded-generation, report, RLS,
  and route tests as regression coverage.

### 2. Simplify the grounding module

- Replace the one-entry policy registry with a single code-owned NIS2 policy.
- Remove `operation` from grounding preparation and execution inputs.
- Keep `runOperationKind` because it classifies persisted AI runs.
- Update Gap, contradiction-resolution, and Action Plan callers.
- Keep guidance retrieval unchanged.
- Update grounding tests to exercise the module through its public interface,
  not the deleted registry.

Primary files:

- `src/server/ai/grounding/policy-definition.ts`
- `src/server/ai/grounding/policy.ts`
- `src/server/ai/grounding/gateway.ts`
- `src/server/ai/grounding/types.ts`
- `src/server/gap-analysis/atomic-gap-generation.ts`
- `src/server/action-plans/generation-service.ts`
- focused grounding tests

### 3. Store structured Action Plan output

- Change the Drizzle Action Plan item columns.
- Write structured values directly during publication.
- Update the Action Plan read DTO, report snapshot, renderer, UI, seeds, and
  qualification script.
- Delete the serializer/parser and replace its test with persistence/read-model
  coverage.

Primary files:

- `src/db/schema.ts`
- `src/server/action-plans/generation-service.ts`
- `src/server/action-plans/service.ts`
- `src/server/action-plans/action-description.ts` (delete)
- `src/server/reports/*`
- Action Plan and report tests

### 4. Remove dead state

- Remove the six dead column groups and their indexes/check references.
- Simplify the generation attempt input so `idempotencyKey` is the one call
  identity.
- Remove writes to the rate-limit timestamp.
- Update schema/integrity verification expectations.
- Do not add replacement abstractions or compatibility aliases.

Primary files:

- `src/db/schema.ts`
- `src/server/ai/grounding/gateway.ts`
- `src/server/ai/generation/*`
- `src/server/gap-analysis/atomic-gap-generation.ts`
- `src/server/action-plans/generation-service.ts`
- `src/server/rate-limit/database-store.ts`
- `src/server/operator-commands/verify-database-integrity.ts`
- related schema and generation tests

### 5. Normalize lineage in one schema cutover

- Remove the duplicated Gap, Action Plan, legal-corpus, and single-run columns.
- Update `src/db/relations.ts` to expose only the authoritative parent path.
- Replace direct duplicate-column filters with joins.
- Preserve ordering and exact manifest hashes.
- Update corpus provisioning, validation, activation, retrieval, export, and
  qualification code.
- Add the tenant-safe original-finding and generation-job constraints.

Primary files:

- `src/db/schema.ts`
- `src/db/relations.ts`
- `src/server/corpus/processing-service.ts`
- `src/server/corpus/snapshot-service.ts`
- `src/server/corpus/validation.ts`
- `src/server/ai/grounding/legal-retrieval.ts`
- `src/server/operator-commands/provision-legal-corpus.ts`
- `src/server/operator-commands/bind-gap-corpus-provisions.ts`
- `scripts/export-active-legal-corpus-manifests.ts`
- `scripts/qualify-authenticated-grounded-workflow.ts`
- `src/server/gap-analysis/analysis-cycle-service.ts`
- `src/server/gap-analysis/contradiction-resolution-service.ts`
- `src/server/gap-analysis/workflow-reader.ts`
- `src/server/action-plans/generation-service.ts`

### 6. Replace loose browser DTOs and delete dead internals

- Define explicit DTOs for the current Gap workflow, revision, inputs, history,
  cycle, findings, applicability questionnaire, overview, and answers.
- Give the HTTP schemas those exact DTO types and explicit shapes instead of
  `z.unknown()` or loose Drizzle-row spreads.
- Retain `unknown` for client-inference output, audit metadata, error details,
  and other genuinely untrusted/open-ended payloads.
- Remove only caller-free internal code confirmed by repository search:
  `src/index.ts`, `src/server/api/concurrency.ts`, the obsolete questionnaire
  module, the stale Gap performance-index verifier, `getActionPlanDetail`, and
  `updateOrganizationDocument`.
- Re-run the route inventory before deletion and preserve every file under
  `app/api`.

Primary files:

- `src/contracts/gap-analysis/generation.ts`
- `src/contracts/applicability-check/index.ts`
- `src/client/gap-analysis.ts`
- Gap and applicability read modules
- confirmed dead internal files and their barrel exports
- contract and route tests

### 7. Keep only Vercel-compatible job entry points

- Keep `src/server/job-execution`, after-response scheduling, Postgres leasing,
  and `/api/internal/jobs/drain`.
- Remove `src/worker/main.ts`, `src/worker/runtime.ts`, and the `worker*` package
  scripts. Rename `test:worker` to `test:jobs` because it tests the portable job
  module, not a deployment worker.
- On Vercel Pro/Enterprise, change the recovery schedule to
  `*/5 * * * *` (UTC).
- If the deployment is on Hobby, retain the daily schedule; do not add an
  external scheduler or worker as a workaround.
- Keep `CRON_SECRET`, the 50-job ceiling, the 4:45 drain deadline, and job lease
  semantics unchanged.

### 8. Update documentation and format touched files

- Correct the route map without removing routes.
- Document real envelope exceptions and all `202 Accepted` routes.
- Correct auth and legal-authority wording.
- Document one shared grounding policy and separate workflow contracts.
- Update database documentation for structured Action Plan output and
  normalized legal/job lineage.
- Update job documentation to describe only after-response and cron execution.
- Run the formatter/linter only across touched files.

Primary documentation:

- `docs/backend-architecture/api/route-map.md`
- `docs/backend-architecture/api/conventions.md`
- `docs/backend-architecture/ai/usage.md`
- `docs/backend-architecture/calculations/action-plan.md`
- `docs/backend-architecture/calculations/gap-analysis.md`
- `docs/backend-architecture/database/schema.md`
- `docs/backend-architecture/domains/corpus.md`
- `docs/backend-architecture/jobs/jobs.md`
- `docs/backend-architecture/system/deployment.md`

## Database cutover

Use the existing disposable Drizzle workflow:

```powershell
npm run db:plan:disposable
npm run db:apply:disposable
npm run db:recreate:disposable
```

Then provision the legal corpus, bindings, and demo data through the existing
commands needed by the local environment. Do not preserve compatibility columns
for disposable data.

## Verification

Run focused checks after each phase, then the complete suite:

```powershell
npm run typecheck
npm test
npm run check:i18n
npm run db:verify:integrity
npm run db:verify:server-only
npm run db:verify:active-corpus
npm run verify
npm run build
```

Also run the connected database and grounded-workflow qualifications when the
required local services and credentials are available.

## Acceptance criteria

- Gap and Action Plan generation share one code-owned NIS2 grounding policy.
- Workflow-specific prompts, contracts, query units, and operation kinds remain
  separate.
- Guidance behavior and self-hosted/browser-relayed AI remain functional.
- Action Plan result and suggested evidence round-trip as separate structured
  values in both locales.
- The six dead column groups and their unused indexes are absent.
- Every normalized relationship has one authoritative relational path and no
  duplicated ancestor identifier.
- Gap and Action Plan audit lineage resolves all AI runs through the generation
  job rather than one arbitrary run.
- No current API route is deleted or changes path solely because it lacks a
  browser caller.
- Browser response contracts no longer hide known structures behind
  `z.unknown()`.
- No standalone worker code or package script remains; after-response and cron
  drains pass their job tests.
- Backend documentation matches implemented routes, envelopes, grounding,
  schema, and deployment behavior.
- The disposable database rebuild, verification suite, and production build
  pass.

## Non-goals

- Removing or redesigning guidance enrichment.
- Persisting guidance as citable evidence.
- Removing self-hosted AI, browser inference, or re-embedding migrations.
- Adding a second grounding policy pre-emptively.
- Removing unused public API endpoints.
- Replacing Postgres jobs with a queue service or worker deployment.
- Production data migration or backwards-compatible database rollout.
- Redesigning applicability result storage.
- New dependencies, repositories, ports, factories, or generic policy engines.
