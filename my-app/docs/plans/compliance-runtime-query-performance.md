# Compliance runtime query-performance plan

Status: Implemented and verified on 2026-07-16.

## Objective

Reduce repeat application-service latency introduced by the immutable compliance-release runtime without weakening release immutability, historical reproducibility, authorization, revision history, or transactional submission behavior.

The user-visible outcome is:

- warm organization applicability overview, questionnaire, result, and settings reads complete in less than 500 ms of application-service time against the configured remote Supabase database;
- a normal 12-question organization applicability submission completes in less than 2 seconds of application-service time;
- first-time Next.js development compilation and proxy/authentication time are measured separately and are not attributed to database work;
- published releases, historical results, and active-release changes continue to produce the same data and UI behavior.

## Measured baseline

The diagnosis used the configured remote Supabase database, a real organization member, three warm samples per service, and `extensions.pg_stat_statements` deltas. PostgreSQL execution was fast; sequential network round trips dominated wall time.

| Operation | Warm wall time | SQL calls | PostgreSQL execution time |
| --- | ---: | ---: | ---: |
| Basic organization lookup | about 46 ms | 1 | negligible |
| Load one pinned compliance release | about 668 ms | 13 | about 3 ms |
| Organization settings facts | about 1.21 s | 18 | about 13 ms |
| Applicability result | about 2.25 s | 42 | about 15 ms |

Additional observed warm medians:

- applicability overview: about 2.17 s;
- applicability questionnaire: about 804 ms;
- applicability result: about 2.08 s;
- settings facts: about 782 ms;
- organization applicability submission: about 7.1 s of application time in the reported request.

The current result path loads the same pinned release three times, including separate German and English projections, and then loads the full pinned content set. The submission path adds sequential per-answer and per-fact persistence loops. With a roughly 45–55 ms remote round trip, query count rather than PostgreSQL execution cost explains the regression.

## Approved decisions

1. Warm read services target less than 500 ms; organization submission targets less than 2 seconds.
2. Both read paths and submission writes are in scope.
3. Published release data may be cached across requests because it is immutable.
4. Cache identity includes the immutable release ID and locale.
5. The mutable active-release pointer remains outside the immutable cache and must be resolved dynamically.
6. Introduce one deep runtime-release module instead of adding page-level caches.
7. Keep a framework-neutral Postgres assembler and provide separate direct and Next cached adapters at the same seam.
8. Use built-in Next.js Cache Components initially; do not add remote-cache infrastructure or dependencies.
9. Do not change the Supabase connection endpoint as part of this work.
10. Do not add or change database tables, indexes, RLS policies, functions, or migrations.
11. Exclude proxy/auth latency and first-time development compilation from the acceptance signal.
12. CI enforces deterministic query-count and call-shape budgets; a permanent live benchmark measures remote wall time.
13. The permanent live benchmark is read-only and contains no hardcoded organization or user IDs.

## Non-goals

- Do not change legal rules, release content, German mappings, evidence semantics, questionnaire wording, or evaluator behavior.
- Do not reinterpret, rewrite, or migrate existing assessments, guest checks, facts, artifacts, or release rows.
- Do not change public HTTP request or response shapes.
- Do not change visible navigation, layouts, loading states, or form behavior.
- Do not cache authorization decisions, organization data, current facts, assessments, results, or guest sessions across requests.
- Do not cache the active-release pointer.
- Do not introduce Redis, a remote Next cache handler, a new package, or other infrastructure.
- Do not treat a Supabase pooler change as the performance fix. The current direct-host/comment mismatch may be documented, but environment migration remains separate work.
- Do not optimize proxy authentication or development-only route compilation.
- Do not add speculative indexes when measured PostgreSQL execution is already in the low-millisecond range.

## Invariants

The implementation must preserve all of the following:

- A published compliance release and every version it pins remain immutable.
- An assessment, guest check, artifact revision, and result remain pinned to their original compliance release.
- Active-release changes affect new work immediately without changing historical interpretation.
- The cached value contains only immutable release data. `isActive` and `activeVersionLabel` are composed from a fresh active pointer.
- German and English localization and fallback behavior remain identical.
- Organization authorization is checked on every user-scoped call and is never part of a shared cache key or cached value.
- A submission remains atomic: no partial assessment revision, answer, fact, artifact, projection, or claim state may commit.
- Revision numbers, parent links, superseded states, current pointers, input hashes, evidence, and artifact provenance remain unchanged in meaning.
- Guest lifecycle and cleanup behavior remain unchanged.
- Standalone publisher, activator, smoke, and benchmark scripts must not require a Next.js request/cache runtime.
- Browser roles retain no direct CRUD access to application tables.

## Deep module and seam

### Runtime-release module

Create a deep runtime-release module under `src/server/compliance/runtime-release/`. Its small interface is the only release-loading surface used by questionnaire, applicability, organization-fact, and result callers.

Conceptual interface:

```ts
type RuntimeReleaseReader = {
  getPublished(input: {
    checkReleaseId: string;
    locale: Locale;
  }): Promise<PublishedComplianceRelease | null>;
  getActive(input: {
    checkCode: string;
    locale: Locale;
  }): Promise<ResolvedComplianceRelease | null>;
  getActivePointer(checkCode: string): Promise<ActiveReleasePointer | null>;
};
```

The exact TypeScript names may follow repository conventions, but the interface must remain limited to immutable pinned reads, active reads, and current-pointer status. Callers must not learn query ordering, translation joins, cache tags, or cached-bundle composition.

`PublishedComplianceRelease` contains only immutable, locale-specific bundle data. `ResolvedComplianceRelease` contains:

- one `PublishedComplianceRelease`;
- a freshly resolved active release ID/version;
- derived `isActive`/outdated status.

The immutable cached bundle must not embed active status.

### Adapters

The seam has two real adapters:

1. **Direct adapter** — uses the framework-neutral Postgres assembler without Next caching. Publisher/activator support code, `db:smoke:nis2`, the read-only benchmark where cold behavior is requested, and deterministic tests can use it.
2. **Next cached adapter** — wraps immutable `checkReleaseId + locale` bundle reads in a function-level `use cache` scope with the approved long-lived cache profile. App Router pages and API routes use it. It resolves the active pointer outside the cached scope.

Both adapters return the same serializable result type and use the same assembler. No caller-specific release reconstruction is allowed.

This separation is required because `cacheLife()` is not available when the module is executed directly under standalone `tsx`, even though Cache Components are enabled for Next.js.

### Postgres assembler

Replace the current serial 13-query implementation with a bounded query graph:

1. Load the release header in one joined query, including questionnaire version, questionnaire, rule set, and immutable pinned identifiers.
2. Load questionnaire rows and fact mappings in bounded set-based queries.
3. Load options together with fact-option/catalog and entity-version data in set-based queries.
4. Load entity legal provisions in one set-based query.
5. Load all release-pinned content needed by questionnaire and result localization for the requested locale plus default fallback in one set-based query.
6. Assemble lookup maps once, then build questions/options/result-localization data without repeated `.filter()` scans over the complete row sets.

Cold immutable-bundle assembly must use no more than six SQL statements and no more than three sequential dependency layers. Independent queries after the header must run concurrently.

Do not replace the query graph with one unmaintainable Cartesian join. The target is bounded set-based loading and shallow sequential depth.

### Cache behavior

- Cache only successfully loaded published/retired/superseded immutable bundles.
- Key by build ID/function identity plus `checkReleaseId` and `locale`, as provided by Next `use cache`.
- Use a long-lived/max cache profile because a published release ID never changes meaning.
- A deployment/build naturally creates new cache identities.
- Missing or invalid releases must fail closed; do not turn transient database failures into cached `null` values.
- Active-pointer reads stay dynamic and are joined/composed after the immutable cache lookup.
- Activation needs no immutable-cache invalidation because it changes only the pointer.

Next Cache Components behavior should follow the official [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife), and [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) documentation for the installed Next.js 16 runtime.

## Read-path changes

### Questionnaire reads

- Route active-pointer resolution through the runtime-release reader.
- Reuse the cached immutable bundle for both organization and guest questionnaire reads.
- Keep organization authorization and latest-answer reads dynamic.
- Keep guest-session creation dynamic and outside the cached scope.
- Preserve country-catalog filtering, question order, option metadata, and release metadata.

Expected warm database shape:

- one organization authorization query for user-scoped reads;
- one active-pointer query;
- bounded latest-assessment/answer queries when prior answers exist;
- zero immutable-bundle SQL calls on a cache hit.

### Result and overview reads

- Make `getCurrentResult` load the artifact/result row once.
- Resolve the pinned German and English bundles concurrently through the runtime reader.
- Remove the extra metadata-only pinned-release load.
- Make localization a pure in-process projection that accepts already loaded German and English bundles/content maps.
- Do not issue release or content queries from `localizeEvaluation`.
- Resolve the active pointer once and derive outdated status from it.
- Let overview and result share the same current-result implementation without duplicate release loading.

Expected warm database shape:

- one authorization query;
- one assessment/revision query for overview only;
- one current artifact/result query;
- one active-pointer query;
- zero immutable-bundle/content SQL calls on cache hits.

### Organization settings facts

- Keep current facts and selected options dynamic.
- Group facts by pinned release ID.
- Load each unique release/locale through the runtime reader once and concurrently.
- Use precomputed question-by-fact and option-by-value maps from the bundle rather than repeated scans.
- Do not load active-pointer state when settings only needs labels from a pinned release.

Expected warm database shape:

- one authorization query;
- one current-facts query;
- one selected-options query;
- zero immutable-bundle SQL calls on cache hits.

## Submission write changes

### Prepare before opening the transaction

The submission preparation phase must:

1. authorize the organization;
2. resolve the active or explicitly pinned release once;
3. validate all answers;
4. derive decisive facts;
5. evaluate the rule set;
6. construct the German/English localized result from the already loaded immutable bundles;
7. compute immutable input/evidence data required for persistence.

If release loading or localization fails, fail before any write transaction begins.

### Persist in one transaction

Extract a focused submission-persistence implementation that accepts prepared, validated data and performs one atomic transaction.

Replace per-item SQL loops with set-based operations:

- insert all assessment-answer headers in one statement and return their IDs;
- create all assessment-answer option join rows in one statement;
- invalidate current fact values for all submitted fact keys in one update;
- insert all new fact-value rows in one statement and return their IDs/fact keys;
- load all required fact options in one query, validate exact `(factKey, stableValue)` pairs in memory, and fail closed on any missing or extra mapping;
- insert all fact-value option join rows in one statement;
- retain bounded assessment lifecycle and artifact lifecycle statements;
- create the projection and provenance rows within the same transaction;
- update current assessment/artifact pointers only inside the transaction;
- claim a guest check in that same transaction when applicable.

The normal 12-question path must not increase SQL statement count when more answer options or fact values are present. Row count may grow; round-trip count must remain bounded.

### Transaction and result behavior

- Do not localize by querying the database inside the write transaction.
- Return the same `ApplicabilityResultDto` shape.
- Preserve current revision numbering and supersession order.
- Preserve full-answer resubmission behavior.
- Preserve the organization-fact `sourceRevisionId`, confidence, current marker, and selected-option relationships.
- Preserve artifact input hashes and stored language-neutral evidence.

## Performance interface and budgets

Performance characteristics are part of the module interface and must be tested.

### Deterministic CI budgets

Use counting/fake adapters at the runtime-release and submission-persistence seams. Tests must demonstrate:

- cold immutable bundle assembly requests no more than six set-based data operations;
- a repeated cached read does not call the immutable Postgres assembler again;
- active-pointer resolution occurs on every active/outdated-status read even when the bundle is cached;
- result localization receives preloaded bundles and performs no release/content I/O;
- settings loads each unique pinned release at most once per call;
- answer headers, answer-option joins, fact invalidation, fact inserts, fact-option lookup, and fact-option joins each occur once for a 12-question fixture;
- submission persistence has a fixed upper call budget for the standard existing-assessment branch and does not grow linearly with answer/fact count;
- any missing option mapping rolls the whole submission back;
- direct and cached adapters return equivalent DTOs for the same fixture.

Do not gate CI on remote wall-clock timings.

### Read-only live benchmark

Add `scripts/benchmark-compliance-runtime.ts` and an npm script such as `db:benchmark:compliance`.

The benchmark must:

- require organization and user IDs through explicit CLI arguments or dedicated environment variables;
- contain no hardcoded IDs;
- execute only read functions;
- report cold sample, warm samples, median, and maximum/p95-style sample for organization lookup, settings facts, overview, questionnaire, result, active release, and pinned release;
- report configured thresholds and exit non-zero in assertion mode when warm medians exceed them;
- never create guest sessions, assessment revisions, facts, or artifacts;
- avoid printing database URLs, tokens, user details, answer values, or other sensitive data.

Submission wall time is verified once through the normal UI/API after deterministic write-call tests pass.

## Expected affected files

Existing files likely modified:

- `src/server/compliance/release-service.ts` — replaced or reduced to the public runtime-release facade; no serial graph assembly remains here.
- `src/server/applicability-check/service.ts` — consume the reader once, make localization pure, and delegate atomic batch persistence.
- `src/server/organizations/service.ts` — use pinned cached bundles for fact labels without per-row release loading.
- `src/server/questionnaires/service.ts` — use the runtime-release reader.
- `scripts/smoke-nis2-scope.ts` — compose the direct adapter so standalone `tsx` does not call Next cache APIs.
- `package.json` — add the read-only benchmark command.
- `docs/architecture/database-structure.md` — document immutable runtime caching, dynamic active pointers, direct CLI composition, and the benchmark.

Expected additions, with exact filenames adjustable to repository conventions:

- `src/server/compliance/runtime-release/types.ts`
- `src/server/compliance/runtime-release/postgres-assembler.ts`
- `src/server/compliance/runtime-release/direct-reader.ts`
- `src/server/compliance/runtime-release/next-cached-reader.ts`
- `src/server/compliance/runtime-release/index.ts`
- `src/server/applicability-check/submission-persistence.ts`
- `scripts/benchmark-compliance-runtime.ts`
- `tests/compliance-runtime-release.test.ts`
- `tests/applicability-submission-persistence.test.ts`

Files explicitly not changed:

- `src/db/schema.ts`
- `drizzle.config.ts`
- `supabase/sql-editor/*`
- authored legal release files under `src/server/compliance/nis2/releases/`
- route response contracts and client components, unless a type-only import must move with the internal DTO definition.

## Data and API changes

### Database

None. No schema push, migration, SQL Editor execution, data clear, republish, or reactivation is required.

### Public HTTP API

None. Existing request validation, response JSON, status codes, result URLs, and cookies remain unchanged.

### Internal interfaces

- Split immutable release-bundle data from mutable active-pointer status.
- Replace direct calls to the serial release loader with `RuntimeReleaseReader`.
- Pass preloaded localization data into result projection.
- Pass a prepared persistence command into the batched submission implementation.

## Implementation sequence

### Phase 1 — Lock the regression signal

1. Add deterministic runtime-release fixture adapters and query/call counters.
2. Add failing tests for the six-operation cold bundle budget, cache-hit behavior, and dynamic active pointer.
3. Add failing result tests proving the existing path performs redundant release loads.
4. Add failing submission call-shape tests proving answer/fact work grows per item.
5. Add the read-only benchmark without changing production call paths and capture the current baseline.

### Phase 2 — Build the deep runtime-release module

1. Define immutable bundle, active pointer, resolved release, and reader types.
2. Move Postgres graph assembly behind the module seam.
3. Join the header records and batch the dependent graph loads.
4. Precompute question, fact, option, content, entity, and legal-reference lookup maps internally.
5. Implement the direct adapter and prove DTO parity with the current loader fixtures.
6. Keep the current public loader temporarily delegating to the direct adapter only while call sites migrate within this phase; remove the compatibility path before completion.

### Phase 3 — Add the Next cached adapter

1. Wrap only immutable bundle reads in `use cache`.
2. Apply the long-lived immutable-release cache profile.
3. Keep active-pointer lookup outside the cached function.
4. Compose `getPublished`, `getActive`, and `getActivePointer` from cached immutable data plus fresh pointer state.
5. Make the direct adapter the explicit composition for standalone scripts.
6. Run `next build` immediately to validate Cache Components serialization and directive placement.

### Phase 4 — Migrate and simplify read paths

1. Migrate questionnaire preview, guest questionnaire, and organization questionnaire reads.
2. Refactor current-result loading to one artifact read plus concurrent cached German/English bundles.
3. Convert localization to a pure projection with no database imports.
4. Remove the redundant release load from result metadata.
5. Migrate overview to the shared result path.
6. Migrate organization fact labels and remove the per-call local release cache/map.
7. Re-run call-budget tests and the live read benchmark.

### Phase 5 — Batch submission persistence

1. Move localization and immutable release preparation before the transaction.
2. Extract the persistence command and transaction implementation.
3. Batch answer headers and answer-option joins.
4. Batch current-fact invalidation, fact inserts, fact-option lookup, and join inserts.
5. Retain bounded assessment and artifact lifecycle operations.
6. Verify guest claim updates remain in the same transaction.
7. Run rollback, revision-history, option-mapping, and deterministic result tests.

### Phase 6 — Verify and document

1. Run targeted runtime-release, result, settings, and submission tests.
2. Run the full Vitest suite.
3. Run TypeScript and lint.
4. Run the production Next.js build.
5. Run `db:smoke:nis2` through the direct adapter and confirm all four outcome fixtures still pass and cleanup leaves no guest rows.
6. Run the read-only live benchmark against configured Supabase and record warm medians.
7. Perform one normal organization submission through the UI and confirm application-service time is below 2 seconds.
8. Verify the stored revision, answers, facts, artifact, evidence, projection, and localized result match pre-change semantics.
9. Inspect `git diff --check` and remove all debug instrumentation or temporary fixtures.

## Acceptance criteria

The plan is complete only when all of the following are true:

- Warm read benchmark medians are below 500 ms for overview, questionnaire, result, and settings facts.
- A normal organization submission reports less than 2 seconds of application-service time after route compilation is warm.
- Cold immutable bundle assembly stays within six SQL statements and three sequential dependency layers.
- Warm cached bundle reads perform no immutable bundle SQL.
- Active-pointer changes are visible immediately and historical results show correct outdated status.
- Result rendering performs no release/content query from its localization projection.
- Submission answer/fact persistence uses a bounded number of set-based calls rather than per-item loops.
- German/English output, evidence, entity labels, legal citations, reason text, and disclaimer text remain unchanged for golden fixtures.
- Existing assessments and results remain readable and pinned to their original release.
- Guest and organization smoke outcomes remain `essential_entity`, `important_entity`, `not_directly_in_scope`, and `clarification_required` for the existing fixtures.
- No benchmark or smoke rows remain after verification.
- No schema, SQL policy, release publication, or activation change is present.
- Typecheck, tests, lint, production build, and diff check pass.

## Implementation verification

Verification against the configured remote Supabase database completed on 2026-07-16 without hardcoded or printed organization/user IDs.

The read-only benchmark ran with one cold sample and three warm samples in assertion mode. Warm medians were:

| Operation | Warm median | Warm p95/max sample |
| --- | ---: | ---: |
| Organization lookup | 56.9 ms | 58.5 ms |
| Settings facts | 161.0 ms | 172.2 ms |
| Applicability overview | 212.3 ms | 218.2 ms |
| Applicability questionnaire | 276.1 ms | 290.9 ms |
| Applicability result | 170.7 ms | 174.4 ms |
| Active release | 55.1 ms | 55.2 ms |
| Pinned release | 0.0 ms | 0.0 ms |

A warmed normal 12-question organization submission completed in 1,666.4 ms of application-service time. Post-commit checks confirmed revision numbering and parentage, superseded states, assessment/artifact current pointers, full answers and option joins, current fact rows, artifact input hash and outcome, result projection, and assessment-revision provenance.

The full Vitest suite, TypeScript, lint, production Next.js build, direct-adapter NIS2 smoke suite, and `git diff --check` passed. The smoke suite preserved all four expected outcomes and cleaned up its guest rows.

## Risks and mitigations

### Active state accidentally cached

Risk: a release activation would not affect new assessments or outdated indicators immediately.

Mitigation: keep the pointer in a separate type/query, prohibit it from the immutable bundle, and test pointer changes across repeated cached bundle reads.

### CLI calls Next cache APIs

Risk: standalone `tsx` scripts fail because `cacheLife()` requires a compiled Cache Components scope.

Mitigation: compose CLI/smoke commands with the direct adapter and run every database CLI during verification.

### Cache return value is not serializable

Risk: `next build` or runtime caching fails on complex Drizzle values.

Mitigation: return plain serializable objects/arrays/maps converted to entries, keep database handles/functions out of the bundle, and run `next build` immediately after introducing the adapter.

### Batch mapping changes semantics

Risk: answer IDs, fact-option pairs, revision parents, or artifact provenance are associated incorrectly.

Mitigation: key every returned row explicitly, validate exact pair cardinality, fail closed on duplicates/missing mappings, and compare stored golden snapshots before/after.

### Transaction is shortened incorrectly

Risk: moving localization outside the transaction allows writes to commit before a response can be built.

Mitigation: perform all release loading/localization before opening the transaction; only enter the transaction once a complete prepared result exists.

### Cache hides invalid publication

Risk: a transient or incomplete release becomes a long-lived cached failure.

Mitigation: validate published status and required graph completeness before returning a cacheable bundle; do not cache thrown failures or missing releases.

### Query-count tests become implementation-coupled

Risk: tests assert SQL strings and obstruct harmless refactors.

Mitigation: assert the module's documented operation/call budgets and observable DTOs through counting adapters, not raw generated SQL text.

### Cache memory grows with releases/locales

Risk: many accessed historical releases increase per-instance cache usage.

Mitigation: cache only requested published bundles, use Next-managed cache lifetime/build invalidation, avoid duplicating locale-independent structures where the implementation can safely share them, and measure serialized bundle size during implementation.

## Rollback

This is a code-only change.

1. Revert the runtime-release module, cached/direct adapter composition, and batched submission implementation together.
2. Restore the previous release loader and sequential persistence implementation.
3. Rebuild/redeploy; the build ID naturally abandons cached entries from the reverted implementation.
4. Run typecheck, tests, build, `db:smoke:nis2`, and one read-only result check.

No database rollback, data restoration, schema push, SQL Editor action, release republish, or active-pointer change is required.

## Unresolved decisions

None. Implementation remains blocked only on explicit approval of this written plan.
