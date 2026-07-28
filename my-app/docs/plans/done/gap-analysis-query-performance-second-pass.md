# Gap-analysis query performance: page-reader deepening

Status: Implemented and verified on 2026-07-23.

> Persistence update (2026-07-24): typed lineage tables supersede references
> below to `artifact_revision_sources`. A 2026-07-26 workflow update added the
> mutable questionnaire-draft projection to the complete customer payload.
> The complete-workflow gate is therefore 18 SQL calls and a 500 ms
> warm-median ceiling; Corpus/Document reads have a separate module benchmark.

## Complete-workflow regression correction

A later Gap-analysis simplification added prerequisite, history, and generated
input-provenance reads to `getGapAnalysisWorkflow` after the optimized page
reader had completed. The permanent benchmark's former
`workflowCompatibility` operation still called `pageReader.readGap` directly,
so it could not detect the user-facing regression.

The corrected benchmark now exercises the complete
`getGapAnalysisWorkflow` page/API boundary and supports a focused assertion
loop:

```text
npm run db:benchmark:gap -- --operation completeWorkflow --samples 3 --assert
```

The first corrected run reproduced a 953.2 ms warm median with 26 SQL calls and
one immutable release assembly on every warm request. The generated-input
reader accounted for a 653.0 ms warm median, 13 SQL calls, six dependency
layers, and the repeated release assembly.

The fix:

- reuses the already-authorized generated revision and already-loaded matching
  release;
- preserves the pinned-release fallback when revision and active release IDs
  differ;
- joins answers and selected options in one read;
- starts assessment, answer, document, and fallback-release reads together
  after source IDs are known; and
- schedules prerequisite/history reads with the workflow snapshot and generated
  provenance with the page reader's final query phase.

The final full read-only benchmark recorded complete-workflow warm samples of
281.4 / 546.1 / 256.9 ms, a 281.4 ms median and a 70.5% improvement from the
corrected 953.2 ms regression baseline. Warm requests used 16 / 17 / 16 SQL
calls, five dependency layers, one authorization lookup, one fresh active
pointer lookup, and zero immutable release assemblies. The complete payload,
authorization, mutable-data freshness, UI behavior, and database schema remain
unchanged.

The benchmark assertion now enforces at least three warm samples, a median at
or below 500 ms, at most 18 SQL calls and five dependency layers per warm
sample, one authorization lookup, one active-pointer lookup, and zero warm
immutable release assemblies.

Verification passed:

- 55 test files and 279 tests;
- type checking;
- linting;
- the optimized production build; and
- the full live read-only benchmark in assertion mode.

## Implementation results

The second pass is complete. The final remote read-only benchmark used the
same auto-discovered fixture shape, one cold sample, and three warm samples.
Response-shape summaries remained stable across every sample.

| Operation | Cold | Warm samples | Warm median | Warm SQL | Layers |
| --- | ---: | --- | ---: | ---: | ---: |
| Gap page | 905.0 ms | 217.4 / 224.9 / 221.8 ms | 221.8 ms | 12 | 4 |
| Documents page | 622.5 ms | 209.2 / 195.4 / 225.6 ms | 209.2 ms | 8 | 4 |
| Workflow compatibility | 642.5 ms | 225.5 / 209.1 / 227.8 ms | 225.5 ms | 12 | 4 |
| Document library | 149.4 ms | 163.0 / 149.2 / 156.3 ms | 156.3 ms | 4 | 3 |
| Active release | 446.1 ms | 41.2 / 46.1 / 42.4 ms | 42.4 ms | 1 | 2 |
| Reassessment draft | 493.8 ms | 488.7 / 511.7 / 496.1 ms | 496.1 ms | 11 | 3 |
| Revision staleness | 175.4 ms | 198.5 / 185.0 / 163.0 ms | 185.0 ms | 3 | 3 |

Both page readers performed one authorization lookup, one dynamic
active-release lookup, and zero immutable release-assembly queries on every
warm sample. Warm PostgreSQL execution medians remained a small fraction of
wall time: 2.1 ms for Gap and 0.5 ms for Documents.

The detailed before and after benchmark data is preserved in
`gap-analysis-query-performance-second-pass-baseline.json` and
`gap-analysis-query-performance-second-pass-final.json`.

The four approved indexes are present in the configured database with the
approved column orders. The unrestricted `npm run db:push` was attempted but
encountered pre-existing unrelated schema drift at
`legal_source_renditions_id_version_unique`. The four additive indexes were
therefore applied narrowly through the application Drizzle connection and
verified through `pg_index`, `pg_class`, and `pg_attribute`; no unapproved
database object was changed.

Verification completed:

- focused query-performance, staleness, workflow-state, document-usage, and
  schema tests passed;
- `npm run typecheck` passed;
- `npm run lint` passed;
- `npm test` passed: 53 files and 255 tests;
- `npm run build` passed; and
- the final remote benchmark passed both wall-clock and deterministic budgets.

## Objective

Reduce warm application-service latency for both organization page readers to a
median of no more than 500 ms against the configured remote Supabase fixture:

- Gap Analysis page;
- Documents page.

Preserve the existing Gap API response, UI behavior, authorization, release
freshness, reassessment semantics, staleness semantics, and mutable
organization-data freshness.

The second pass will:

- replace the all-purpose page orchestration surface with a deep page-reader
  module exposing separate Gap and Documents reads;
- keep the existing full Gap workflow DTO and API contract;
- load only assessment, library, and reassessment data for the Documents page;
- authorize once per page read and use narrow preauthorized helpers internally;
- consolidate dynamic workflow reads into bounded set-based queries;
- batch accepted and candidate staleness, including all source types;
- parallelize independent document-library reads;
- add four approved composite indexes through Drizzle; and
- retain direct, authorized standalone readers for routes, workers, scripts, and
  tests outside the page-reader module.

## Baseline

The completed first pass measured the same remote fixture with one cold and
three warm samples:

| Operation | Warm median | SQL calls | PostgreSQL execution |
| --- | ---: | ---: | ---: |
| Complete Gap workflow | 974.0 ms | 34 | 2.3 ms |
| Document library | 326.5 ms | 6 | 0.3 ms |
| Active Gap release | 51.5 ms | 1 | below 0.1 ms |
| Reassessment draft | 562.2 ms | 16 | 0.8 ms |
| Revision staleness | 465.8 ms | 9 | 0.5 ms |

PostgreSQL execution is negligible. Remote round trips and sequential dependency
layers dominate wall time.

The current Documents page calls the complete Gap workflow even though it uses
only:

- the active assessment ID;
- the document library; and
- the reassessment DTO.

The document-library reader authorizes, loads the page, loads version details,
and then loads artifact, draft, and plan usage in sequence. Once document IDs
are known, the detail and usage reads are independent.

The current staleness reader authorizes, loads the revision, artifact, and
sources, and then performs two sequential lookups per source. The benchmark
fixture has only one assessment-revision source and one artifact-revision
source, but staleness still requires nine SQL calls.

## Performance contract

### Live wall-clock targets

The permanent read-only benchmark must report:

- Gap page warm median at or below 500 ms;
- Documents page warm median at or below 500 ms;
- stable response-shape summaries across samples;
- one cold sample and at least three warm samples from the same fixture shape;
- SQL-call, sequential-layer, active-pointer, immutable-assembly, and
  PostgreSQL-execution measurements.

Wall-clock thresholds remain live benchmark results, not flaky CI assertions.

### Deterministic budgets

Tests must enforce:

| Reader | Warm SQL calls | Sequential dependency layers |
| --- | ---: | ---: |
| Gap page | no more than 16 | no more than 4 |
| Documents page | no more than 10 | no more than 4 |

Both readers must also prove:

- one organization authorization lookup;
- one dynamic active Gap-release pointer lookup;
- zero immutable release-assembly queries on a warm cache hit;
- no nested authorization lookup from document, reassessment, or staleness
  helpers; and
- all peers in a declared concurrent phase start before any peer must finish.

## Approved decisions

1. Both page readers target a warm median of no more than 500 ms.
2. The existing Gap API and complete Gap workflow DTO remain unchanged.
3. The Documents page gets a minimal reader instead of loading the complete
   workflow.
4. The Documents reader requires both `documents:read` and `gap:read`.
5. The Gap reader requires `gap:read`.
6. Public document, reassessment, and staleness entry points remain authorized.
7. Internal preauthorized helpers may be called only after the page reader has
   completed the required capability checks.
8. Mutable organization data and the active-release pointer are not cached
   across requests.
9. The already-resolved active release ID is reused by internal staleness
   calculation.
10. Accepted and candidate staleness are loaded and calculated together.
11. Query consolidation uses a bounded set-based graph, not one giant Cartesian
    join.
12. All five optimization stages are in scope even if an earlier stage reaches
    the wall-clock target.
13. Four composite indexes are added through the Drizzle schema and applied
    with `npm run db:push` in the current non-production environment.
14. Implementation is test-first at the page-reader seam.
15. If deterministic budgets pass but the remote result remains above 500 ms,
    deployment/database colocation and supported Supabase connection endpoints
    are investigated before considering broader caching.

## Non-goals

- Do not cache a page DTO, workflow DTO, authorization decision, assessment,
  answer, document, finding, evidence, reassessment, staleness projection,
  processing run, or action plan across requests.
- Do not change public HTTP payloads, route behavior, visible components,
  loading states, generation behavior, review behavior, or legal content.
- Do not change release immutability or cache the mutable active pointer.
- Do not replace the query graph with a database function, materialized view,
  or unmaintainable multi-collection Cartesian join.
- Do not change organization roles or capability membership.
- Do not add speculative indexes beyond the four approved composites.
- Do not optimize writes, authentication middleware, proxy latency, model
  calls, document processing, or first-time development compilation.

## Module and interface design

### External seam: deep page-reader module

Add `src/server/gap-analysis/page-reader.ts` with one small interface:

```ts
export type GapPageReader = {
  readGap(input: GapPageReadInput): Promise<GapAnalysisWorkflowDto>;
  readDocuments(input: GapPageReadInput): Promise<GapDocumentsPageDto>;
};
```

`GapPageReadInput` contains only `userId`, `organizationId`, and `locale`.

`GapDocumentsPageDto` contains only:

- `assessmentId`;
- `documentLibrary`;
- `reassessment`.

The module hides capability checks, release resolution, query phases, query
selection, batching, reuse, and DTO assembly. Callers do not learn internal
query ordering or preauthorization rules.

Provide two adapters at the seam:

- a production Postgres adapter using Drizzle and the Next cached release
  reader; and
- a deterministic counting adapter for reader behavior, concurrency, query
  budget, and response-parity tests.

Keep `getGapAnalysisWorkflow` as a compatibility wrapper around
`GapPageReader.readGap`. The Gap API and Gap page continue to use this wrapper.
The Documents page calls `GapPageReader.readDocuments`.

Replace the current broad `createGapAnalysisWorkflowReader` dependency surface.
Internal query functions may remain separately testable, but they must not
become caller-facing interface requirements.

### Production Postgres adapter

Add `src/server/gap-analysis/postgres-page-data.ts` as the production
implementation behind the page-reader module.

Its internal interface should remain bounded to domain-shaped reads, for
example:

```ts
type GapPageDataSource = {
  loadDocumentLibrary(...): Promise<DocumentLibrary>;
  loadWorkflowSnapshot(...): Promise<WorkflowSnapshot>;
  loadReassessmentSnapshot(...): Promise<ReassessmentSnapshot | null>;
  loadRevisionStalenessBatch(...): Promise<RevisionStalenessBatch>;
  loadProcessingRun(...): Promise<ProcessingRun | null>;
};
```

This is an internal seam. Raw tables, joins, phase ordering, and individual SQL
statements stay inside the Postgres implementation.

### Authorized and preauthorized interfaces

Retain authorized public functions for standalone callers:

- `getOrganizationDocumentLibrary`;
- `getGapReassessmentDraft`;
- `getGapRevisionStaleness`;
- `getGapAnalysisRevision`.

Add or retain narrowly named internal helpers:

- `getOrganizationDocumentLibraryPreauthorized`;
- `getGapReassessmentDraftPreauthorized`;
- `getGapRevisionStalenessBatchPreauthorized`.

The preauthorized document helper accepts the already-loaded membership so its
role and `documents:write` projection remain correct. The preauthorized
staleness helper accepts organization ID, accepted/candidate revision IDs, and
the already-resolved active release ID. It must still verify that every
revision/artifact belongs to the organization.

No route may import a preauthorized helper directly.

## Query design

### Shared authorization and active release

For `readGap`:

1. require `gap:read`;
2. resolve the active Gap pointer dynamically;
3. load the immutable localized release through the existing Next cache.

For `readDocuments`:

1. load membership once;
2. require both `documents:read` and `gap:read` from that membership;
3. resolve the active Gap pointer dynamically;
4. load the immutable localized release through the existing Next cache.

Authorization must complete before any preauthorized organization query starts.

### Document library

Use three bounded reads:

1. load the organization document page;
2. load versions, extractions, and embeddings for the page's document IDs;
3. load usage rows for artifact revisions, active/failed/locked reassessment
   drafts, and the active action plan with one set-based union or equivalent
   bounded query.

After document IDs are known, reads 2 and 3 start concurrently.

Preserve ordering, pagination, usage labels, current-version selection,
eligibility rules, role, permissions, and next cursor.

### Workflow snapshot

Load the dynamic workflow header with one bounded query or query group:

- active assessment;
- generated artifact;
- accepted and current revisions;
- active action plan;
- fallback processing-run identifiers.

Use explicit joins or lateral subqueries that preserve nullable states and the
current revision-selection rules. Do not multiply collection rows into this
header.

Once IDs are known, start these reads concurrently:

- assessment answers joined to selected options;
- accepted/candidate findings with requirements and evidence;
- reassessment snapshot;
- accepted/candidate staleness batch;
- active processing run when the reassessment source requires a final lookup.

Preserve `selectGapWorkflowRevisions` semantics and every existing workflow DTO
field.

### Reassessment snapshot

After the draft row is known, load these through no more than two additional
set-based reads:

- selected draft documents;
- accepted evidence;
- base artifact revision metadata;
- assessment revision metadata;
- assessment/applicability metadata.

Reuse the matching active release passed by the page reader. If the draft is
pinned to a different release, load that pinned release directly and never mix
release metadata.

Preserve carried, replaced, added, removed, selected-evidence, revision-number,
release-version, and requirement-count semantics.

### Batched staleness

Replace per-revision and per-source loops with one batch accepting both accepted
and candidate revision IDs.

The implementation must:

- verify revision/artifact organization ownership;
- load source rows for both revisions together;
- resolve current assessment, document, and artifact pointers set-wise;
- retain archived-state handling for every source kind;
- accept the active release ID from the page reader;
- return separate accepted and candidate projections;
- preserve missing-revision and ownership failures; and
- avoid authorization and active-pointer queries inside the batch.

One union/CTE query or a small group of concurrently executed type-specific
queries is acceptable. The complete batch must stay within the reader budgets.

## Approved Drizzle indexes

Add these definitions to `src/db/schema.ts`:

| Index | Columns | Purpose |
| --- | --- | --- |
| `documents_organization_created_idx` | `organization_id, created_at, id` | document pagination and stable ordering |
| `gap_reassessment_drafts_organization_assessment_created_idx` | `organization_id, assessment_id, created_at` | latest draft for an assessment |
| `ai_processing_runs_org_assessment_operation_created_idx` | `organization_id, assessment_revision_id, operation_kind, created_at` | latest fallback Gap run |
| `artifact_revision_sources_revision_type_idx` | `artifact_revision_id, source_type` | batched evidence and staleness source reads |

Existing single-column and unique indexes remain. Do not add duplicates for
findings, evidence, active plans, assessment answers, artifacts, or revisions;
their existing leading columns already support the planned lookups.

Apply the schema in the configured non-production environment:

```text
npm run db:push
```

Then verify the four names and column orders through `pg_indexes`.

## Page and route integration

### Gap Analysis page

Keep the current component props and full workflow DTO. Route the page through
the deep page-reader module without adding page-level caching.

### Documents page

Replace the complete `getGapAnalysisWorkflow` call with `readDocuments`. Pass
the returned `assessmentId`, `documentLibrary`, and `reassessment` to
`OrganizationDocumentManager` unchanged.

### Gap API

Keep the route contract and response shape unchanged. It continues to call
`getGapAnalysisWorkflow`, which delegates to `readGap`.

### Standalone callers

Generation, review, workers, scripts, and direct service callers retain their
existing authorized/direct readers. They must not require a Next request/cache
runtime unless they explicitly select the Next page-reader adapter.

## Test strategy

Follow vertical red/green slices at the page-reader interface.

### Reader behavior and parity

Add fixtures representing:

- no active release;
- active release with no assessment;
- assessment with answers but no artifact;
- accepted revision only;
- accepted plus candidate revision;
- open, locked, failed, generated, and absent reassessment drafts;
- assessment, document, and artifact staleness sources;
- archived and current dependencies;
- active plan with and without an update;
- processing run selected by run ID, job ID, and assessment fallback.

Assert the full Gap DTO against the existing reader's known fixture output
before replacing the old implementation. Assert the Documents DTO against the
three fields currently consumed by the page.

### Authorization

Prove:

- `readGap` rejects callers without `gap:read`;
- `readDocuments` rejects callers missing either required capability;
- no data-source read starts before authorization succeeds;
- authorized readers perform one membership query;
- public standalone functions still authorize independently; and
- no route imports a preauthorized helper.

### Performance budgets

Use the deterministic counting adapter to assert:

- Gap warm read uses at most 16 SQL calls and four sequential layers;
- Documents warm read uses at most 10 SQL calls and four sequential layers;
- active pointer is resolved once on every request;
- immutable release assembly occurs once cold and zero times warm;
- document detail and usage reads start concurrently;
- answers, findings, reassessment, and staleness peers start concurrently once
  their IDs are available;
- accepted and candidate staleness use one batch; and
- no per-source query count growth occurs as fixture source count increases.

### Query semantics

Add focused tests for:

- document ordering and cursor stability;
- usage-label parity;
- accepted/candidate finding and evidence grouping;
- reassessment carry-over/replacement/addition/removal parity;
- all three staleness source kinds;
- release mismatch fallback;
- nullable revision and run states; and
- duplicate rows introduced by joins.

### Schema

Extend schema tests to assert the four approved index names and columns. After
`db:push`, inspect the configured database without writing fixture rows.

## Benchmark changes

Extend `scripts/benchmark-gap-workflow.ts` with separate operations:

- `gapPage`;
- `documentsPage`;
- existing full API/workflow compatibility read;
- document library;
- active release;
- reassessment draft;
- revision staleness.

For each operation report:

- cold wall time;
- warm samples and median;
- SQL calls;
- sequential dependency layers;
- PostgreSQL execution time;
- authorization calls;
- active-pointer calls;
- immutable release assemblies; and
- a stable response-shape summary.

The benchmark remains read-only and may auto-discover the same eligible fixture.
Do not print organization IDs, user IDs, document contents, answers, findings,
or evidence.

If both deterministic query budgets pass but a page median remains above
500 ms, run the benchmark from the deployed Next environment and compare:

- application and Supabase regions;
- supported transaction, session, and direct connection endpoints;
- connection reuse and pool saturation.

Do not weaken freshness or authorization to compensate for network placement.

## Implementation sequence

1. Re-run the current benchmark and preserve its JSON output as the comparison
   baseline.
2. Add failing response-parity and query-budget tests at the two-method
   page-reader seam.
3. Introduce `GapPageReader`, the production Postgres adapter, and the counting
   test adapter without changing call sites.
4. Add the minimal Documents DTO and switch the Documents page to
   `readDocuments`.
5. Split authorized and preauthorized document-library reads while preserving
   public behavior.
6. Consolidate document usage into one bounded read and run detail/usage reads
   concurrently.
7. Add the four Drizzle indexes, run `npm run db:push`, and verify them through
   `pg_indexes`.
8. Add the preauthorized accepted/candidate staleness batch and replace
   per-source loops.
9. Add the workflow-header snapshot and batched answers/options reader.
10. Batch findings, requirements, and evidence for both workflow revisions.
11. Deepen reassessment snapshot loading to its two-query post-draft budget.
12. Route staleness through the already-resolved active release and reuse the
    matching release for reassessment.
13. Perform the final consolidation pass required to meet the approved call and
    dependency-layer budgets.
14. Keep `getGapAnalysisWorkflow` as the compatibility wrapper and verify the
    Gap API response field-for-field.
15. Run focused tests after every vertical slice.
16. Run type checking, linting, the full test suite, and a production build.
17. Run the remote benchmark, record one cold and at least three warm samples,
    and update this plan with the final results.
18. Inspect the final diff for unrelated changes, accidental public imports of
    preauthorized helpers, temporary instrumentation, and unapproved schema
    changes.

## Expected affected files

- `src/server/gap-analysis/page-reader.ts`
  - deep two-method external interface and orchestration.
- `src/server/gap-analysis/postgres-page-data.ts`
  - bounded Postgres implementation and set-based query graph.
- `src/server/gap-analysis/workflow-reader.ts`
  - compatibility wrapper and removal of the broad shallow dependency surface.
- `src/server/gap-analysis/staleness.ts`
  - authorized standalone wrapper and preauthorized accepted/candidate batch.
- `src/server/gap-analysis/reassessment-service.ts`
  - deeper preauthorized reassessment snapshot.
- `src/server/documents/service.ts`
  - authorized/preauthorized split and bounded concurrent library reads.
- `src/db/schema.ts`
  - four approved composite indexes.
- `app/tool/organizations/[organizationId]/documents/page.tsx`
  - use the minimal Documents reader.
- `app/tool/organizations/[organizationId]/gap-analysis/page.tsx`
  - use or delegate through the deep Gap reader.
- `app/api/organizations/[organizationId]/gap-analysis/route.ts`
  - compatibility verification only; no response change expected.
- `tests/gap-query-performance.test.ts`
  - page-reader parity, authorization, call budgets, cache identity, and
    concurrency.
- `tests/gap-review-and-staleness.test.ts`
  - batched staleness behavior for all source kinds.
- schema/index tests
  - approved index definitions and column order.
- `scripts/benchmark-gap-workflow.ts`
  - page-specific operations and dependency-layer reporting.
- `docs/plans/done/gap-analysis-query-performance-second-pass.md`
  - implementation and final verification results.

The exact test filename for schema indexes should follow the existing schema
test organization rather than creating a redundant suite.

## Verification commands

Focused checks:

```text
npx vitest run tests/gap-query-performance.test.ts
npx vitest run tests/gap-review-and-staleness.test.ts tests/gap-workflow-state.test.ts
```

Schema application and verification:

```text
npm run db:push
```

Repository checks:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Live verification:

```text
npm run db:benchmark:gap
```

## Acceptance criteria

### Behavior

- Gap Analysis and Documents pages render the same visible data and controls.
- The Gap API returns the same status, fields, nesting, and nullable states.
- Active-release changes are visible on the next page/API request.
- A newly active release never receives a cached old release bundle.
- Document ordering, pagination, current versions, usage labels, eligibility,
  and permissions remain unchanged.
- Reassessment release version, requirement count, selected evidence,
  carry-over, replacement, addition, and removal remain unchanged.
- Accepted/candidate selection, findings, review blockers, staleness, active
  plan state, and processing-run selection remain unchanged.
- Unauthorized callers cannot reach organization data through any reader or
  route.
- Standalone public readers retain their own authorization.

### Performance

- Gap page warm median is at or below 500 ms.
- Documents page warm median is at or below 500 ms.
- Gap warm reads use at most 16 SQL calls and four sequential layers.
- Documents warm reads use at most 10 SQL calls and four sequential layers.
- Each page read authorizes once and resolves the active pointer once.
- Warm page reads execute zero immutable release-assembly SQL.
- Staleness query count does not grow with the number of sources.
- PostgreSQL execution remains a small fraction of wall time, or any regression
  is explained with query plans.

### Schema and verification

- The four approved indexes exist in Drizzle and the configured database.
- No additional index, table, view, function, RLS, trigger, or enum change is
  present.
- Focused and full tests, typecheck, lint, and production build pass.
- The live benchmark records final cold/warm results and stable response shapes.
- The final diff contains no temporary debug code or unrelated changes.

## Risks and mitigations

### Authorization bypass

A preauthorized helper could become a public bypass. Keep public wrappers
authorized, require page-reader authorization before any organization read, use
explicit names, and prohibit direct route imports with a structural test.

### Join duplication

Combining findings/evidence or document usage can duplicate parent rows.
Normalize by stable IDs and cover multi-evidence/multi-usage fixtures.

### Incorrect nullable-state selection

Header consolidation could change accepted/current/candidate or run precedence.
Lock current behavior with response-parity fixtures before replacing queries.

### Staleness drift

Batching source kinds could change archived or current-pointer semantics.
Test assessment, document, and artifact sources independently and together.

### Index overhead

The four indexes add storage and write maintenance even though the current
fixture is small. Limit schema changes to the approved set and record their
definitions and database presence.

### Remote target remains unmet

If query budgets pass but latency remains high, measure from deployed compute
near Supabase and compare supported connection endpoints. Do not add mutable
cross-request caches as a shortcut.

## Rollback

Rollback is staged:

1. Route the Documents page back to `getGapAnalysisWorkflow`.
2. Route the compatibility wrapper back to the first-pass workflow reader.
3. Restore standalone staleness and document readers as page dependencies.
4. Leave additive indexes in place unless a later Drizzle schema change removes
   them.

No data rewrite or cache purge is required. The immutable release cache remains
valid because its identity and semantics do not change.
