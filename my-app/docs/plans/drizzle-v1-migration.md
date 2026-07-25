# Drizzle v1 Migration Plan

Status: proposed; no migration work has been applied.

This plan follows the official
[Drizzle v1 upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) and
[v0 to v1 breaking-change reference](https://orm.drizzle.team/docs/v0-v1-changes).
The Relational Queries work follows Drizzle's
[RQB v1 to v2 guide](https://orm.drizzle.team/docs/relations-v1-v2).

## Goal

Upgrade this application from Drizzle ORM `0.45.2`, Drizzle Kit `0.31.10`,
and Drizzle Seed `0.3.1` to the Drizzle v1 release candidate so that:

- the application compiles and behaves correctly with Drizzle v1;
- `drizzle-kit push` no longer reports false composite-constraint drift;
- PostgreSQL constraint names are stable and no longer drift because of the
  63-byte identifier limit;
- the two HNSW indexes are owned by the Drizzle schema rather than duplicated
  in operator SQL;
- RLS remains owned solely by the Drizzle schema; and
- ordinary schema changes use a short, documented `push --explain` and `push`
  workflow without clearing and rebuilding the database.

## Scope boundaries

This migration does not introduce `patch-package`, a database trigger for
RLS, browser-facing RLS policies, role/grant statements, or a replacement
migration framework.

The existing `schemaFilter: "public"` and explicit `tablesFilter` in
`drizzle.config.ts` remain in place. Drizzle v1 manages every schema by
default, so retaining `schemaFilter` is necessary to keep Supabase-owned
schemas outside Drizzle's scope.

Do not clear or reseed the configured database as part of this migration.
Do not use `--force`.

## Confirmed baseline

- `drizzle/meta/_journal.json` is the only current migration artifact and has
  no entries.
- `src/db/schema.ts` contains 123 `.enableRLS()` calls.
- The schema contains 26 legacy `relations(...)` declarations.
- Production and supporting code contains approximately 306 relational-query
  call sites.
- No source, script, or test currently imports `drizzle-seed`.
- PostgreSQL currently contains these operator-created indexes, while the
  Drizzle schema does not:
  - `document_chunk_embeddings_hnsw_idx`
  - `legal_source_chunk_embeddings_hnsw_idx`
- The legacy Kit introspector loses column ordinality for composite
  constraints. Some foreign keys are therefore reconstructed with incorrect
  source-to-target column pairing.
- Twenty-six generated primary-key or foreign-key names exceed PostgreSQL's
  63-byte identifier limit and are truncated in the database.
- Nine composite unique constraints have also appeared as false drift even
  though their database names and definitions are correct.

## Migration sequence

### 1. Install the Drizzle v1 packages

Use the package commands from the official guide:

```powershell
npm.cmd install drizzle-orm@rc drizzle-seed@rc
npm.cmd install --save-dev drizzle-kit@rc
```

Commit the resulting `package.json` and lockfile changes. Do not add dependency
patching or post-install scripts.

Record the resolved RC versions in the implementation commit and ensure the
three Drizzle packages resolve to the same release line.

### 2. Upgrade the migration folder

Run the official folder upgrader:

```powershell
npx.cmd drizzle-kit up
```

Expected result:

- the legacy journal is removed;
- the `drizzle` directory uses the v3 migration-folder layout; and
- no application schema change is generated merely because the empty journal
  changed format.

Review and commit every file produced by `drizzle-kit up`. Do not hand-create a
parallel journal.

### 3. Apply the documented schema API changes

Update all Drizzle-managed tables from:

```ts
pgTable(...).enableRLS();
```

to:

```ts
pgTable.withRLS(...);
```

Preserve the current default-deny design: enable RLS and declare no browser
policies. Do not add role or grant statements.

Also search for every other breaking API listed in the v1 reference:

- chained multidimensional `.array()` calls;
- non-SQL `generatedAlwaysAs(...)` values;
- `getTableColumns`;
- legacy connection-level `casing`;
- validator imports from the standalone Drizzle validator packages.

Only change APIs that are present in this repository.

### 4. Migrate Relational Queries from v1 to v2

Follow the official RQB migration guide.

1. Use Drizzle Kit's v1 `pull` support to generate a v2 relations reference
   from the configured database.
2. Move the reviewed relation definitions into `src/db/relations.ts` and point
   their schema import at `src/db/schema.ts`.
3. Replace the 26 table-local `relations(...)` declarations with one
   `defineRelations(...)` definition.
4. Change `src/db/index.ts` to initialize Drizzle with the new `relations`
   object instead of the legacy `schema` object.
5. Migrate relational queries to the v2 syntax:
   - callback `where` expressions become object filters;
   - callback `orderBy` expressions become object ordering;
   - `relationName` becomes `alias`;
   - relation `fields` and `references` become `from` and `to`;
   - nested junction-table reads use v2 relations without changing returned
     application DTOs.
6. Preserve existing projections, nullability, ordering, transaction
   boundaries, and not-found behavior.

Treat the pulled relation file as generated migration assistance, not as a new
source of truth. Remove the generated duplicate schema and relation files after
the reviewed definitions have been transferred.

Migrate in coherent feature groups and run type checking and the affected test
files after each group. A suggested order is:

1. database helpers and shared authorization;
2. organizations and memberships;
3. compliance definitions and releases;
4. assessments and documents;
5. Gap Analysis and action plans;
6. legal corpus and AI processing;
7. workers, scripts, and test helpers.

### 5. Move the HNSW indexes into the Drizzle schema

Declare both existing indexes in `src/db/schema.ts` with Drizzle's PostgreSQL
index API:

```ts
index("...").using("hnsw", table.embedding.op("vector_cosine_ops"))
```

The schema must own:

- `document_chunk_embeddings_hnsw_idx` on
  `document_chunk_embeddings.embedding`; and
- `legal_source_chunk_embeddings_hnsw_idx` on
  `legal_source_chunk_embeddings.embedding`.

Remove only the duplicate `CREATE INDEX` statements from:

- `scripts/sql/legal-corpus-indexes.sql`; and
- `supabase/sql-editor/004_gap_evidence_infrastructure.sql`.

Keep Supabase/PostgreSQL setup that Drizzle does not own, including creation of
the `vector` extension. Keep `ANALYZE` commands only where the operator
runbook still uses them for query-planner maintenance.

### 6. Stabilize PostgreSQL constraint names

Add explicit names of at most 63 bytes to every primary key and foreign key
whose generated Drizzle name currently exceeds PostgreSQL's identifier limit.
Names must be descriptive, unique within their table schema, and stable across
future Drizzle releases.

Apply the one-time transition as in-place constraint renames. The reviewed SQL
must use:

```sql
ALTER TABLE ... RENAME CONSTRAINT ... TO ...;
```

Do not drop and recreate equivalent primary keys, unique constraints, or
foreign keys. A rebuild would add avoidable locks and could transiently remove
integrity enforcement.

After installing Drizzle v1, re-run introspection before changing the nine
correct composite unique constraints. If v1 reads their names and column order
correctly, leave them unchanged. Do not reorder schema columns to accommodate
the legacy Kit bug.

For every composite foreign key, compare the ordered source and target column
arrays with PostgreSQL catalog ordinality. The migration is not acceptable if
any source column is paired with the wrong referenced column.

### 7. Preview and apply the database change

Use the v1 preview command documented by Drizzle:

```powershell
npm.cmd run db:push -- --explain
```

The preview may contain only:

- conversion to schema-owned RLS representation without disabling RLS;
- creation or recognition of the two HNSW indexes;
- the approved in-place constraint-name transition; and
- any v1 metadata change required by `drizzle-kit up`.

Reject the preview if it contains:

- table, column, primary-key, unique-constraint, or foreign-key drops;
- a composite foreign key with reordered referenced columns;
- HNSW index drops;
- RLS disablement;
- Supabase-owned schema changes; or
- unrelated DDL.

Apply the reviewed change with:

```powershell
npm.cmd run db:push
```

Run the explain command again after application. The second preview must show
no schema drift.

### 8. Verify application behavior

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:i18n
npm.cmd run build
npm.cmd run db:verify:server-only
```

Add or update regression coverage for:

- every Drizzle table using `pgTable.withRLS`;
- operator SQL containing no RLS enablement, RLS policy, role, or grant DDL;
- both HNSW indexes being declared exactly once in the Drizzle schema;
- operator SQL containing no duplicate HNSW `CREATE INDEX`;
- all explicit constraint names staying within 63 bytes;
- ordered composite foreign-key source and target columns; and
- representative RQB v2 reads with nested relations, filters, ordering, and
  transactions.

Run the existing database smoke commands relevant to the changed query groups
after the static and unit-test gates pass.

### 9. Replace the stale Drizzle workflow documentation

Create `docs/database/drizzle-workflow.md` as the current operational
documentation. It should describe only:

1. verify the intended database target;
2. run `npm.cmd run db:push -- --explain`;
3. review the DDL;
4. run `npm.cmd run db:push`;
5. run the RLS verifier; and
6. confirm a second explain reports no drift.

The workflow must state that:

- Drizzle owns tables, constraints, ordinary indexes, the two HNSW indexes,
  and RLS enablement;
- Supabase/operator SQL owns extensions, scheduled jobs, and audited triggers;
- ordinary schema changes do not require `db:clear`, reset, reseed, a
  pre-push constraint pass, or a post-push RLS pass;
- `--strict` no longer exists in v1 because confirmation is the default; and
- `--force` is not part of the normal workflow.

Remove `docs/database/database-reset-and-reseed.md` from the current-operations
index and either delete it or clearly mark it as a historical cutover runbook.
Update current operational references in:

- `docs/README.md`;
- `docs/database/supabase-security-runbook.md`;
- `docs/database/api-corpus-rollout-runbook.md`; and
- `docs/architecture/database-structure.md`.

Historical plans and the dated reset/reseed postmortem may retain their
original commands as historical evidence, but they must link to the new
workflow for current operations and must not present `push --strict`, database
clearing, or the coordinated two-pass constraint procedure as current advice.

## Completion criteria

The migration is complete only when:

- the repository uses the Drizzle v1 RC packages and v3 migration layout;
- no RQB v1 definitions or query syntax remain;
- no `.enableRLS()` calls remain;
- all 123 managed tables still have RLS enabled and no browser policies;
- both HNSW indexes are declared in Drizzle and absent from operator index DDL;
- every explicit constraint name is at most 63 bytes;
- every composite foreign key retains its correct ordered column pairing;
- `db:push -- --explain` reports no destructive or unrelated DDL before the
  application step and no drift afterward;
- lint, type checking, tests, i18n checks, build, RLS verification, and
  relevant database smoke tests pass; and
- the new Drizzle workflow is the only documentation presented as the current
  ordinary schema-change procedure.

## Rollback

Before the database application step, rollback is a normal code revert.

After database application:

1. revert the application and schema changes together;
2. rename constraints back in place if the previous schema requires their old
   names;
3. restore the two operator-owned HNSW definitions only if rolling back to the
   old Drizzle schema; and
4. use `push --explain` from the restored toolchain before applying any reverse
   DDL.

Do not use a database clear or reset as rollback.
