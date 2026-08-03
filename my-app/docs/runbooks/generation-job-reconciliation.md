# Generation job reconciliation and orphan repair

Generation jobs must never be terminal while a linked AI processing run
remains `processing`. Scheduled cleanup checks this invariant in bounded
batches using row locks and `SKIP LOCKED`. It closes only rows that still match
under lock, records privacy-safe audit metadata, and is idempotent.

Gap and Action Plan category generation use two levels of identity. A category
phase (`initial` or `repair`) has a stable reservation for the requested job,
while every actual provider call has an append-only attempt identity derived
from the durable job attempt and bounded provider attempt. A later lease may
recover a compatible validated result from the same reservation without
calling the provider again. Failed attempts and processing attempts without
validated output are never recovered.

Starting a successor call under a live parent lease abandons older empty
processing attempts. Publication is fenced by the current live lease and marks
unselected processing attempts as superseded. A user-requested Gap retry nonce
creates a new reservation; the queue's attempt count only creates new call
attempts beneath an existing reservation.

Run the operator command in dry-run mode first:

```powershell
npm.cmd run db:repair:orphan-ai-runs -- --dry-run
```

The default is also dry-run. Output is deliberately limited to run ID, parent
job ID, parent state, timestamps, and the proposed safe code. It never prints
prompts, model output, evidence, source excerpts, or signed URLs.

Review the entire selected set before applying:

```powershell
npm.cmd run db:repair:orphan-ai-runs -- --apply
```

Apply rechecks every row under lock and reports selected, changed, skipped, and
remaining counts. A second run must change zero rows.

For the 2026-07-28 incident, the expected parent is
`67d29cee-4cf0-4fed-aa3d-1bcaae1d1128`, with four known processing children.
The 2026-07-29 dry-run selected 39 rows globally, including those four, and
reported 143 late category diagnostics. The operator subsequently approved the
complete set: apply changed all 39 rows, skipped zero, and reported zero
remaining. The immediate follow-up dry-run selected zero rows. The incident's
v8 draft was not retried or repinned.

After an approved apply, rerun dry-run and the worker-health invariant query.
Both the global remaining count and the incident parent’s processing-child
count must be zero before release activation.
