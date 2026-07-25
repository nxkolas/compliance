# Development database reset and bootstrap

Use this runbook to clear and rebuild a disposable nonproduction database. It
supports both:

- clearing application data while preserving the current schema; and
- bootstrapping a fresh database before seeding the framework and legal corpus.

`db:clear` truncates every existing `public` table managed by
[`src/db/schema.ts`](../../src/db/schema.ts), with `CASCADE`. It does not drop
the schema, extensions, operator-owned functions or triggers, Supabase Auth
users, or Storage buckets and objects.

Never use this runbook against production. Confirm the target and take a
verified backup before any destructive step.

## Preconditions

1. Work from `compliance/my-app` at one reviewed revision.
2. Stop the web app, workers, and every other writer using the target.
3. Configure `DATABASE_URL`. If `DRIZZLE_DATABASE_URL` is also set, both must
   identify the same project and database.
4. Configure the Supabase and AI/embedding settings required by
   [the corpus rollout runbook](api-corpus-rollout-runbook.md#required-server-configuration).
5. Use a privileged direct or session-pooler PostgreSQL connection for schema
   and operator SQL. Do not use the transaction-pooler port `6543`.

Print only the non-secret target identities:

```powershell
node -e "require('dotenv').config({ quiet: true }); for (const name of ['DATABASE_URL','DRIZZLE_DATABASE_URL']) { const value=process.env[name]; if (value) { const u=new URL(value); console.log(name, { host:u.hostname, port:u.port, database:u.pathname }); } }"
```

Stop if either target is unexpected or the two targets differ.

## Choose the database path

### Clear data and keep the current schema

Use this for the normal development reset:

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

Expected output is `Cleared Drizzle-managed app tables.`

The schema and operator-owned infrastructure remain installed. Confirm that
the schema still has zero drift:

```powershell
npm.cmd run db:push -- --explain
npm.cmd run db:verify:server-only
npm.cmd run db:verify:integrity
```

Do not run `db:push` when the preview contains an unexpected destructive
change. Follow the [Drizzle schema-change workflow](drizzle-workflow.md) for a
reviewed schema change.

### Bootstrap a fresh database

Use this only when the application schema is absent. Install the vector
extension first, then create the Drizzle-owned schema:

```powershell
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/004_gap_evidence_infrastructure.sql
npm.cmd run db:push -- --explain
npm.cmd run db:push
npm.cmd run db:verify:server-only
npm.cmd run db:push -- --explain
```

Review the preview before applying it. The final preview must report no drift.
Then install the permanent operator-owned infrastructure:

```powershell
npm.cmd run db:apply-operator-sql -- `
  supabase/sql-editor/004_gap_evidence_infrastructure.sql `
  supabase/sql-editor/003_guest_retention_cleanup.sql `
  scripts/sql/api-corpus-integrity-additions.sql `
  scripts/sql/audit-events-append-only.sql `
  scripts/sql/database-integrity-triggers.sql `
  scripts/sql/legal-corpus-indexes.sql
```

The approved SQL runner accepts only repository files in its allowlist. The
SQL files above are idempotent. Drizzle owns tables, constraints, RLS, ordinary
indexes, and both HNSW indexes; operator SQL owns extensions, scheduled jobs,
storage infrastructure, and explicitly audited functions and triggers.

Create or reconcile the private Storage buckets:

```powershell
npm.cmd run storage:setup:legal-corpus
npm.cmd run storage:setup:reports
npm.cmd run storage:verify
```

## Bootstrap the platform administrator

Clearing the managed tables removes the platform-administrator registry but
does not delete Supabase Auth users. Choose an existing Auth user UUID:

```powershell
$platformAdminUserId = '<existing-auth-user-uuid>'
npm.cmd run db:bootstrap:platform-admin -- `
  $platformAdminUserId `
  'Development database bootstrap after approved reset'
```

## Seed and activate the legal corpus

The bundled NIS2 fixture is intentionally incomplete. It queues imports but
does not constitute legal review or activate any release:

```powershell
npm.cmd run db:seed:legal-corpus-fixture -- $platformAdminUserId
```

Start the worker and let it drain URL import, parsing, and embedding jobs:

```powershell
$env:WORKER_ID = 'development-bootstrap-worker'
npm.cmd run worker
```

Inspect the resulting generations:

```powershell
npm.cmd run db:inspect:legal-corpus-fixture
```

A human must review the exact EU and German generations. Record that approval
through the guarded command; do not update governance state with direct SQL:

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

Let the worker complete both evaluation jobs, then activate only passed
releases:

```powershell
npm.cmd run db:approve:legal-corpus-fixture -- `
  --actor $platformAdminUserId `
  --eu-generation $euGenerationId `
  --de-generation $deGenerationId `
  --release-label $releaseLabel `
  --confirm-reviewed-sources `
  --activate-passed
```

Both `nis2-eu-primary` and `nis2-de-primary` must now have active, published,
evaluation-passed releases.

## Publish the compliance and Gap frameworks

Publish the compliance release only after both required corpus releases are
active:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v2
npm.cmd run db:activate:compliance -- --release nis2/2026-v2
```

Publish the compatible Gap release and identify its audit actor:

```powershell
$env:GAP_RELEASE_ACTOR_ID = $platformAdminUserId
try {
  npm.cmd run db:publish:gap -- --release nis2-gap/guided-v4
  if ($LASTEXITCODE -ne 0) { throw 'Gap publication failed' }

  npm.cmd run db:activate:gap -- --release nis2-gap/guided-v4
  if ($LASTEXITCODE -ne 0) { throw 'Gap activation failed' }
}
finally {
  Remove-Item Env:GAP_RELEASE_ACTOR_ID -ErrorAction SilentlyContinue
}
```

## Verification gates

Run the core checks:

```powershell
npm.cmd run db:push -- --explain
npm.cmd run db:verify:server-only
npm.cmd run db:verify:integrity
npm.cmd run storage:verify
npm.cmd run db:verify:rollout
npm.cmd run db:verify:localized-metadata
npm.cmd run db:verify:gap-requirements
npm.cmd run db:smoke:nis2
npm.cmd run db:smoke:gap
npm.cmd run db:benchmark:indexes
npm.cmd run verify
npm.cmd run build
```

The Drizzle preview must report no schema drift. The storage verifier must
confirm that `organization-evidence`, `legal-corpus`, and
`compliance-reports` exist and remain private.

The corpus and authenticated Gap smoke tests require active-record IDs:

```powershell
$env:CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID = $platformAdminUserId
$env:CORPUS_SMOKE_RELEASE_ID = '<active-evaluated-corpus-release-uuid>'
$env:REMEDIATION_SMOKE_USER_ID = $platformAdminUserId
try {
  npm.cmd run db:smoke:api-corpus
  npm.cmd run db:smoke:country-support
  npm.cmd run db:smoke:authenticated-gap
}
finally {
  Remove-Item Env:CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID -ErrorAction SilentlyContinue
  Remove-Item Env:CORPUS_SMOKE_RELEASE_ID -ErrorAction SilentlyContinue
  Remove-Item Env:REMEDIATION_SMOKE_USER_ID -ErrorAction SilentlyContinue
}
```

Use the complete [API/corpus rollout smoke gate](api-corpus-rollout-runbook.md#smoke-gate)
for organization-specific runtime benchmarks and manual acceptance checks.

## Failure handling

- Stop at the first failed command.
- Never use `db:push --force` to bypass an unexpected diff.
- Do not resume writers while schema, security, storage, or release checks are
  failing.
- Publication is immutable. Inspect a partially completed publication and
  continue through the audited commands; do not repair it with direct SQL.
- Restore the verified backup if an approved destructive reset must be
  abandoned.
