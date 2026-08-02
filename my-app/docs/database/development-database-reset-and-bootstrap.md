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

Follow the ordered four-stage commands in
[the Drizzle workflow](drizzle-workflow.md). For a disposable local/staging
container, `npm run db:bootstrap:disposable` performs pre-push, Drizzle push,
and post-push in that order; storage remains its explicit fourth stage.

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
incompletely bound generations. Finish with integrity verification and a second
Drizzle explanation showing no drift.
