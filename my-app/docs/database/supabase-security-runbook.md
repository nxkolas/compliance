# Supabase server-only data, evidence infrastructure, and guest-retention runbook

This runbook applies the Supabase-specific part of the immutable NIS2 release
cutover. Ordinary tables, constraints, indexes, and relations remain owned by
Drizzle, except for the explicitly audited remediation integrity
functions/triggers and the existing Supabase infrastructure SQL.

## Preconditions

1. Confirm the direct server connection role before changing privileges:

   ```sql
   select current_user,
          rolname,
          rolsuper,
          rolbypassrls
   from pg_roles
   where rolname = current_user;
   ```

2. The application server role must remain able to use the tables after browser grants are revoked. These scripts deliberately do not use `FORCE ROW LEVEL SECURITY`; do not add it unless the direct server role has been proven safe.
3. `004_gap_evidence_infrastructure.sql` must run once before `db:push` so the
   `extensions.vector` type exists, and again after `db:push` so it can install
   the search trigger, HNSW index, private storage bucket, and append-only audit
   trigger.

## Execution order

Run the schema and SQL Editor files in this order:

1. Run `supabase/sql-editor/004_gap_evidence_infrastructure.sql`. Before the
   Drizzle tables exist, it creates the vector extension and reports that its
   table-dependent work is deferred.
2. Apply `scripts/sql/database-remediation-pre-push.sql`.
3. Run the guarded strict Drizzle pass and
   `scripts/sql/database-remediation-identity-fks.sql` exactly as documented in
   the reset/reseed runbook.
4. Run `supabase/sql-editor/004_gap_evidence_infrastructure.sql` again.
5. Run `supabase/sql-editor/001_server_only_definition_rls.sql`.
6. Run `supabase/sql-editor/002_server_only_application_data_rls.sql`.
7. Run `scripts/sql/workflow-server-only.sql`.
8. Run `supabase/sql-editor/003_guest_retention_cleanup.sql`.
9. Run the API/corpus server-only and append-only SQL files, then
   `scripts/sql/database-remediation-integrity.sql`.

All SQL files above are idempotent. `001` and `002` fail immediately when an
expected Drizzle table is absent. The reassessment tables enable RLS in
`src/db/schema.ts`; the grant verification below remains mandatory for every
public table, including those workflow tables.

After the SQL files succeed, publish and activate the repository release separately:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
```

Publishing never changes the active pointer.

Publish and activate the separate demo Gap-Analyse release when that workflow
is required:

```powershell
npm.cmd run db:publish:gap -- --release nis2-gap/guided-v3
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v3
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

Verify browser-role grants are absent:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by grantee, table_name, privilege_type;
```

When permitted, simulate the browser roles. Both selects must fail:

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
npm.cmd run db:verify:remediation-integrity
npm.cmd run storage:verify
```

The remediation verifier exercises both valid and deliberately invalid
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

If browser access must be restored during an operational rollback, explicitly grant only the previously documented privileges and disable RLS only on the affected tables. Do not use blanket grants. The previous code revision and schema can then be restored with the approved development clear/push flow; do not use `db:reset`.
