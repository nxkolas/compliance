# Disposable database recreation and bootstrap

This procedure is destructive and only for an explicitly identified local,
test, development, staging, or pre-production target. Stop web and workers and
record the operator approval first.

## Recreate the application schema

Print the configured identity without credentials, visually verify it, and pass
that exact value back to the guarded command. `APP_ENV` must match the explicit
environment and production is rejected.

```powershell
node -e "require('dotenv').config({quiet:true}); const v=process.env.DRIZZLE_DATABASE_URL??process.env.DATABASE_URL; if(!v) throw Error('database URL missing'); const u=new URL(v); console.log(`${u.hostname}:${u.port||'5432'}/${u.pathname.slice(1)}`)"

npm run db:recreate:disposable -- `
  --target <host:port/database> `
  --environment preproduction `
  --confirm recreate-disposable-database
```

The command drops and recreates only the database's `public` application
schema. It does not infer a target and does not touch Auth, Storage, extension,
or other Supabase schemas.

## Build and verify the clean schema

Use the plan and guarded apply phases in the canonical
[disposable schema runbook](drizzle-workflow.md). The apply phase owns operator
SQL, Drizzle push, Storage bootstrap, verification, and the final zero-drift
proof; there is no shorter bootstrap command.

Then provision the real corpus manifest, drain legal-source processing jobs,
bind reviewed stable provisions, validate completeness, and only then activate
the exact successful generation IDs:

```powershell
npm run db:provision:legal-corpus -- provision <manifest.json>
npm run jobs:drain:local
npm run db:bind:gap-corpus-provisions
npm run db:validate:legal-corpus -- <family-code> <generation-id,...>
$env:CORPUS_OPERATOR_IDENTITY='<deployment identity>'
npm run db:activate:legal-snapshot -- <family-code> <generation-id,...>
```

Do not activate fixture-only, empty, pending, failed, unembedded, or
incompletely bound generations. After corpus provisioning, rerun the canonical
plan/apply workflow if those operations intentionally changed Drizzle-owned
state.
