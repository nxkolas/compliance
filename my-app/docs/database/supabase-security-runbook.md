# Supabase server-only data, evidence infrastructure, and guest-retention runbook

This runbook applies the Supabase-specific part of the immutable NIS2 release
cutover. Ordinary tables, constraints, indexes, and relations remain owned by
Drizzle, except for the explicitly audited integrity
functions/triggers and the existing Supabase infrastructure SQL.

Use the current [Drizzle schema-change workflow](drizzle-workflow.md) for
ordinary table, constraint, index, and RLS changes.

## Preconditions

1. Confirm the direct server connection role:

   ```sql
   select current_user,
          rolname,
          rolsuper,
          rolbypassrls
   from pg_roles
   where rolname = current_user;
   ```

2. `src/db/schema.ts` enables RLS without browser policies on every Drizzle
   table. It deliberately does not use `FORCE ROW LEVEL SECURITY`; do not add
   it unless the direct server role has been proven safe.
3. On a new database, `004_gap_evidence_infrastructure.sql` must run once
   before the first `db:push` so the `extensions.vector` type exists. Its
   table-dependent pass installs the search trigger, private storage bucket,
   and append-only audit trigger. The HNSW indexes are owned by Drizzle.

## Execution order

Run the schema and SQL Editor files in this order:

1. Run `supabase/sql-editor/004_gap_evidence_infrastructure.sql`. Before the
   Drizzle tables exist, it creates the vector extension and reports that its
   table-dependent work is deferred.
2. Follow the preview, review, apply, RLS verification, and zero-drift steps in
   the [Drizzle workflow](drizzle-workflow.md).
3. Run `supabase/sql-editor/004_gap_evidence_infrastructure.sql` again.
4. Run `supabase/sql-editor/003_guest_retention_cleanup.sql`.
5. Run the API/corpus integrity and append-only SQL files, then
   `scripts/sql/database-integrity-triggers.sql`.

All SQL files above are idempotent. RLS is not installed or modified by an
operator SQL file; Drizzle is its only source of truth.

The database-remediation pre-push and identity-FK sequence belongs only to the
historical coordinated cutover record. It is not executable through the
approved operator-SQL runner and is not part of the normal `db:push` workflow.

After the SQL files succeed, publish and activate the repository release separately:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v2
npm.cmd run db:activate:compliance -- --release nis2/2026-v2
```

Publishing never changes the active pointer.

Publish and activate the separate demo Gap-Analyse release when that workflow
is required:

```powershell
npm.cmd run db:publish:gap -- --release nis2-gap/guided-v4
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v4
npm.cmd run db:smoke:gap
```

## Verification

Verify RLS and the absence of browser policies:

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

When permitted, simulate the browser roles. With Supabase's default table
privileges, both selects must return no rows because no permissive policy
exists. A permission error is also safe.

```sql
begin;
set local role anon;
select * from public.compliance_check_releases limit 1;
rollback;

begin;
set local role authenticated;
select * from public.organizations limit 1;
rollback;
```

Then smoke-test through server APIs only: login, organization access, authenticated questionnaire load/submission/result, guest load/submission/result, guest claim, and organization-fact reuse.

Run the automated verifiers:

```powershell
npm.cmd run db:verify:server-only
npm.cmd run db:verify:integrity
npm.cmd run storage:verify
```

The integrity verifier exercises both valid and deliberately invalid
transactions. It proves composite owner/identity foreign keys, typed-value
checks, metadata-only Gap JSON, and the deferred trigger that requires exactly
one normalized finding per applicable requirement.

For the organization-only evidence workflow, also verify:

- `organization-evidence` exists and remains private;
- members can upload a supported document and a new immutable version through
  the server API;
- direct browser-role reads of documents, reassessment drafts, findings,
  action plans, and audit events fail;
- preparing a reassessment does not call AI;
- generation pins the selected immutable inputs; and
- plan creation permanently locks the generated Gap Analysis.

## Cleanup job

Inspect the optional cron job:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'compliance-guest-retention-daily';
```

If `pg_cron` is unavailable, schedule this daily through an external trusted server job:

```sql
select public.cleanup_expired_guest_applicability_checks();
```

Before using controlled fixtures, confirm that only `started` rows past 24 hours and `submitted` rows past their 14-day claim expiry are deleted. `claimed`, active, and unexpired rows must remain.

## Rollback

Rollback the cron/function without changing the Drizzle schema:

```sql
do $block$
declare job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into job_id from cron.job where jobname = 'compliance-guest-retention-daily';
    if job_id is not null then perform cron.unschedule(job_id); end if;
  end if;
end
$block$;

drop function if exists public.cleanup_expired_guest_applicability_checks();
```

If browser access must be introduced, add an explicitly reviewed Drizzle policy
for only the affected table and operation. Do not disable RLS or add blanket
policies. The previous code revision and schema can be restored with a reviewed
Drizzle push; do not use `db:reset`.
