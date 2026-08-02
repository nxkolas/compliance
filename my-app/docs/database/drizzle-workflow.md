# Drizzle schema-change workflow

Status: disposable pre-production workflow as of 2 August 2026.

`src/db/schema.ts` owns every ordinary public table, column, generated search
vector, constraint, index, enum, and RLS setting. Operator SQL is allowlisted to
the vector extension and two append-only audit triggers.

## Verify the target

Inspect only host, port, and database name; never print a URL or credentials.
Stop if `DATABASE_URL` and `DRIZZLE_DATABASE_URL` identify different targets.

```powershell
node -e "require('dotenv').config({quiet:true}); const v=process.env.DRIZZLE_DATABASE_URL??process.env.DATABASE_URL; if(!v) throw Error('database URL missing'); const u=new URL(v); console.log({host:u.hostname,port:u.port||'5432',database:u.pathname.slice(1)})"
```

## Four ordered stages

```powershell
npm run db:apply-operator-sql -- pre-push
npm run db:push -- --explain
npm run db:push
npm run db:apply-operator-sql -- post-push
npm run storage:bootstrap
```

Review the explanation before applying it. `--force` is not part of the normal
workflow. Both SQL stages are fixed allowlists and idempotent; the command does
not discover arbitrary SQL files.

Verify the exact public-table inventory, RLS/default deny, generated columns,
indexes, extension, constraints, and audit triggers, then check for zero drift:

```powershell
npm run db:verify:server-only
npm run db:verify:integrity
npm run storage:verify
npm run db:push -- --explain
```

The last explanation must report no changes. There is no migration runner or
checked-in migration chain for this disposable environment. Production rollout
is out of scope and requires a separately reviewed clean baseline procedure.
