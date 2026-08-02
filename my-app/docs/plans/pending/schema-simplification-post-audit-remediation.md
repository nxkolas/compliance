# Schema Simplification Post-Audit Remediation

Status: proposed implementation plan; decisions confirmed on 2 August 2026  
Database posture: pre-production and disposable  
Schema rollout: Drizzle Kit `push`; no data migration or backfill

## Outcome

Finish the schema-simplification refactor without restoring the removed
database release/version control plane.

The implementation must preserve the current Gap v12 behavior and Action Plan
v6 behavior as the single code-owned runtime contracts, repair the remaining
provenance and worker-safety defects, make report exports identify the exact
content they rendered, remove obsolete migration/operator paths, restore the
intended finding-card presentation, and prove the result against a freshly
recreated database with a processed and activated legal corpus.

This plan follows the implemented simplification plan and the subsequent audit:

- [`schema-simplification-refactor.md`](../done/schema-simplification-refactor.md)
- [`schema-simplification-implementation-audit-2026-08-02.md`](../../architecture/schema-simplification-implementation-audit-2026-08-02.md)

## Confirmed Decisions

- Do not introduce Gap v13, Action Plan v7, database-authored releases,
  publication, activation, or inheritance.
- Preserve the behavior currently represented by Gap v12 and Action Plan v6,
  then expose each through one current-contract boundary in code.
- A definition hash is a deterministic fingerprint of the current code-owned
  questionnaire, requirements, mappings, prompts, and response-schema metadata.
  It is provenance/staleness data, not a publishable version.
- A prompt hash fingerprints the exact prompt used by an AI run. It is not a
  release identifier.
- Persist exact conflicting citations relationally. Keep evidence relationship
  (`supporting` or `conflicting`) separate from resolution disposition
  (`admitted` or `rejected`). Do not add a `background` relationship.
- Fence Action Plan execution and publication to the exact worker that owns the
  current live lease.
- A report snapshot becomes authoritative during the successful render
  attempt. Its `inputHash` fingerprints the exact content and item statuses
  passed to the renderer and is set once with the final PDF metadata.
- Use Drizzle `push` for ordinary schema. Retain only narrow SQL for database
  infrastructure Drizzle cannot own.
- Delete the obsolete migration runner and legacy migration history. Git
  history is sufficient for this disposable pre-production database. A future
  production rollout starts from a clean baseline.
- Recreate the disposable database after schema work, provision and process the
  legal corpus, bind stable Gap provision keys, validate the snapshot, and
  activate it.
- Verification includes automated tests and a connected clean-database/corpus
  smoke test. Live paid-provider qualification is not required now.
- Preserve the historical audit as a record and mark it superseded after this
  remediation is verified; do not rewrite its original findings.

## Finding Card and Report Presentation

Restore the presentation at commit
`daee67f28a4f4cc1196be30aa72e2a79c6b3842f` without inferring unrelated schema
deletions.

The two indicators are independent:

1. The finding header shows the status badge and exactly one organization
   document badge: **Document provided** or **No document provided**.
2. The source area shows the linked assessment, organization-document, and
   legal source badges. If there are no linked sources of any kind, it shows
   **No sources linked**.

The finding body shows the optional contradiction review notice and atomic Gap
statements. It must not render the additional duplicated guidance/description
paragraph. PDF reports follow the same content rule.

This is a read/presentation correction. It does not authorize deleting
`summary`, `guidance`, `recommendation`, or other persisted fields as part of
this plan.

## Required Invariants

The work is complete only when all of the following hold:

1. There is one executable Gap contract and one executable Action Plan contract
   selected by the deployed code, with no database release lookup.
2. Characterization fixtures prove that consolidating the current contracts
   does not change Gap v12 or Action Plan v6 behavior.
3. Historical records retain definition and prompt hashes sufficient to detect
   staleness and explain the code-owned inputs used.
4. Every conflicting citation used by contradiction resolution is identified
   exactly; unrelated organization evidence is never treated as conflicting.
5. Trusting the questionnaire rejects only the exact conflicting document
   links. Trusting the document makes only those exact excerpts authoritative
   for targeted regeneration.
6. A worker that has lost or transferred its lease cannot create an AI run,
   publish an Action Plan, or report success.
7. A completed report's `inputHash` matches the canonical payload actually
   rendered, including mutable Action Plan item statuses captured for that
   render.
8. Report PDF metadata and `inputHash` are committed together and cannot be
   replaced after completion.
9. `npm run db:push` owns all ordinary tables, columns, constraints, indexes,
   and generated search-vector columns.
10. Operator SQL references only live schema and is limited to approved
    extension/trigger infrastructure.
11. A clean database can be pushed, secured, provisioned with the corpus,
    processed, bound, validated, and activated using documented commands.
12. The finding card and PDF display the agreed badges, sources, review notice,
    and atomic statements without the duplicate prose.

## Implementation Sequence

### Phase 0: Characterize the behavior that must not change

Add failing or snapshot-based tests before refactoring:

- lock the current Gap v12 request shape, prompt/schema hashes, normalized
  result behavior, citation validation, and contradiction behavior;
- lock the current Action Plan v6 request shape, prompt/schema hashes,
  category-scoped Gap coverage, and generated output behavior;
- prove that Action Plan generation still invokes the grounded provider and
  persists the generated plan rather than copying finding fields;
- render a finding with organization evidence and sources, then one without
  either, and assert the two independent badge decisions;
- assert that finding cards and PDFs contain atomic Gap statements and an
  optional review notice but not the duplicate guidance/description; and
- capture the current clean-schema inventory so later deletion of obsolete SQL
  cannot silently delete live constraints.

The compatibility tests describe behavior, not the old numeric-version routing
mechanism. They must remain green after that mechanism is removed.

### Phase 1: Restore the intended results presentation

Update the Gap results component to:

- use the existing `hasOrganizationDocument` projection for the header badge;
- render `supportHasDocument` or `supportNoDocument` independently of the
  source list;
- retain the existing source component for exact source badges and its
  no-sources fallback;
- retain the optional review notice and atomic Gap statements; and
- stop rendering the duplicated `finding.guidance` paragraph.

Update the PDF report projection in the same way: use the immutable finding and
atomic Gap data already loaded for the report, retain the review notice, and do
not print the duplicated summary/guidance as a second description.

Do not change source-link persistence, report lineage, or finding columns in
this phase.

### Phase 2: Collapse runtime version routing into current contracts

Create one public boundary per executable product definition, for example:

- `src/server/gap-analysis/current-contract.ts`; and
- `src/server/action-plans/current-contract.ts`.

Move or re-export the current v12/v6 prompt, schema, normalization, validation,
and generation behavior through those boundaries without semantic changes.
Then:

- replace runtime numeric-version switches and inheritance chains with direct
  calls to the current boundaries;
- replace versioned job selection with stable business job kinds;
- keep completed records readable through their persisted normalized snapshots
  and hashes rather than loading an old executable contract;
- compute relevant definition hashes from canonical, key-sorted serialization
  of the code-owned definitions used by that workflow;
- compute prompt hashes from the exact normalized prompt messages and response
  schema metadata sent for that run;
- store the hashes on drafts, submitted revisions, jobs, outputs, and AI runs
  at the existing provenance boundaries; and
- reject/restart unfinished work whose definition hash no longer matches the
  deployed definition, while leaving completed results readable and outdated.

Do not add a generic global version number. Unrelated definition changes should
not stale a workflow, so reuse or introduce domain-specific hashes rather than
one all-product hash where the existing boundaries allow it.

Delete obsolete historical contract modules only after repository search proves
that runtime, readers, tests, and operator scripts no longer import them.

### Phase 3: Persist exact contradiction identity

Extend finding-context links with a constrained relationship value:

```text
supporting | conflicting
```

Keep the existing disposition as a separate dimension:

```text
admitted | rejected
```

Update the current Gap response contract so every material contradiction names
the exact allowlisted organization citation IDs involved. Validation must
reject unknown IDs, legal citations presented as organization conflicts,
duplicate IDs, and a review-required result without at least one exact conflict.

During initial publication:

- write ordinary admitted citations as `supporting`;
- write exact contradiction citations as `conflicting` and initially
  `admitted`;
- set review state only for a material conflict; and
- keep missing, weak, irrelevant, or uncited optional documents out of the
  contradiction path.

During resolution:

- query only `relationship = conflicting` for the target finding;
- trusting the questionnaire changes only those document links to `rejected`;
- trusting the document uses only those excerpts as authoritative regeneration
  context;
- preserve source choice, deciding user/time, original finding/output lineage,
  and the exact citation IDs on the new immutable revision; and
- leave unrelated supporting evidence unchanged.

The contradiction decision UI remains compact. Do not add a list of conflicting
source chips to the decision panel. The ordinary source projection continues to
follow the agreed source-badge behavior.

Because the database is disposable, express the new column/check/index in
Drizzle and apply it through a clean `push`; do not write a backfill migration.

### Phase 4: Fence Action Plan work to the lease owner

Pass the worker ID from the Action Plan worker handler into
`executeActionPlanGenerationJob` and all job-linked AI-run/publication seams.

Before inserting a job-linked AI run, lock the parent job and require:

- `state = running`;
- no cancellation request;
- a non-expired lease; and
- `leaseOwner` exactly equal to the executing worker ID.

Immediately before Action Plan publication, lock and recheck the same
conditions. Publish the plan, items, Gap links, audit event, and job success in
one transaction fenced by that ownership check. Losing the lease after provider
I/O must discard the candidate instead of publishing it.

Apply the expected-owner requirement to the shared live-parent AI-run gate so a
stale worker cannot pass merely because some worker currently owns the job.

Add concurrency tests for lease turnover before AI-run creation, during
provider execution, and immediately before publication. In every case the old
worker must leave no published plan and must not finalize the new owner's job.

### Phase 5: Hash the exact report render snapshot

Make `reports.inputHash` nullable while the report is pending. Do not assign a
placeholder hash from IDs at enqueue time.

At each eligible render attempt:

1. Load the pinned applicability revision, Gap revision, optional Action Plan,
   current item statuses, selected document versions, locale, and all content
   supplied to the PDF renderer.
2. Normalize that data into one explicit `ReportRenderSnapshot` with stable key
   and array ordering.
3. Set `capturedAt` to the render attempt time rather than `report.createdAt`.
4. Hash the canonical serialized snapshot.
5. Pass that exact in-memory snapshot to the renderer.
6. Upload to a deterministic report-ID object key so retry replaces an orphaned
   attempt rather than creating multiple objects.
7. In one transaction, recheck the live job/lease and pending report, then set
   the final storage metadata and the previously computed `inputHash` together.

A report with complete PDF metadata and a non-null hash is immutable and must
return the existing artifact on retry. A pending report may retry and recapture
mutable item status, but only the successful attempt becomes authoritative.

Tests must prove that changing content or an Action Plan item status changes the
hash, object-key order does not, a failed attempt does not set the hash, and a
completed report cannot be overwritten.

### Phase 6: Make Drizzle the single ordinary-schema path

Move both chunk search vectors into `src/db/schema.ts` as stored generated
columns using `to_tsvector('simple', coalesce(content, ''))`, retaining their
Drizzle-owned GIN indexes. This removes the document-only trigger and also fixes
the missing legal-chunk search-vector population path.

Split the remaining infrastructure into explicit, minimal stages:

1. **Pre-push database bootstrap:** create the `vector` extension required by
   the Drizzle schema.
2. **Drizzle push:** create all ordinary application schema, generated columns,
   constraints, and indexes.
3. **Post-push database bootstrap:** install only the append-only triggers for
   organization and platform audit events.
4. **Storage bootstrap:** create/verify the private legal-corpus, document, and
   report buckets and policies through the existing storage tooling.

Delete:

- `scripts/migrate.ts` and the `db:migrate` package script;
- the legacy `drizzle/` migration chain;
- stale SQL that references removed tables, columns, release catalogs, provider
  policies, or guest lifecycle fields;
- the document search-vector trigger/backfill; and
- runbook instructions that tell operators to execute those files.

Keep `db:apply-operator-sql` only if it is rewritten to apply the two explicit
database bootstrap stages idempotently. It must not discover and execute every
SQL file in a directory.

Update integrity verification to assert the Drizzle inventory, RLS/default-deny
posture, generated search columns/indexes, vector extension, and the two valid
append-only audit triggers.

### Phase 7: Recreate, provision, and activate the disposable environment

After all schema and bootstrap changes are reviewed:

1. Recreate the explicitly configured pre-production database.
2. Run the pre-push vector bootstrap.
3. Run `npm run db:push`.
4. Run the post-push append-only audit bootstrap.
5. Run `npm run storage:bootstrap`.
6. Run server-only RLS and database-integrity verification.
7. Provision the real legal corpus and its source/version/rendition records.
8. Run the corpus processing worker until every required generation is
   complete.
9. Bind every stable Gap provision key to reviewed chunks.
10. Validate corpus completeness, processing state, bindings, embeddings, and
    citation resolvability.
11. Activate the validated snapshot atomically.
12. Verify a second `db:push` reports no changes.

Do not activate an empty, fixture-only, partially processed, or incompletely
bound snapshot. Fixture seeding may support automated tests, but the retained
development environment must finish with the intended corpus active.

The recreation command must require an explicit target and environment guard;
it must never infer a broad database or filesystem target.

### Phase 8: Documentation and historical audit status

Update the current architecture and operator documentation to describe:

- code-owned current contracts and hash-based provenance without publication;
- exact supporting/conflicting link semantics;
- Action Plan worker fencing;
- render-time report snapshots;
- the four-stage database/storage setup path; and
- corpus provisioning, processing, binding, validation, and activation.

Add a prominent notice to the 2 August implementation audit stating that it is
a historical point-in-time assessment and linking to the completed remediation
evidence. Do not change its original findings or severity statements.

Move this plan from `pending` to `done` only after the connected clean-database
and active-corpus verification is recorded.

## Test and Verification Matrix

### Focused automated tests

- finding document badge and source-badge independence;
- no-sources fallback;
- no duplicate description in UI or PDF;
- Gap current-contract compatibility with v12 behavior;
- Action Plan current-contract compatibility with v6 behavior;
- definition/prompt hash determinism and sensitivity;
- exact conflict-ID validation and persistence;
- questionnaire-trust and document-trust exact-subset behavior;
- stale Action Plan worker rejection after lease turnover;
- report snapshot canonicalization, set-once hash, and retry behavior;
- Drizzle schema inventory and absence of removed tables; and
- operator SQL allowlist with no references to removed schema.

### Standard repository checks

```text
npm run verify
npm run test:ai
npm run test:worker
npm run test:routes
npm run test:report
git diff --check
```

### Connected disposable-database checks

```text
npm run db:push
npm run db:verify:server-only
npm run db:verify:integrity
npm run storage:bootstrap
```

Also run database-backed integration coverage for lease fencing, generated
search vectors, audit immutability, report finalization, exact contradiction
links, and corpus activation. Use records created by the tests and clean up only
those exact records.

### Clean workflow smoke

Against the recreated database and active corpus, exercise:

1. organization and assessment creation;
2. Gap cycle with and without an organization document;
3. grounded Gap generation with legal and organization source projection;
4. a material contradiction and both resolution choices;
5. Action Plan generation from the current resolved Gap;
6. Action Plan item status mutation;
7. PDF report generation and hash verification; and
8. historical reads after a newer Gap result marks the plan outdated.

Use a deterministic provider fixture or local test provider for this smoke. Do
not require the deferred live paid-provider qualification.

## Acceptance Gates

- Current Gap and Action Plan characterization tests remain green after
  contract consolidation.
- No runtime database publish/activate/version selection remains for executable
  definitions.
- Definition and prompt hashes change when and only when their canonical inputs
  change.
- Exact conflicting citation subsets drive both resolution paths.
- Stale Action Plan workers cannot create runs, publish, or finalize work.
- Completed report hashes reproduce from the exact rendered snapshot.
- Finding UI and PDFs match the agreed display without duplicate prose.
- `db:migrate`, `scripts/migrate.ts`, and the legacy migration chain are gone.
- Operator SQL contains only vector-extension and append-only-audit bootstrap
  infrastructure and is idempotent.
- A fresh Drizzle push passes schema, RLS, integrity, and no-change verification.
- The legal corpus is provisioned, processed, bound, validated, and active.
- All automated and connected smoke checks pass.
- Current docs are updated and the old audit is visibly marked historical.

## Commit Plan

Keep commits small and independently verifiable:

1. `test: characterize simplified gap and action plan contracts`
2. `fix: restore gap finding badges and concise result display`
3. `fix: align report finding presentation with gap results`
4. `refactor: expose gap v12 behavior as the current contract`
5. `refactor: expose action plan v6 behavior as the current contract`
6. `feat: persist exact supporting and conflicting evidence links`
7. `fix: fence action plan generation to its worker lease`
8. `fix: hash the exact successful report render snapshot`
9. `refactor: generate chunk search vectors through drizzle`
10. `refactor: replace migrations with explicit database bootstrap`
11. `test: verify clean schema corpus and grounded workflow`
12. `docs: record schema simplification remediation and operations`

Database recreation, corpus processing, and snapshot activation are reviewed
operator actions recorded after the code commits; they are not hidden inside a
schema or application commit.

## Out of Scope

- Live paid-provider qualification.
- Production migration, backfill, or rollback support.
- Reintroducing release catalogs or numeric contract activation.
- Changing the product logic currently represented by Gap v12 or Action Plan
  v6.
- Deleting persisted finding prose fields solely because the restored UI does
  not render them.
- Showing exact conflicting citation chips in the contradiction decision panel.
- New jurisdictions, Action Plan regeneration, or unrelated organization and
  invitation lifecycle work.
