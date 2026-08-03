# Schema simplification remediation evidence

Date: 2 August 2026  
Plan: [`schema-simplification-post-audit-remediation.md`](../plans/pending/schema-simplification-post-audit-remediation.md)

## Implemented and automatically verified

- One code-owned current-contract boundary each for Gap and Action Plan; no
  runtime database release lookup or numeric contract selection.
- Exact definition and exact-prompt hashes at the existing provenance seams.
- Exact `supporting`/`conflicting` finding-context relationship separate from
  `admitted`/`rejected` disposition, with strict current response validation.
- Exact worker lease ownership at job-linked AI-run creation and immediately
  before Action Plan and report publication.
- Render-attempt report snapshots whose hash and complete PDF metadata finalize
  together once.
- Independent finding/document/source presentation and no duplicate guidance in
  the UI or PDF.
- Drizzle-generated document/legal search vectors, fixed allowlisted bootstrap
  SQL, deleted migration runner/history, guarded disposable recreation, corpus
  validation, and updated operator documentation.

Automated evidence on this workspace:

- `npm run verify`: passed; 112 test files passed, 1 skipped; 548 tests
  passed, 2 skipped; lint, typecheck, and the i18n guard passed.
- `npm run test:ai`, `npm run test:worker`, `npm run test:routes`, and
  `npm run test:report`: passed.
- `npm run build`: production build passed.
- `git diff --check`: passed (line-ending conversion warnings only).

Connected read-only/rollback-only evidence against the configured target:

- exact 43-table RLS/default-deny inventory and both audit triggers: passed;
- 12 constraints, 11 indexes, generated search expressions, vector extension,
  current-pointer/plan/job integrity: passed;
- Drizzle no-change check: no changes detected;
- three private Storage buckets: passed;
- active EU corpus: 1 member, 337 chunks, 17 current provision bindings;
- active German corpus: 1 member, 238 chunks, 15 current provision bindings;
- stored search-vector values and both append-only audit streams: passed in a
  rollback-only transaction.

## Connected verification still required

The configured remote database was not recreated because the destructive
command requires an explicit target identity and matching environment approval,
and `APP_ENV` is unset. Consequently a clean recreation followed by corpus
reprocessing/rebinding/reactivation, database-backed lease/report/contradiction
concurrency coverage, and the post-recreation deterministic workflow smoke
remain operator verification. Until that evidence is recorded, the remediation
plan remains in `pending` and the historical audit is not claimed to be fully
superseded.
