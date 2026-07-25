# Drizzle schema-change workflow

Use this workflow for ordinary application-schema changes. Drizzle owns the
application tables, primary and foreign keys, unique and check constraints,
ordinary indexes, the two vector HNSW indexes, and RLS enablement.

Supabase/operator SQL owns database extensions, scheduled jobs, and explicitly
audited triggers. It must not duplicate Drizzle-owned objects.

## 1. Verify the database target

Confirm which URL Drizzle will use before running either command.
`DRIZZLE_DATABASE_URL` takes precedence over `DATABASE_URL`. Inspect only the
host, port, and database name; do not print credentials.

```powershell
node -e "require('dotenv').config({ quiet: true }); const value=process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL; if (!value) throw new Error('Database URL is not configured'); const u=new URL(value); console.log({ host:u.hostname, port:u.port, database:u.pathname });"
```

Stop if the target is not the intended environment.

## 2. Preview the change

```powershell
npm.cmd run db:push -- --explain
```

## 3. Review the DDL

Verify that the preview contains only the intended changes. Reject table,
column, constraint, or index drops unless they are explicitly part of the
reviewed change. Reject RLS disablement and any change outside the filtered
`public` application tables.

## 4. Apply the reviewed change

```powershell
npm.cmd run db:push
```

Drizzle v1 confirms changes by default; the old `--strict` flag no longer
exists. `--force` is not part of the normal workflow.

## 5. Verify RLS

```powershell
npm.cmd run db:verify:server-only
```

Every managed table must have RLS enabled and remain without browser policies.

## 6. Confirm zero drift

```powershell
npm.cmd run db:push -- --explain
```

The second preview must report no schema drift.

Ordinary schema changes do not require `db:clear`, reset, reseed, a pre-push
constraint pass, an identity-FK pass, or a post-push RLS pass.
