# Portable job execution

Status: current as of 2 August 2026.

Run the dedicated Node worker with `npm run worker`; use `npm run worker:once`
or `npm run jobs:drain:local` for a bounded drain. Multiple workers may lease
jobs concurrently. Leases, heartbeats, attempts, progress, cancellation
requests, payloads, errors, and inline result locators are durable in
`background_jobs`.

Stable job kinds are:

- `gap_analysis`
- `gap_conflict_resolution`
- `action_plan_generation`
- `report_render`
- `document_indexing`
- `legal_source_processing`
- `maintenance_cleanup`

Definition/build identities and resource IDs belong in the validated payload;
prompt/provider/model history belongs in `ai_processing_runs`. Cancellation is
derived from kind and caller capability. Terminal jobs cannot be cancelled.
An incompatible unfinished job may fail and be restarted under current code.

Maintenance cleanup deletes expired guest checks, invitations, upload sessions,
idempotency records, and rate-limit windows. There is no legal-source monitor
scheduler, release reconciler, approval finalizer, or separate job-result table.

Operational checks:

```powershell
npm run test:worker
npm run worker:once
```

Investigate repeated failures through the job’s safe error and server logs;
never expose private payloads, document excerpts, or credentials in user-facing
errors.
