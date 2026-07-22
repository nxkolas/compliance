# API, corpus, and grounded-AI rollout

This rollout is additive. Do not delete jobs, immutable revisions, reports,
audit events, finalized uploads, corpus releases, or provenance records during
rollback.

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
2. Apply `scripts/sql/api-corpus-integrity-additions.sql` once before the schema
   push. This marks pre-existing AI-run provenance `historical_unknown` before
   the new non-null default is introduced.
3. Preview with `npx.cmd drizzle-kit push --strict --verbose`, review every
   statement, and approve only the additive diff. Never use `--force`.
4. Apply `scripts/sql/api-corpus-integrity-additions.sql` again, then
   `scripts/sql/phase1-server-only.sql`,
   `scripts/sql/legal-corpus-server-only.sql`, and
   `scripts/sql/audit-events-append-only.sql` as a privileged database
   operator. The second integrity pass adds constraints to newly-created
   tables and replaces the pre-corpus `gap_finding_evidence_source_check`;
   Drizzle adds the legal citation column and enum value but does not replace
   that existing named check constraint.
5. Configure `API_CURSOR_SECRET` with at least 32 random characters, or ensure
   the server-only `SUPABASE_SECRET_KEY` is available as its fallback.
6. Run `npm.cmd run storage:setup:legal-corpus` and
   `npm.cmd run storage:setup:reports`; both buckets must remain private.
7. Run `npm.cmd run db:verify:server-only` and require every public table, all
   expected rollout tables, and both append-only audit triggers to pass.
   Run `npm.cmd run storage:verify` and require all three private buckets.
8. Optionally seed the deliberately incomplete NIS2 fixture with
   `npm.cmd run db:seed:legal-corpus-fixture`. It must still be reviewed,
   published, evaluated, and activated by a Platform Administrator.

After the post-push SQL is installed, do not approve another Drizzle push as a
"zero drift" check. Supabase-only RLS, audit triggers, and HNSW indexes are
outside the Drizzle model, so that preview can propose removing them. Use the
dedicated grant/trigger and storage verifiers for final-state proof.

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

For the bootstrap fixture, use the generation-pinned, confirmation-guarded
`db:approve:legal-corpus-fixture` command documented in
[`database-reset-and-reseed.md`](database-reset-and-reseed.md#3-run-the-worker-and-complete-corpus-governance).
It records review through the capability-checked service, queues evaluations,
and only activates passed releases; do not update governance state with SQL.

## Smoke gate

Run `npm.cmd run verify`, `npm.cmd run test:worker`, and
`npm.cmd run test:ai` against the release revision. Once a reviewed,
evaluation-passed release is active, set `CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID`
and `CORPUS_SMOKE_RELEASE_ID`, then run
`npm.cmd run db:smoke:api-corpus`. Run `npm.cmd run db:verify:rollout` to prove
that both evaluated corpus releases are active, compliance and Gap pin those
exact releases, their compatible release link is active, governance audit
events exist, and the rollout has no unfinished jobs.

- Complete an authenticated applicability check.
- Direct-upload evidence, inspect processing, archive/restore it, and request a
  controlled original.
- Prepare, enqueue, poll, cancel, retry, review, and approve a Gap reassessment.
- Create and reconcile an action plan using an active member as assignee.
- Create, cancel, regenerate, and download a pinned PDF report.
- Inspect organization audit history and, separately as a Platform
  Administrator, corpus jobs and platform audit history.

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
