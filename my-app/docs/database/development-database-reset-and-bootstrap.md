# Development database reset and bootstrap

This procedure is destructive and only for disposable development or
pre-production databases. Stop the web app and workers first.

## Confirm the target

Configure `DATABASE_URL`/`DRIZZLE_DATABASE_URL`, then print only host, port, and
database name. Never print the URL or credentials.

```powershell
node -e "require('dotenv').config({ quiet:true }); for (const n of ['DATABASE_URL','DRIZZLE_DATABASE_URL']) { if (process.env[n]) { const u=new URL(process.env[n]); console.log(n,{host:u.hostname,port:u.port||'5432',database:u.pathname.slice(1)}); } }"
```

Stop if the identity is unexpected or the two variables identify different
databases. Use a direct/session-pooler privileged connection, not port 6543.

## Push a fresh simplified schema

Install required operator infrastructure such as the vector extension first.
Then preview, review every destructive change, apply, verify RLS, and preview
again:

```powershell
npm run db:push -- --explain
npm run db:push
npm run db:verify:server-only
npm run db:push -- --explain
```

The final preview must report zero drift. This schema-simplification cutover
does not generate or run a migration and does not backfill old rows.

## Clear rows without changing schema

```powershell
$env:DB_CLEAR_CONFIRM = 'clear-app-tables'
try { npm run db:clear } finally { Remove-Item Env:DB_CLEAR_CONFIRM -ErrorAction SilentlyContinue }
```

This truncates Drizzle-managed public tables only. It preserves extensions,
Supabase Auth users, Storage objects, and operator infrastructure. Re-run the
RLS verifier afterward.

## Bootstrap runtime data

Executable applicability/Gap definitions need no database seed, publication,
or activation. Configure private document/report/legal-corpus storage. Legal
evidence is loaded and processed through deployment-authorized tooling; once
the desired processing generations have succeeded, activate the immutable
family snapshot:

```powershell
npm run db:activate:legal-snapshot -- --family <family-code> --operator <identity> --generation <uuid> --generation <uuid>
```

Historical seed/publish/activate release commands and platform-administrator
bootstrap are intentionally obsolete.
