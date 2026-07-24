# Development database reset, schema push, and reseed

This runbook recreates the application state in an existing **disposable,
non-production** database. It combines the repository's older Supabase
security sequence with the newer API/corpus rollout sequence.

> **Destructive operation:** `db:clear` truncates every existing
> Drizzle-managed table in `public` and cascades to dependent rows. It removes
> organizations, memberships, assessments, releases, jobs, audit history,
> reports, and corpus metadata. Take and verify a backup first. Do not use this
> procedure for production or for a database whose data must be retained.

The labels used below mean:

- **Documented** — the order is stated in an existing repository runbook or
  plan.
- **Inferred** — the order follows a dependency visible in the current script
  or application source but was not previously written as one complete
  sequence.
- **Operator decision** — the repository cannot safely choose the value or
  perform the governance step automatically.

## Sources of truth

- Ordinary schema: [`src/db/schema.ts`](../../src/db/schema.ts), applied using
  [`drizzle.config.ts`](../../drizzle.config.ts).
- Existing disposable-database sequence:
  [`database-structure.md`](../architecture/database-structure.md#authoring-and-deployment)
  and
  [`immutable-compliance-release-architecture.md`](../plans/immutable-compliance-release-architecture.md#phase-6--coordinated-development-cutover).
- Supabase extension/RLS/retention order:
  [`supabase-security-runbook.md`](supabase-security-runbook.md#execution-order).
- API/corpus post-schema order:
  [`api-corpus-rollout-runbook.md`](api-corpus-rollout-runbook.md#pre-deployment).
- Command definitions: [`package.json`](../../package.json) and the scripts in
  [`scripts/`](../../scripts/).

## What the reset does and does not clear

**Documented/script-backed:** [`scripts/clear-db.ts`](../../scripts/clear-db.ts)
discovers tables exported by the current Drizzle schema, intersects them with
the existing `public` tables, and executes one `TRUNCATE ... CASCADE`. It:

- clears only existing Drizzle-managed `public` tables;
- refuses to run when `NODE_ENV=production`;
- requires `DB_CLEAR_CONFIRM=clear-app-tables`;
- does not drop tables, enum types, extensions, functions, or storage buckets;
- does not clear Supabase Auth users or objects already stored in Supabase
  Storage.

**Inferred operational consequence:** after the database metadata is cleared,
objects already present in `organization-evidence`, `legal-corpus`, or
`compliance-reports` can be orphaned. This repository has no reviewed bulk-storage purge
script. Retain them, or clean them through a separately approved storage
procedure after identifying exact object paths.

Do **not** run `npm.cmd run db:drop:legacy` as part of this workflow.
[`scripts/drop-legacy-app-tables.ts`](../../scripts/drop-legacy-app-tables.ts)
contains names that are also part of the current application schema and drops
them with `CASCADE`; no current reset/runbook references that command.

Do not run `db:reset`; the approved repository workflow is guarded `db:clear`
followed by a reviewed `db:push`.

## Prerequisites

1. **Operator decision:** confirm that this is the intended disposable target
   and record a verified backup.
2. Work from the application directory (`compliance/my-app`) and one reviewed
   revision for web, worker, schema, and scripts.
3. Install dependencies with the repository lockfile.
4. Configure `DATABASE_URL`. If `DRIZZLE_DATABASE_URL` is also present, ensure
   both URLs identify the same Supabase project and database. Treat a mismatch
   as a hard stop, not as an invitation to choose one during the rollout.
5. Configure `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` for storage
   and administration scripts.
6. Configure a 32+ character `API_CURSOR_SECRET`, or ensure the server-only
   `SUPABASE_SECRET_KEY` is available as its fallback.
7. For corpus ingestion, configure the selected AI/embedding provider and the
   trusted worker dependencies described in
   [`api-corpus-rollout-runbook.md`](api-corpus-rollout-runbook.md#required-server-configuration).
8. Use a privileged direct or session-pooler PostgreSQL connection for DDL and
   privilege scripts. Do not use Supabase's transaction-pooler port `6543` for
   the schema push; [`drizzle.config.ts`](../../drizzle.config.ts) deliberately
   changes that port to the session-pooler port `5432`.

There is a target-selection trap worth checking explicitly:
[`scripts/clear-db.ts`](../../scripts/clear-db.ts) prefers
`DRIZZLE_DATABASE_URL`, while [`drizzle.config.ts`](../../drizzle.config.ts)
prefers `DATABASE_URL`. The approved SQL runner currently follows the clear
script, while application services and reseed commands use `DATABASE_URL`; see
[`scripts/apply-operator-sql.ts`](../../scripts/apply-operator-sql.ts) and
[`src/db/index.ts`](../../src/db/index.ts). If both variables point to different
databases, clear, operator SQL, schema push, and reseed can affect different
targets.

**Required operational rule:** do not start this runbook while the two values
identify different projects/databases. `DATABASE_URL` is the application URL
and must remain configured for publication, activation, worker, and smoke
scripts. Until the repository uses one shared connection resolver, either
configure only `DATABASE_URL`, or configure `DRIZZLE_DATABASE_URL` to the same
logical database using its privileged direct/session connection. The
recommended code fix is to centralize target resolution, or at minimum make
the clear and operator-SQL scripts prefer `DATABASE_URL` just as Drizzle and
the application do.

Print only the non-secret host/port/database identity before proceeding:

```powershell
node -e "require('dotenv').config({ quiet: true }); for (const name of ['DATABASE_URL','DRIZZLE_DATABASE_URL']) { const value=process.env[name]; if (value) { const u=new URL(value); console.log(name, { host:u.hostname, port:u.port, database:u.pathname }); } }"
```

Stop if the targets differ. Also confirm the privileged role using the query in
the [Supabase security runbook](supabase-security-runbook.md#preconditions).

## Executing the SQL files

The allow-listed operator runner
[`scripts/apply-operator-sql.ts`](../../scripts/apply-operator-sql.ts) executes
only the repository SQL files named in its source and stops on an error. Its
package command is defined in [`package.json`](../../package.json):

```powershell
npm.cmd run db:apply-operator-sql -- <repository-relative-sql-file> [...]
```

Use this runner for the exact file invocations below. It removes the local
`psql` dependency and prevents an arbitrary path from being passed accidentally.
It does not remove the need for a privileged direct/session database role, and
it currently prefers `DRIZZLE_DATABASE_URL`; resolve the target-selection
hazard above first. Unlike `db:clear`, the runner has no
`DB_CLEAR_CONFIRM` guard and no `NODE_ENV=production` refusal; its allow-list
limits files, not database targets. Target verification is therefore its
mandatory safety boundary.

**Documented fallback:** files under `supabase/sql-editor/` are also intended
to be run in the Supabase SQL Editor as a privileged operator. Open the linked
file, copy the entire contents, run it, and require success before continuing.
Do not mix targets between the runner and SQL Editor. Do not continue after an
error.

## Exact reset and schema sequence

### 1. Verify the revision

**Documented:** run code-level verification before changing the database.

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run build
```

### 2. Quiesce writers

**Inferred:** stop the web process, worker processes, scheduled monitor worker,
and any other service using this database. Otherwise a writer can recreate data
during the reset or run against a partially updated schema.

### 3. Clear Drizzle-managed data

**Documented:** set the guard only for the destructive command and remove it in
a `finally` block.

```powershell
$env:DB_CLEAR_CONFIRM = 'clear-app-tables'
try {
  npm.cmd run db:clear
  if ($LASTEXITCODE -ne 0) { throw 'db:clear failed' }
}
finally {
  Remove-Item Env:DB_CLEAR_CONFIRM -ErrorAction SilentlyContinue
}
```

Expected output: `Cleared Drizzle-managed app tables.`

### 4. Apply the pre-push SQL passes

Both files are **documented** as pre-push operations. Their combined ordering
below is **inferred** because they do not depend on one another:

1. Run
   [`supabase/sql-editor/004_gap_evidence_infrastructure.sql`](../../supabase/sql-editor/004_gap_evidence_infrastructure.sql).
   It creates `extensions.vector` before Drizzle needs the `vector(1536)` type.
2. Run
   [`scripts/sql/api-corpus-integrity-additions.sql`](../../scripts/sql/api-corpus-integrity-additions.sql).
   Its first pass preserves the correct provenance status for any pre-existing
   AI rows; after a full clear there should be no such rows, but the pass remains
   safe and keeps this sequence compatible with an additive rollout. Run this
   file again after Drizzle push: that second pass also replaces the legacy Gap
   evidence source check so legal-corpus citations can be persisted.

With the approved runner:

```powershell
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/004_gap_evidence_infrastructure.sql
npm.cmd run db:apply-operator-sql -- scripts/sql/api-corpus-integrity-additions.sql
```

### 5. Preview and apply the Drizzle schema

**Documented:** use strict/verbose mode, inspect every statement, approve only
the expected diff, and never use `--force`.

```powershell
npx.cmd drizzle-kit push --strict --verbose
```

This is the actual schema mutation. Answer the interactive prompt only after
reviewing the target and SQL diff. If Drizzle proposes an unexpected drop,
rename, or unrelated schema change, answer **No** and investigate.

### 6. Apply post-push Supabase infrastructure and base security

**Documented:** preserve the existing SQL Editor order `004`, `001`, `002`,
`003`. The explicit five-table revoke is also documented because `001` and
`002` predate those workflow tables; it is captured in the idempotent
[`workflow-server-only.sql`](../../scripts/sql/workflow-server-only.sql) file.

```powershell
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/004_gap_evidence_infrastructure.sql
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/001_server_only_definition_rls.sql
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/002_server_only_application_data_rls.sql
```

Apply the documented workflow-table revoke through its allow-listed repository
file between `002` and `003`:

```powershell
npm.cmd run db:apply-operator-sql -- scripts/sql/workflow-server-only.sql
```

Then continue with the runner:

```powershell
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/003_guest_retention_cleanup.sql
```

The statement and its placement come from
[`supabase-security-runbook.md`](supabase-security-runbook.md#execution-order).

### 7. Apply API/corpus integrity, privileges, and audit protection

**Documented:** run the integrity file a second time, followed by Phase 1
server-only privileges, legal-corpus server-only privileges, and append-only
audit protection.

```powershell
npm.cmd run db:apply-operator-sql -- scripts/sql/api-corpus-integrity-additions.sql
npm.cmd run db:apply-operator-sql -- scripts/sql/phase1-server-only.sql
npm.cmd run db:apply-operator-sql -- scripts/sql/legal-corpus-server-only.sql
npm.cmd run db:apply-operator-sql -- scripts/sql/audit-events-append-only.sql
```

**Inferred from the script header:** after pgvector and both embedding tables
exist, install the corpus HNSW index and analyze the corpus tables. This file is
not named in the current API/corpus rollout runbook, but
[`scripts/sql/legal-corpus-indexes.sql`](../../scripts/sql/legal-corpus-indexes.sql)
states that it runs after pgvector and the legal corpus tables exist.

```powershell
npm.cmd run db:apply-operator-sql -- scripts/sql/legal-corpus-indexes.sql
```

### 8. Recreate private storage buckets

**Documented:** these scripts are idempotent and must leave the buckets private.
The `organization-evidence` bucket was created or corrected by the second `004`
pass.

```powershell
npm.cmd run storage:setup:legal-corpus
npm.cmd run storage:setup:reports
npm.cmd run storage:verify
```

## Reseed in dependency order

### 1. Bootstrap a Platform Administrator

**Inferred dependency:** clearing the tables removes the platform registry.
Choose an existing Supabase Auth user's UUID and record the bootstrap reason.
The script interface is defined by
[`scripts/bootstrap-platform-administrator.ts`](../../scripts/bootstrap-platform-administrator.ts).

```powershell
$platformAdminUserId = '<existing-auth-user-uuid>'
npm.cmd run db:bootstrap:platform-admin -- $platformAdminUserId 'Development database reseed after approved reset'
```

### 2. Queue the optional NIS2 legal-corpus bootstrap fixture

**Documented:** this fixture is deliberately incomplete and must not be treated
as reviewed legal advice. **Inferred correction to the older rollout text:** the
script requires the Platform Administrator UUID as its first positional
argument.

```powershell
npm.cmd run db:seed:legal-corpus-fixture -- $platformAdminUserId
```

The script creates or reuses the `nis2-eu-primary` and `nis2-de-primary`
families and queues two URL-import jobs. It does **not** review a version,
create/publish/evaluate/activate a corpus release, or publish a compliance/Gap
release. See
[`scripts/seed-legal-corpus-fixture.ts`](../../scripts/seed-legal-corpus-fixture.ts)
and
[`nis2-bootstrap-fixture.ts`](../../src/server/corpus/nis2-bootstrap-fixture.ts).

After the worker finishes import, parsing, and embedding, inspect the
non-content quality and provenance summary before the governance checkpoint:

```powershell
npm.cmd run db:inspect:legal-corpus-fixture
```

### 3. Run the worker and complete corpus governance

**Inferred dependency:** create the storage buckets before starting imports.
The worker must process URL import, parsing, and embedding jobs.

```powershell
$env:WORKER_ID = 'development-reseed-worker'
npm.cmd run worker
```

`worker:once` handles only one leased job; a complete two-source pipeline needs
the continuous worker or repeated one-shot invocations. Keep the continuous
worker running through URL import, processing, embedding, and the corpus
evaluations below. Stop it normally only after the admin job registry shows no
queued/running reseed jobs and both evaluations have completed.

Worker startup also repairs the singleton daily cleanup schedule and any
missing active legal-source monitor jobs. Monitor schedules are fixed cadences
(`PT1H`-`PT8760H` or `P1D`-`P365D`; aliases `hourly`, `daily`, and `weekly` are
accepted). Do not add a second external scheduler for these jobs.

**Operator decision / mandatory governance checkpoint:** a human must inspect
and approve the exact generation IDs reported by
`db:inspect:legal-corpus-fixture`. After approval, use the guarded operator CLI
for **each** required family:

1. inspect the imported rendition and processing generation;
2. review the processed source version;
3. create a corpus release containing the reviewed generation;
4. publish it;
5. enqueue and pass its grounding evaluation;
6. activate it.

Do not bypass this checkpoint with direct SQL. The CLI requires the human
confirmation flag and exact EU/DE generation IDs, verifies those IDs against
the documented fixture sources and versions, and calls the audited server
commands in
[`src/server/corpus/release-service.ts`](../../src/server/corpus/release-service.ts).

```powershell
$releaseLabel = 'reviewed-bootstrap-YYYY-MM-DD'
$euGenerationId = '<approved nis2-eu-primary generation UUID>'
$deGenerationId = '<approved nis2-de-primary generation UUID>'

npm.cmd run db:approve:legal-corpus-fixture -- `
  --actor $platformAdminUserId `
  --eu-generation $euGenerationId `
  --de-generation $deGenerationId `
  --release-label $releaseLabel `
  --confirm-reviewed-sources
```

This records review, creates or safely reuses one release per family, publishes
it, and queues its evaluation. Drain both evaluation jobs with the worker, then
rerun the same command with `--activate-passed`:

```powershell
npm.cmd run worker:once
npm.cmd run worker:once

npm.cmd run db:approve:legal-corpus-fixture -- `
  --actor $platformAdminUserId `
  --eu-generation $euGenerationId `
  --de-generation $deGenerationId `
  --release-label $releaseLabel `
  --confirm-reviewed-sources `
  --activate-passed
```

The activation pass refuses releases whose evaluation state is not `passed`;
it never supplies an emergency override. The command is retry-safe for the same
label and exact member tuples. A different published membership under the same
label fails closed.

Before continuing, both required family codes must have active, published,
evaluation-passed releases:

- `nis2-eu-primary`
- `nis2-de-primary`

This ordering is required by
[`src/server/corpus/pinning.ts`](../../src/server/corpus/pinning.ts): compliance
and Gap publication fail when either required family lacks an active evaluated
release.

### 4. Publish and activate the applicability release

**Documented command, updated dependency:** run only after both corpus families
pass the preceding checkpoint. Publication pins the exact active corpus
releases; activation does not repair missing pins.

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
```

These CLI commands refuse to run when `NODE_ENV=production`.

### 5. Publish and activate the Gap release

**Documented command, updated dependency:** Gap publication requires the
published compatible applicability release and the same active corpus families.
Use the Platform Administrator UUID for the activation audit actor.

```powershell
$env:GAP_RELEASE_ACTOR_ID = $platformAdminUserId
try {
  npm.cmd run db:publish:gap -- --release nis2-gap/guided-v3
  if ($LASTEXITCODE -ne 0) { throw 'Gap publication failed' }

  npm.cmd run db:activate:gap -- --release nis2-gap/guided-v3
  if ($LASTEXITCODE -ne 0) { throw 'Gap activation failed' }
}
finally {
  Remove-Item Env:GAP_RELEASE_ACTOR_ID -ErrorAction SilentlyContinue
}
```

## Verification gates

### Schema, security, and storage

Do not use a second Drizzle push as a post-security "zero drift" check.
Supabase-only RLS state, audit triggers, and HNSW indexes are intentionally
installed outside the Drizzle model. A post-SQL `drizzle-kit push` preview can
therefore propose disabling RLS, dropping those indexes, or normalizing
PostgreSQL-truncated constraint names. Abort such a preview. Prove the final
state with the dedicated security and storage checks below instead.

```powershell
npm.cmd run db:verify:server-only
npm.cmd run storage:verify
npm.cmd run db:verify:rollout
npm.cmd run db:smoke:nis2
npm.cmd run db:smoke:gap
```

Require `db:verify:server-only` to report every public table, all expected
rollout tables, and both append-only audit triggers. Its exact coverage is
defined in
[`scripts/verify-server-only-grants.ts`](../../scripts/verify-server-only-grants.ts).
The verifier rejects any public table with RLS disabled or direct `anon` /
`authenticated` grants. The diagnostic policy queries and optional browser-role
simulation remain documented in
[`supabase-security-runbook.md`](supabase-security-runbook.md#verification).

Confirm all three buckets exist and are private:

- `organization-evidence`
- `legal-corpus`
- `compliance-reports`

The automated check is:

```powershell
npm.cmd run storage:verify
```

### Corpus/worker smoke

After at least one reviewed, published, evaluation-passed corpus release is
active, set its ID and run the corpus smoke script:

```powershell
$env:CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID = $platformAdminUserId
$env:CORPUS_SMOKE_RELEASE_ID = '<active-evaluated-corpus-release-uuid>'
try {
  npm.cmd run db:smoke:api-corpus
}
finally {
  Remove-Item Env:CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID -ErrorAction SilentlyContinue
  Remove-Item Env:CORPUS_SMOKE_RELEASE_ID -ErrorAction SilentlyContinue
}
```

This proves that a release member has a chunk, its processing job succeeded,
and a short-lived signed URL can be created; see
[`scripts/smoke-api-corpus-rollout.ts`](../../scripts/smoke-api-corpus-rollout.ts).

### Final release checks

```powershell
npm.cmd run verify
npm.cmd run test:worker
npm.cmd run test:ai
npm.cmd run build
```

Then perform the authenticated/manual smoke paths listed in
[`api-corpus-rollout-runbook.md`](api-corpus-rollout-runbook.md#smoke-gate).
Do not resume web traffic until every required gate is green.

## Failure handling

- Stop at the first failed command. Do not skip a failed SQL file and continue
  into publication.
- If strict Drizzle preview shows an unexpected destructive diff, answer **No**;
  do not use `--force`.
- Before publication, rerunning the idempotent SQL/security/storage setup is
  safe where the individual file states that it is repeatable.
- Publication is immutable. If a release was successfully published, do not
  rerun the same publication command; inspect state and continue or perform the
  repository's audited forward-fix workflow.
- Restore the verified backup if the destructive reset must be abandoned.
