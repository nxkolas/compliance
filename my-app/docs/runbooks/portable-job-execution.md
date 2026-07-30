# Portable PostgreSQL Job Execution

All hosts execute durable background work through
`src/server/job-execution`. PostgreSQL remains the queue and lease authority;
the adapters only decide when to invoke a bounded drain.

## Execution adapters

- Next.js registers an `after()` callback for every successful `202 Accepted`
  API command. This is the normal local-development and Vercel low-latency
  path.
- Authorized reads of non-terminal jobs register the same bounded callback.
  Client polling is therefore an additional recovery signal.
- `GET` or `POST /api/internal/jobs/drain` runs a bounded recovery drain. It
  requires `Authorization: Bearer $CRON_SECRET`, fails closed when the secret
  is absent, is never cached, and returns totals rather than job payloads.
- `npm run worker` is the environment-neutral resident adapter for containers
  and operators. It repeatedly invokes the same bounded drain and remains safe
  to run concurrently with request-driven adapters.
- `npm run worker:local` loads `.env.local` for sustained local queues and
  diagnostics. `npm run jobs:drain:local` runs a single local drain cycle.

For ordinary host development, run `npm run dev`; no separately started worker
is required. Use the resident worker for throughput tests, worker diagnostics,
or the full Docker acceptance topology.

## Invocation budget and recovery

Request, polling, and recovery invocations use a 285-second soft deadline
inside the configured 300-second function duration. The drain stops leasing
new jobs before the deadline. Cooperative deadline interruption is persisted
as a safe retryable failure; abrupt termination is recovered only after the
existing PostgreSQL lease expires.

Cleanup and legal-source monitor schedules are ensured idempotently at the
start of every drain. Chained jobs may be claimed by the same invocation while
its job and time budgets remain.

The committed `vercel.json` schedule invokes the recovery route daily, which
is compatible with Hobby cron limits but provides delayed recovery. For a Pro
or Enterprise deployment, change the schedule to `* * * * *` after confirming
the plan supports per-minute cron. An external scheduler can call the same
authenticated route when faster recovery is needed without changing the job
runtime.

## Vercel production contract

Configure these values in Vercel rather than committing populated secrets:

- `NODE_ENV=production`, `APP_ENV=production`, and
  `DEPLOYMENT_TOPOLOGY=managed_cloud`;
- `APP_PUBLIC_URL`, `API_CURSOR_SECRET`, `CRON_SECRET`, and
  `JOB_RECOVERY_ENABLED=true`;
- `DATABASE_URL` with credentials and `sslmode=require`, `verify-ca`, or
  `verify-full`, plus conservative database pool settings;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `SUPABASE_SECRET_KEY` (and `SUPABASE_INTERNAL_URL` when used), all pointing
  to the intended managed project;
- the selected AI provider's credentials, model names, embedding model, and
  timeout/output limits; and
- `DOCLING_SERVICE_URL` when document fallback parsing is enabled.

Place the Vercel functions in the same or nearest practical region to the
managed PostgreSQL and Supabase services. A preview deployment must use
isolated non-production data and secrets.

`private_self_hosted` keeps the existing private database and self-hosted AI
hostname restrictions. Generated Docker example environments select that
topology explicitly. `managed_cloud` permits public endpoints only with the
required authenticated TLS contracts; it does not relax the production
lifecycle.

## Operations and privacy

Drain logs contain the invocation identity, adapter, outcome totals, stop
reason, and duration. Job logs contain identifiers, kind, attempt, outcome,
and duration. Neither public recovery responses nor normal logs include job
payloads, prompts, document text, provider bodies, credentials, signed URLs,
or stack traces.

If request-driven execution must be disabled during rollback, remove the
after-response wake-up and Vercel schedule while keeping the resident adapter
running. No queue migration is required because PostgreSQL remains
authoritative.
