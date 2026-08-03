# Disposable schema plan and apply runbook

Status: canonical disposable non-production database workflow as of 3 August
2026.

This is the only normal workflow for pushing the Drizzle schema. It plans first,
requires a human target acknowledgement, then applies operator SQL, schema,
storage, verification, and a final zero-drift check as one guarded operation.
Production migrations and the separately destructive database recreation command
are outside this workflow.

## Configuration and safety boundary

Set `APP_ENV` to exactly one of `development`, `local`, `test`,
`preproduction`, or `staging`. Any other or missing classification is rejected.

`DATABASE_URL` is the application connection and `DRIZZLE_DATABASE_URL` is the
schema connection. If both are present, their host, port, and database must
match exactly. Credentials may differ and are never displayed. If only one is
configured, it is used as both identities. Make the schema connection explicit
when the application normally uses a different pooler port.

The safe target identity always has this form:

```text
host:port/database
```

No normal workflow command supplies `--force`, discovers SQL files, recreates a
schema, or accepts a production-like environment.

## 1. Plan without mutation

```powershell
npm run db:plan:disposable
```

The command validates the environment and both database configurations, prints
only the safe target identity, and runs `drizzle-kit push --explain`. It does not
apply operator SQL, schema changes, storage changes, or verification writes.

Review the proposed SQL and data-loss warnings. Stop if the target or any change
is unexpected. Record the displayed target only after the explanation is
approved.

## 2. Apply, verify, and prove zero drift

Pass the exact target displayed by the approved plan:

```powershell
npm run db:apply:disposable -- --target <host:port/database>
```

Before starting a child process, apply repeats the environment and target checks
and rejects a missing or different acknowledgement. It then stops on the first
failed stage and runs these fixed stages in order:

1. pre-push operator SQL (`extensions.vector`);
2. Drizzle schema push;
3. post-push operator SQL (the two append-only audit triggers);
4. private Storage bootstrap;
5. server-only RLS verification;
6. database integrity verification;
7. private Storage verification; and
8. final Drizzle explanation.

Success prints the safe target and a compact completed-stage list. The final
explanation must contain `No changes detected`; otherwise the command fails even
when every earlier stage succeeded.

## Failure and retry handling

Fix the failed stage, rerun the plan if schema code or target configuration
changed, and rerun the entire guarded apply command with the reviewed target.
The fixed operator SQL, Drizzle push, Storage reconciliation, and verification
stages are designed to be safely repeatable for a disposable environment. The
workflow does not skip completed stages, so the final summary is evidence that
all checks ran together.

Do not bypass a failure with a direct `db:push`, `--force`, hand-selected SQL,
or an unverified Storage setup. Production rollout and rollback require their
own reviewed migration and recovery procedure.

## Expected evidence

A successful operator record contains:

- the `APP_ENV` classification;
- the credential-free target identity;
- the reviewed plan output;
- every apply-stage heading in the documented order; and
- `Disposable schema apply complete with zero drift` after the final
  `No changes detected` explanation.
