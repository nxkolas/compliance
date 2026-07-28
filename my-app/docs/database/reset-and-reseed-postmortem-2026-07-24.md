# Development reset and reseed postmortem - 2026-07-24

## Summary

The disposable development database was cleared and successfully reseeded
during the rollout of AI-generated output-language pinning. No unexpected data
was lost: the target had been confirmed as disposable, a verified backup
existed, and application writers were quiesced.

Two commands failed during the rollout:

1. the first Drizzle schema push failed after partially applying its DDL; and
2. an incorrect Gap release reference was passed to the publisher.

Two additional operations succeeded but had insufficient progress reporting:
legal-corpus embedding and compliance-release publication.

The rollout recovered without restoring the backup. All final database,
security, storage, corpus, smoke, test, and build verification gates passed.

## Impact

- The database temporarily contained a partially applied application schema
  after the first Drizzle push failed.
- No web, worker, or monitor process accessed that intermediate schema.
- The incorrect Gap release command made no database changes.
- The final rollout had:
  - both required legal-corpus families reviewed, evaluated, and active;
  - active `nis2/2026-v1` and `nis2-gap/guided-v3` releases;
  - all 113 public tables covered by the server-only security verifier;
  - all three required private storage buckets;
  - zero unfinished rollout jobs; and
  - all automated verification gates passing.

## What failed

### 1. Drizzle emitted dependent constraints in an invalid order

The proposed schema attempted to enforce action-plan output-locale inheritance
with a composite foreign key from the action plan's source revision and locale
to a composite unique key on the generated artifact revision.

During `drizzle-kit push`, the foreign key was emitted before PostgreSQL had the
supporting composite unique constraint. PostgreSQL rejected the foreign key.
The push was not atomic: earlier column and type changes had already been
applied, while some later checks had not.

#### Recovery

The rollout stopped at the failure. The partially applied schema was inspected
before any retry. The composite database constraint was removed from this
change, and equivalent fail-closed validation was retained inside the
action-plan finalization transaction:

- the source revision must carry `de` or `en`;
- its relational locale must match the immutable result snapshot; and
- any existing plan must match its source revision and snapshot.

The strict schema push was rerun, followed by every required post-push
integrity, RLS, privilege, audit, and index SQL pass.

#### Root cause

`drizzle-kit push` was used as the schema deployment mechanism for a change
whose correctness depended on explicit DDL ordering. The generated push plan
was reviewed for the intended objects, but its dependency ordering was not
validated against a fresh database before the destructive reset.

### 2. The wrong Gap release reference was attempted

The first Gap publication command used:

```text
nis2-gap/2026-v1
```

The repository registers the intended release as:

```text
nis2-gap/guided-v3
```

The publisher rejected the unknown reference before writing any rows. The
command was then rerun with the registered reference and succeeded.

The authoritative reset runbook already contained the correct reference. This
was an execution deviation caused by relying on an abbreviated working summary
instead of copying the command from the runbook or registry.

### 3. PowerShell did not propagate the native command failure

The first incorrect Gap command was inside a PowerShell `try`/`finally` block
that cleaned up an environment variable but did not test `$LASTEXITCODE`.
Windows PowerShell does not automatically turn a nonzero `npm.cmd` exit into a
terminating error. The npm error was visible, but the outer shell invocation
reported success after the `finally` block.

The runbook's canonical Gap commands already check `$LASTEXITCODE`. The
corrected execution used those checks.

## What was slow or opaque

### Legal-corpus embedding

The EU embedding job sent 337 chunks through one `embedMany` operation and took
about 126 seconds without intermediate progress output. The German job embedded
243 chunks in about 35 seconds. Both completed successfully.

The current handler does not persist partial batch progress, so a provider or
network failure late in a large request would retry the entire generation.

### Compliance-release publication

Compliance publication succeeded but took several minutes without progress
output. The publisher performs many serial reads and writes against the remote
database inside one transaction. The absence of phase logs made normal work
look like a stalled process and increases the operational cost of diagnosing a
real timeout.

## Preventive changes

These items are follow-up work; they were not all implemented during the
rollout.

### P0 - make schema deployment ordered and atomic

- Use checked-in SQL migrations for coordinated schema changes instead of
  relying on interactive `drizzle-kit push`.
- Execute related DDL in a transaction where PostgreSQL permits it.
- Explicitly order new columns, backfills, referenced unique constraints,
  foreign keys, and validation checks.
- Reintroduce the action-plan/revision locale invariant as a database
  constraint only through an ordered, rehearsed migration.
- If a schema command fails, require a schema-state inspection before retrying.

### P0 - provide one fail-fast reset orchestration command

- Add a repository-owned reset/reseed script that executes the authoritative
  runbook sequence.
- Wrap every native command in a helper that throws when `$LASTEXITCODE` is
  nonzero.
- Stop immediately after the first failed command while still running cleanup
  in `finally`.
- Keep destructive confirmation values scoped only to their individual
  commands.

### P0 - validate immutable inputs before clearing data

Before `db:clear`, the orchestration command should validate:

- `DATABASE_URL` and `DRIZZLE_DATABASE_URL` resolve to the same approved
  disposable target;
- the database role and database name are expected;
- the operator has confirmed a verified backup;
- the Platform Administrator Auth UUID exists;
- every requested compliance and Gap release reference exists in the
  repository registry; and
- required provider and storage credentials are configured.

This would have rejected the incorrect Gap release reference before the
destructive boundary.

### P1 - rehearse the complete rollout in CI

- Start from the same pre-rollout schema state.
- Run the exact pre-push SQL, migration, post-push SQL, reseed, and verifier
  sequence against a disposable database.
- Include a test that deliberately passes an invalid release reference and
  asserts that the top-level process exits nonzero.
- Verify the expected RLS policies, triggers, constraints, and HNSW indexes
  after migration rather than using a second Drizzle push as a drift check.

### P1 - make worker draining finite and observable

- Add a `worker:drain` command scoped to the reseed job kinds.
- Exit successfully when the relevant queue is empty.
- Report job kind, phase, completed units, total units, elapsed time, and retry
  count.
- Avoid requiring interactive `Ctrl+C` termination of `npm.cmd` on Windows.

### P1 - batch and resume embeddings

- Split large embedding generations into bounded provider requests.
- Persist completed batch progress idempotently.
- Resume from the last committed batch after retry.
- Apply explicit provider timeouts and distinguish retryable provider failures
  from permanent validation failures.

### P2 - reduce compliance-publication round trips

- Load existing catalog state in batches.
- Use batched inserts/upserts where invariants permit them.
- Emit structured phase progress while preserving the atomic publication
  boundary.
- Add a transaction-duration metric and a clear timeout failure.

## Operational rules retained

- Never continue after a failed schema command.
- Never let application writers run against an intermediate reset state.
- Never bypass the exact-generation corpus governance checkpoint with direct
  SQL.
- Never resume application traffic until the dedicated security, storage,
  rollout, corpus, applicability, Gap, test, and build gates pass.
- RLS is now declared in the Drizzle model. Operator-owned triggers and HNSW
  indexes still require their dedicated verifiers.

## Related references

- [Current development database reset and bootstrap](development-database-reset-and-bootstrap.md)
- [API and legal-corpus rollout runbook](api-corpus-rollout-runbook.md)
- [Supabase security runbook](supabase-security-runbook.md)
- [AI-generated output-language pinning plan](../plans/done/ai-generated-output-language-pinning.md)
