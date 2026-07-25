# API, corpus, and grounded-AI rollout

The API/corpus feature set is normally forward-only. Use the current
[Drizzle schema-change workflow](drizzle-workflow.md) for application schema
changes. Use the current
[development reset and bootstrap runbook](development-database-reset-and-bootstrap.md)
when a disposable database must be cleared or created from scratch.

## Required server configuration

- Database and Supabase: `DATABASE_URL` (or operator-only
  `DRIZZLE_DATABASE_URL`), `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
- API/worker: a dedicated 32+ character `API_CURSOR_SECRET` is preferred;
  `WORKER_ID` is optional but recommended for stable worker diagnostics.
- Grounded AI: `AI_DEFAULT_PROVIDER` plus the selected provider's model,
  embedding model, API key, and—for compatible providers—base URL. Supported
  prefixes are `OPENAI_*`, `COMPANY_AI_*`, and `SELF_HOSTED_AI_*`.
- Safety adapters: `AI_PROVIDER_TIMEOUT_MS` defaults to 120 seconds and is
  clamped to 5–300 seconds. `DOCLING_SERVICE_URL` enables isolated fallback
  parsing. Production must provide the malware-scanning adapter rather than the
  development no-op.

Never expose server-only values through `NEXT_PUBLIC_*`, logs, job payloads, or
API error details.

## Pre-deployment

1. Take and verify a target-database backup. Record the environment and
   operator approving the rollout.
2. On a new database, install the `vector` extension with
   `004_gap_evidence_infrastructure.sql`, then follow the complete
   [Drizzle preview/apply workflow](drizzle-workflow.md). Never use `--force`.
3. Apply `scripts/sql/api-corpus-integrity-additions.sql`, then
   `scripts/sql/audit-events-append-only.sql`, followed by
   `scripts/sql/database-integrity-triggers.sql`, as a privileged database
   operator. These files own audited functions and triggers, not ordinary
   constraints or indexes.
4. Configure `API_CURSOR_SECRET` with at least 32 random characters, or ensure
   the server-only `SUPABASE_SECRET_KEY` is available as its fallback.
5. Run `npm.cmd run storage:setup:legal-corpus` and
   `npm.cmd run storage:setup:reports`; both buckets must remain private.
6. Run `npm.cmd run db:verify:server-only` and require every public table, all
   expected rollout tables, and both append-only audit triggers to pass.
   Run `npm.cmd run db:verify:integrity` to prove typed values,
   composite ownership, metadata-only Gap results, and deferred normalized
   finding coverage.
   Run `npm.cmd run storage:verify` and require all three private buckets.
7. Optionally seed the deliberately incomplete NIS2 fixture with
   `npm.cmd run db:seed:legal-corpus-fixture`. It must still be reviewed,
   published, evaluated, and activated by a Platform Administrator.

RLS and both HNSW indexes remain owned by Drizzle and must not appear as drift
on a later push. Audited triggers remain operator-owned. Use the dedicated
RLS/trigger and storage verifiers for final-state proof.

## Deploy

1. Deploy the web and worker artifacts from the same revision.
2. Start at least one worker with `npm.cmd run worker` and verify leases and
   heartbeat timestamps through `/api/admin/jobs`.
3. Bootstrap the first Platform Administrator through the operator-only script
   when the registry is empty.
4. Ingest and review the exact official corpus renditions, publish a release,
   pass the grounding evaluation gate, and activate it.
5. Publish and activate compliance and Gap releases with that corpus release
   pinned. Activation now fails closed when pins are absent.

For the bootstrap fixture, inspect the imported generations with
`npm.cmd run db:inspect:legal-corpus-fixture`, then use the generation-pinned,
confirmation-guarded command below for the reviewed EU and DE generations:

```powershell
npm.cmd run db:approve:legal-corpus-fixture -- `
  --actor <platform-admin-uuid> `
  --eu-generation <approved-eu-generation-uuid> `
  --de-generation <approved-de-generation-uuid> `
  --release-label reviewed-bootstrap-YYYY-MM-DD `
  --confirm-reviewed-sources
```

It records review through the capability-checked service and queues
evaluations. After both evaluations pass, rerun it with `--activate-passed`.
Do not update governance state with SQL.

## Smoke gate

Run `npm.cmd run verify`, `npm.cmd run test:worker`, and
`npm.cmd run test:ai` against the release revision. Once a reviewed,
evaluation-passed release is active, set `CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID`
and `CORPUS_SMOKE_RELEASE_ID`, then run
`npm.cmd run db:smoke:api-corpus`. Run `npm.cmd run db:verify:rollout` to prove
that both evaluated corpus releases are active, compliance and Gap pin those
exact releases, their compatible release link is active, governance audit
events exist, and the rollout has no unfinished jobs.

- Run the automated authenticated remediation smoke with
  `REMEDIATION_SMOKE_USER_ID=<active-admin-uuid> npm.cmd run
  db:smoke:authenticated-gap`. It creates/resumes a synthetic fixture and
  proves applicability persistence, actual queued grounded generation,
  normalized findings, correction, finalization, action-plan creation, and
  repeated read-only loading.
- Direct-upload evidence, inspect processing, archive/restore it, and request a
  controlled original.
- Prepare, enqueue, poll/cancel/retry as needed, then correct and finalize the
  single generated Gap Analysis. Finalization creates the fixed action plan;
  there is no plan reconciliation workflow.
- Create, cancel, regenerate, and download a pinned PDF report.
- Inspect organization audit history and, separately as a Platform
  Administrator, corpus jobs and platform audit history.

Run the Compliance, Gap, Corpus/Document, and structural index benchmarks.
Their assertion modes are deployment gates, not diagnostic-only reports.

```powershell
npm.cmd run db:benchmark:compliance -- --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npm.cmd run db:benchmark:gap -- --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npm.cmd run db:benchmark:corpus-document -- --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npm.cmd run db:benchmark:indexes
```

## Durable maintenance and source monitoring

Worker startup creates the single future `cleanup` job when one is not already
queued or running. A successful cleanup schedules the next daily run. The
rollout verifier requires this future job, so a missing scheduler is a failed
deployment rather than a silent operational task.

Legal-source monitors use fixed ISO-8601 cadences: `PT1H` through `PT8760H` or
`P1D` through `P365D`. The API also accepts `hourly`, `daily`, and `weekly` and
stores them as `PT1H`, `P1D`, and `P7D`. Creating or resuming a monitor queues
one durable job at `nextCheckAt`; pausing it cancels a queued check or requests
cancellation of a running one. Worker startup repairs a missing monitor job,
and each terminal check schedules the next cadence. A partial unique database
index prevents concurrent workers from creating duplicate active checks.

Successful checks retain only bounded response metadata, content hashes, and
HTTP validators. Later checks send `If-None-Match` and/or
`If-Modified-Since`; redirects are revalidated by the controlled URL fetcher.
A changed hash creates an alert and never mutates a published corpus version.
Final failures record a safe error and advance the next check rather than
creating a tight retry loop.

## Rollback

Deploy the preceding web and worker revision together. Restore the preceding
active corpus/compliance/Gap pointers through their audited activation
workflows. Leave additive schema, stored outputs, jobs, and immutable history in
place; they remain valid provenance and can be resumed after a forward fix.
