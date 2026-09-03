# Portable job execution

Status: current as of 3 September 2026.

Jobs run through the bounded after-response drain and the authenticated
`/api/internal/jobs/drain` recovery route. Multiple invocations may lease jobs
concurrently. Leases, heartbeats, attempts, progress, cancellation
requests, payloads, errors, and inline result locators are durable in
`background_jobs`.

Stable job kinds are:

- `gap_analysis`
- `gap_conflict_resolution`
- `action_plan_generation`
- `report_render`
- `document_indexing`
- `organization_reembedding`
- `legal_source_processing`
- `maintenance_cleanup`

## Enqueueing is not triggering

Leasing is kind-agnostic — `leaseNextJob` selects across every kind — but a
drain only *starts* when a request asks for one. `apiRoute` schedules an
after-response drain automatically for any route returning **202**. A route that
enqueues work and returns anything else must call `scheduleAfterResponseDrain`
itself, or its job sits `queued` until some unrelated request happens to drain
it.

Two routes rely on the explicit call today, both answering 200 or 201:

- `document-upload-sessions/[sessionId]/complete` (201) — `document_indexing`
- `organizations/[organizationId]/settings` and `organizations/[organizationId]`
  (200) — `organization_reembedding`

When adding a job kind, check its entry point returns 202 or schedules a drain.
`tests/api-job-wakeup.test.ts` pins both halves of this rule.

The server-side job module exposes one enqueue command. Each command pairs a
kind with its typed payload and required organization/requester scope. Callers
that already own a database transaction pass its executor to `enqueueJob`, so
the domain update and job publication commit atomically. Attempt limits,
capabilities, and cancellability are definition-owned; callers cannot override
them.

The internal catalog contains one complete definition per persisted kind:
payload and result schemas, scope, attempts, read/cancellation policy, failure
classification, handler, and safe result projection. Payloads are validated
before insertion and after leasing. Results are validated before the success
transition. An incompatible persisted payload terminates safely without
reaching its domain handler.

Definition/build identities and resource IDs belong in the validated payload;
prompt/provider/model history belongs in `ai_processing_runs`. Terminal jobs
cannot be cancelled. Public job DTOs expose neither payload nor lease details.

Handler execution is at least once. A lease can expire after a handler starts,
so handlers that publish durable results must remain idempotent and verify the
live lease fence inside the publication transaction. The web after-response
path and recovery route call the same drain and
definition-owned execution implementation. Browser job polling is deliberately
read-only and is not a recovery mechanism.

Every production deployment must provide recovery independent of browser
activity. Set `JOB_RECOVERY_ENABLED=true`, configure
`CRON_SECRET`, and invoke `/api/internal/jobs/drain` on a schedule. The
after-response adapter improves latency but is not the durable recovery
guarantee.

Maintenance cleanup deletes expired guest checks, invitations, upload sessions,
idempotency records, and rate-limit windows. There is no legal-source monitor
scheduler, release reconciler, approval finalizer, or separate job-result table.

Operational checks:

```powershell
npm run test:jobs
```

Investigate repeated failures through the job’s safe error and server logs;
never expose private payloads, document excerpts, or credentials in user-facing
errors.
