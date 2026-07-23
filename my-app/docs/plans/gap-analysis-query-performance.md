# Gap-analysis query-performance first pass

Status: Proposed on 2026-07-23; awaiting approval.

## Objective and user-visible outcome

Reduce warm navigation latency for the organization Gap analysis and Documents
pages without changing their UI, API payloads, authorization rules, workflow
semantics, or database schema.

The first pass will:

- cache only immutable, localized content belonging to the currently resolved
  Gap-analysis release;
- keep the mutable active-release pointer and all organization-specific data
  dynamic;
- reuse the active release already loaded by the workflow when constructing its
  reassessment summary;
- run independent workflow reads concurrently; and
- preserve direct, framework-neutral release loading for workers, scripts,
  generation, review, and tests.

Measured baseline against the configured remote Supabase database:

| Operation | Warm wall time | SQL calls | PostgreSQL execution |
| --- | ---: | ---: | ---: |
| Complete Gap workflow | 2.48 s median | 51 | about 8 ms |
| Document library | 270 ms | 6 | about 6 ms |
| Active Gap release | 410 ms | 9 | about 6 ms |
| Reassessment draft | 818 ms | 17 | about 10 ms |
| Revision staleness | 428 ms | 9 | about 8 ms |

Running the document-library and active-release reads concurrently reduced their
combined wall time from 701 ms to 395 ms without changing their queries.

The target for this first pass is:

- at least 35% lower warm application-service latency for the measured workflow;
- a warm median at or below 1.5 seconds for the same remote fixture;
- no second immutable release assembly while building one workflow response;
- a fresh active-release pointer lookup on every workflow call; and
- no increase in organization-specific query count.

The existing sub-500 ms read target remains aspirational for this first pass. If
the measured result remains above one second, a separate consolidated workflow
reader can be considered.

## Non-goals

- Do not cache the complete page, workflow DTO, organization authorization,
  assessments, answers, documents, findings, evidence, reassessment drafts,
  processing runs, action plans, or staleness state.
- Do not cache the mutable active Gap-release pointer.
- Do not change database tables, indexes, RLS policies, SQL functions, or
  migrations.
- Do not change route contracts, visible components, navigation, loading states,
  workflow behavior, generation behavior, or legal content.
- Do not introduce Redis, a cache handler, a production dependency, or new
  infrastructure.
- Do not consolidate the entire workflow into a new query assembler.
- Do not batch the per-source staleness implementation in this first pass.
- Do not optimize authentication, proxy latency, first-time development
  compilation, model calls, document processing, or writes.

## Assumptions and invariants

- Published Gap-release content is immutable once identified by release ID.
- Cache identity includes release ID and locale.
- The active pointer is resolved dynamically before loading cached content, so
  activation takes effect without invalidating an immutable bundle.
- Only successful published-release loads are cached. Missing or failed loads
  are not converted into long-lived cached null values.
- The active workflow assessment is pinned to the same release returned by the
  active pointer; the workflow must verify this relationship before passing the
  release into the reassessment summary.
- A caller may skip nested authorization only after the public workflow reader
  has successfully checked the required organization capability.
- Standalone callers continue to use the direct release loader and do not
  require a Next request/cache runtime.

## Design

### Cached active-release adapter

Add a Next-specific Gap-release adapter beside the existing direct loader.

The direct loader remains responsible for:

- resolving the mutable active pointer;
- assembling one localized published release from Postgres; and
- serving workers, scripts, generation, review, and other framework-neutral
  callers.

The Next adapter will:

1. resolve the active pointer dynamically;
2. call a function-level `"use cache"` scope keyed by release ID and locale;
3. use `cacheLife("max")`, matching the established compliance-release cache
   convention; and
4. throw inside the cached scope for unavailable releases so a transient or
   invalid null result is not cached.

The Gap workflow reader will use the Next adapter by default. It will retain a
dependency seam so deterministic tests and standalone benchmarks can supply a
direct or in-memory cached reader.

### Request-scoped reuse

Split reassessment-draft reading into:

- the existing authorized public entry point; and
- an internal/preauthorized read used only after the workflow reader has checked
  `gap:read`.

The preauthorized read accepts the already-loaded active release. It must verify
that the draft/assessment release ID matches before using it. Standalone API and
service callers keep the current public entry point and direct loading behavior.

This removes one repeated authorization lookup and the second eight-query
release assembly from the page workflow.

### Concurrency

Preserve the existing dependency ordering while running independent work in
bounded phases:

1. authorize the workflow request;
2. load the document library and active release concurrently;
3. load the active assessment and Gap artifact concurrently;
4. load answer rows and accepted/current artifact revisions concurrently;
5. concurrently load answer options, findings, reassessment summary, staleness
   projections, and the active plan once their required IDs are known; and
6. resolve the processing run after the reassessment source is known.

Within the reassessment summary, after the draft row is known, load selected
documents, accepted evidence, revision metadata, and assessment metadata
concurrently. Preserve all existing DTO fields and selection logic.

Do not parallelize queries that depend on IDs or state returned by an earlier
phase.

## Acceptance criteria

### Behavior

- Gap analysis and Documents pages render the same workflow data as before.
- The Gap-analysis API returns the same response shape.
- Active-release changes are observed on the next workflow request.
- A cached old release is never substituted for a newly active release.
- Reassessment summaries preserve release version, requirement count, selected
  evidence, carry-over, replacement, addition, and removal data.
- Unauthorized callers cannot reach the preauthorized read path through a
  public route.
- Generation, review, workers, publishers, activators, and standalone scripts
  retain direct database loading.

### Performance contract

- A deterministic reader test proves the active pointer is resolved on every
  active read while an immutable `(release ID, locale)` bundle is assembled once.
- A workflow/reassessment test proves an already-loaded matching release is
  reused and a mismatched release fails closed or falls back to a direct load.
- A concurrency test proves independent workflow phases start before either
  peer completes.
- The same read-only remote benchmark used for diagnosis reports:
  - warm median no greater than 1.5 seconds;
  - at least 35% improvement from the 2.48-second baseline; and
  - no more than one immutable release assembly per cold workflow request and
    zero on a warm cache hit.

Wall-clock thresholds are reported from the live benchmark and are not added as
flaky CI assertions.

## Expected affected files and components

- `src/server/gap-analysis/release-loader.ts`
  - expose a small active-pointer/direct-reader seam without changing direct
    behavior.
- `src/server/gap-analysis/next-cached-release-loader.ts`
  - add the Next `"use cache"` adapter.
- `src/server/gap-analysis/workflow-reader.ts`
  - use the cached adapter, reuse the release, and introduce bounded
    concurrency.
- `src/server/gap-analysis/reassessment-service.ts`
  - add the preauthorized/reusable internal read and parallelize independent
    metadata reads.
- `tests/gap-query-performance.test.ts`
  - cover cache identity, active-pointer freshness, release reuse, mismatch
    behavior, and concurrency.
- `docs/plans/gap-analysis-query-performance.md`
  - record the accepted scope, baseline, and verification results.

No data or public API changes are expected.

## Implementation sequence

1. Add failing deterministic tests for the active-pointer/cached-bundle seam.
2. Extract the testable direct reader seam and add the Next cached adapter.
3. Add failing tests for reassessment release reuse and mismatch behavior.
4. Split the authorized and preauthorized reassessment reads.
5. Add concurrency tests around injectable workflow dependencies.
6. Refactor the workflow into bounded concurrent phases without changing its
   returned DTO.
7. Run focused tests, type checking, and linting.
8. Re-run the read-only remote benchmark with the same data shape and record the
   results in this plan.
9. Inspect the final diff for unrelated changes.

## Tests and verification

Narrow checks:

```text
npx vitest run tests/gap-query-performance.test.ts
npx vitest run tests/gap-review-and-staleness.test.ts tests/gap-workflow-state.test.ts
```

Repository checks:

```text
npm run typecheck
npm run lint
```

Live verification:

- execute the read-only Gap-workflow benchmark against the configured remote
  Supabase fixture;
- record cold and three warm samples, SQL-call deltas, and PostgreSQL execution
  time;
- compare warm median and response shape to the 2.48-second/51-call baseline;
  and
- manually open Gap analysis and Documents pages to confirm normal rendering if
  an authenticated browser session is available.

## Risks and rollback

### Risks

- Caching a mutable field with the release bundle could serve stale state.
  Mitigation: cache only the ID-addressed localized release and resolve the
  active pointer outside the cache.
- A preauthorized helper could accidentally become a public authorization
  bypass. Mitigation: keep the public wrapper authorized, name the internal
  function explicitly, and only call it after `gap:read` succeeds.
- Over-parallelization could use data before its dependency is known.
  Mitigation: preserve explicit phases and test their call ordering.
- Release reuse could combine mismatched assessment and active releases.
  Mitigation: require matching release IDs and fail closed or use the direct
  pinned loader.
- The latency target may remain unmet because staleness and document reads still
  contain many dynamic round trips. Mitigation: benchmark before expanding
  scope; propose the consolidated reader separately.

### Rollback

Rollback is code-only:

- route the workflow back to the direct active-release loader;
- remove the preauthorized reuse path; and
- restore sequential awaits.

No data migration, cache purge, or infrastructure rollback is required. Cached
immutable bundles become unreachable when the adapter is removed or a new build
is deployed.

