# Portable PostgreSQL Job Execution Qualification

Date: 2026-07-30

## Local evidence

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 139 files and 736 tests passed; two opt-in database files (six
  tests) were skipped by the environment-free run and executed separately
  against the configured local PostgreSQL.
- Opt-in database suites passed against the configured local PostgreSQL: four
  generation-lifecycle cases plus two portable lease cases. The lease cases
  prove concurrent claim exclusion and expired-lease recovery using randomized
  fixtures that are removed after each test.
- `npm run build`: passed with Next.js 16.2.12. The build includes the dynamic
  `/api/internal/jobs/drain` route and all registered job handlers.
- Recovery-route function trace: 337 files, 10.80 MiB of traced dependencies,
  with `pdf-parse` present. A representative asynchronous application route
  traces 341 files and 10.87 MiB; the health route remains 1.58 MiB.
- `git diff --check`: passed.

The deterministic drain suite covers invalid budgets, expired deadlines,
empty queues, multiple/chained cycles, maximum-job stopping, deadline-margin
stopping, graceful caller abort, and exact result accounting. Adapter suites
cover 202-only wake-up, non-blocking after-response registration, scheduler
failure isolation, polling wake-up only after authorized non-terminal reads,
fail-closed constant-time recovery authorization, safe response totals,
non-cacheability, and error redaction.

## External rollout gates

The following require deployment credentials or isolated infrastructure and
are intentionally not represented as completed by local tests:

- a Vercel preview connected to isolated managed PostgreSQL, Supabase, AI, and
  optional Docling services;
- cooperative and hard interruption after a real lease, followed by expiry and
  reclaim from another invocation;
- full concurrent request, recovery, and resident adapters against the
  isolated deployment (the shared PostgreSQL lease primitive itself is covered
  by the local database test);
- live storage, parsing, embedding, grounded generation, report rendering, and
  corpus-evaluation duration qualification; and
- production-region connection reuse and database resource observations.

These are rollout gates in the portable execution runbook. They do not require
another job implementation or a database migration.
