# Run long-lived generation as jobs

Gap-Analyse generation, PDF creation, and future long-running AI operations will execute as durable worker jobs rather than holding HTTP requests open. Commands return `202 Accepted` with a job or run resource for polling, retries remain explicit and idempotent, and current accepted business results stay authoritative until a generated candidate completes review and approval.

## Generation lifecycle addendum

Versioned Gap and Action Plan jobs use structured category concurrency. The
first terminal category failure stops dequeueing, aborts active siblings, waits
for every worker to settle, and remains the primary error. A job-linked AI run
is inserted only while the locked parent is running, uncancelled, leased, and
in the same organization.

Generation terminalization is transactional. Failure and cancellation update
the job, every linked processing run, the reassessment draft where applicable,
and the privacy-safe audit event together. Successful persistence also closes
any rejected processing candidate superseded by a repaired category before
asserting that no processing child remains.

The scheduled cleanup job performs bounded, lock-safe reconciliation of
processing AI runs whose parent is already terminal. The operator repair
command uses the same rules and defaults to dry-run.
