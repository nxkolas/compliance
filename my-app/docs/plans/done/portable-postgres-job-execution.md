# Portable PostgreSQL Job Execution

Status: implemented and locally qualified on 2026-07-30. External Vercel,
managed-service, and forced-interruption rollout gates remain environment-owned;
see `docs/qa/portable-postgres-job-execution-2026-07-30.md`.

## Problem Statement

The application has reliable PostgreSQL-backed background jobs, but executing
them currently requires a separately started, continuously polling Node
process. That process is appropriate for the hardened Docker deployment but is
an unnecessarily difficult default for ordinary local development, where the
web process and worker must be started separately and the worker does not load
the host's local environment file unless explicitly instructed to do so.

The same process model is not available on Vercel. Next.js functions can keep
bounded work alive after returning a response, but they cannot host an
indefinite polling loop. Treating Vercel as a separate implementation would
duplicate job behavior or weaken the existing guarantees around durable
enqueueing, leases, heartbeats, cancellation, retries, idempotent handlers,
typed results, scheduled work, and safe errors.

Production environment validation also assumes the existing private,
self-hosted topology. A managed-cloud deployment using Vercel with an external
PostgreSQL, Supabase, or AI endpoint is rejected even when the endpoint is
authenticated and TLS-protected. Bypassing those checks by pretending a Vercel
deployment is local would disable legitimate production safeguards.

The repository needs one job-execution implementation that works in all
environments, with only the mechanism that wakes that implementation varying
between request-driven, scheduled, and continuously polling hosts.

## Solution

Keep PostgreSQL as the only durable job queue and deepen the existing worker
runtime into one job-execution module. Its small interface will drain available
jobs within an explicit invocation budget while hiding leasing, heartbeats,
cancellation, handler dispatch, retry classification, typed finalization,
scheduled-job maintenance, and operational logging.

The execution module will be used by thin adapters:

- the Next.js after-response adapter schedules a bounded drain after a
  successful asynchronous HTTP command;
- the recovery adapter exposes one authenticated route that invokes the same
  bounded drain for cron and operator-triggered recovery;
- the polling adapter may request another bounded drain while an authorized
  client is actively observing non-terminal work;
- the standalone adapter repeatedly invokes the same execution module on hosts
  that benefit from a continuously available worker; and
- trusted scripts and evaluations invoke the same execution module directly.

Ordinary local development will no longer require a separately started worker.
The standalone adapter remains available for throughput testing, hardened
Docker deployments during migration, and installations that prefer a resident
process. It contains no distinct job behavior.

The execution module must remain safe under concurrent invocations. Existing
row locking, skip-locked leasing, lease ownership, and idempotent handlers
remain authoritative. Multiple Vercel invocations, a Vercel invocation and a
standalone worker, or multiple local requests may therefore execute at the same
time without running the same live lease concurrently.

### Target execution flow

```text
HTTP command
  -> commit domain state and PostgreSQL job
  -> return 202
  -> Next.js after-response adapter
  -> bounded job drain

Recovery or scheduled trigger
  -> authenticated drain route
  -> the same bounded job drain

Optional resident process
  -> repeat the same bounded job drain
```

The PostgreSQL row is the durable handoff. After-response scheduling is only a
low-latency wake-up and is never treated as proof that execution started. If an
invocation is missed, crashes, or reaches its duration limit, the job remains
queued or becomes reclaimable after its lease expires.

## Decision Document

### One deep execution module

The execution module will present one interface for draining work. Callers
provide an invocation identity, maximum number of jobs, deadline, and optional
abort signal. The result reports observable execution totals and the reason the
drain stopped. Callers do not select handlers, manage leases, start heartbeat
timers, classify failures, or know retry timing.

The current single-job function becomes an internal operation of this module.
A temporary compatibility export may remain while scripts and tests migrate,
but new callers use the drain interface.

The registered handler map belongs inside the execution module. Handler kinds
remain explicit and exhaustively typed. Starting a process with an unknown or
empty handler registry remains an error.

### Bounded invocation semantics

Every drain has a soft deadline earlier than the hosting platform's hard
timeout. The module stops leasing new work when insufficient budget remains.
An active handler receives a combined signal representing user cancellation,
caller cancellation, and execution deadline.

A cooperative deadline interruption is recorded as a safe, retryable execution
failure. Abrupt platform termination is recovered through the existing lease
expiry mechanism. Repeated deadline exhaustion must not loop forever; jobs
continue to respect their attempt limit.

Handlers expected to exceed the portable invocation budget must be split into
durable stages or checkpointed batches. Increasing a platform timeout is not a
substitute for resumability. Document extraction, embedding, grounded
generation, report rendering, and corpus evaluation receive explicit duration
qualification.

The portable baseline is a five-minute host limit with a safety margin. Longer
Vercel durations may be enabled later without changing the execution
interface.

### After-response wake-up

The common route adapter schedules a bounded drain after a successful
`202 Accepted` result. In this repository, `202` is reserved for commands that
have durably created or reused asynchronous work, so the status is the wake-up
signal. Failed commands and non-202 responses do not schedule execution.

The wake-up runs only after the command has returned successfully, so it cannot
race an uncommitted enqueue transaction. Replayed idempotent commands also wake
the runner, which helps recover an earlier missed invocation.

The adapter uses Next.js `after()` and dynamically loads the execution module
inside the callback. The response does not await job completion, and callback
errors are logged without changing the already committed HTTP response.

The Vercel build must be inspected to ensure dynamically reachable handlers and
native parser dependencies are included without duplicating an excessive
bundle into every route. Bundle qualification is a release gate, not an
assumption.

### Recovery and scheduled execution

Add one Node-runtime route that invokes the same bounded drain. It supports the
authorization header supplied by Vercel Cron and an equivalent operator call
outside Vercel. Authentication fails closed when the secret is absent, uses a
constant-time comparison, and returns no job payloads or sensitive diagnostics.

The route is dynamic, non-cacheable, and has an explicit maximum duration. It
returns only drain totals, stop reason, and correlation metadata suitable for
operations.

Vercel production schedules this route at the most frequent interval supported
by the selected plan. Pro and Enterprise can provide per-minute recovery.
Hobby's daily cron is documented as delayed recovery rather than represented as
equivalent service quality. An external scheduler may call the same route when
faster Hobby recovery is required.

At the beginning of a drain, the execution module idempotently ensures the
cleanup schedule and legal-source monitor schedule exist. Chained jobs created
by handlers are eligible for the same drain if budget remains.

The authorized job-status read may schedule another drain for non-terminal
work. This makes active client polling a recovery signal without changing the
read contract or claiming that a GET request itself performed domain work.

### Standalone adapter

The resident worker loop becomes a thin adapter around the drain interface. It
provides an effectively unbounded sequence of bounded drains, waits when no
work is available, and stops scheduling new drains after a termination signal.

The standalone adapter remains useful for self-hosted throughput and as a safe
deployment fallback. It is no longer required for normal host development and
contains no handler or lifecycle logic that differs from request-driven
execution.

### Local development

The default development command starts Next.js only. Asynchronous commands run
through the after-response adapter using the normal local environment loaded by
Next.js. Developers may still run the standalone adapter explicitly for worker
diagnostics, sustained queues, or acceptance testing.

Explicit local standalone commands load the local environment file by name.
The environment-neutral worker command remains available for containers and
operators that inject variables directly.

The heavyweight Docker memory and disk gates remain acceptance constraints,
not prerequisites for host-run web and request-driven job execution. A
lightweight dependency mode is documented separately from the full local
acceptance topology.

### Environment contracts and deployment topology

Move every setting required to execute a job from worker-only validation into a
shared server job-execution environment contract. The web runtime validates
these settings because it may execute handlers after a response. The
standalone adapter extends the shared contract only with resident-process
identity and diagnostics.

Introduce an explicit deployment-topology setting with at least two values:

- private self-hosted topology preserves the current private database and AI
  hostname requirements; and
- managed-cloud topology permits externally reachable managed endpoints only
  when the relevant transport is encrypted and production credentials are
  present.

Application environment continues to represent lifecycle (`local`, `test`,
`staging`, or `production`); it no longer doubles as a topology selector.
Vercel production must use the production lifecycle and managed-cloud topology,
not relax checks by selecting a non-production lifecycle.

Generated Docker environments explicitly select the private self-hosted
topology. Vercel deployment documentation enumerates required managed-cloud
variables without committing populated secrets.
### Observability and privacy

Each drain logs its invocation ID, adapter kind, jobs claimed, terminal
outcomes, retry outcomes, stop reason, and duration. Each job retains the
existing safe start and finish logging. Logs never include job payloads,
prompts, document text, provider bodies, credentials, or signed URLs.

Metrics distinguish queue delay from execution duration and distinguish
deadline interruption, lease loss, handler failure, cancellation, and an empty
queue. Readiness does not require a resident worker when after-response and
recovery adapters are enabled.

### Database and public HTTP contracts

No schema change is required for the initial implementation. Existing job
states, attempts, run-after timestamps, leases, heartbeats, cancellation, and
typed results remain authoritative.

Existing asynchronous command and job-status response bodies do not change.
The new recovery route is an internal operational contract and is never exposed
through the browser client modules.

## Commits

Each commit below must leave linting, type checking, and the relevant tests
green. Request-driven execution is added while the standalone adapter still
runs safely, then the local default is simplified only after cross-adapter
behavior is verified.

### Commit 1: Characterize current single-job execution

- Add behavior tests around handler selection, an empty queue, successful
  finalization, retryable failure, terminal failure, cancellation, heartbeat
  cleanup, and scheduled follow-up creation.
- Record existing lease duration, heartbeat interval, retry delay, and safe
  error behavior as observable expectations.
- Do not restructure production code yet.

### Commit 2: Define the portable drain interface

- Add the drain input and result contracts.
- Define stop reasons for empty queue, maximum jobs, deadline, caller abort, and
  graceful shutdown.
- Validate nonsensical limits and already-expired deadlines before touching the
  database.
- Add contract tests for validation and result accounting.

### Commit 3: Move handler dispatch behind the execution module

- Relocate the handler registry and the current single-job lifecycle into the
  shared server execution module without changing behavior.
- Keep a compatibility export for existing evaluations, smoke commands, and
  the standalone entrypoint.
- Remove unsafe handler casts by giving every registered handler one compatible
  interface.
- Confirm every registered job kind has exactly one handler.

### Commit 4: Implement bounded draining

- Repeatedly execute single-job cycles until the queue is empty, maximum jobs
  is reached, the deadline margin is reached, or the caller aborts.
- Return deterministic totals and stop reason.
- Ensure a drain never leases another job after its stopping condition is met.
- Test empty, one-job, multi-job, chained-job, maximum-job, and concurrent-drain
  behavior.

### Commit 5: Propagate execution deadlines

- Combine deadline, caller, and job-cancellation signals for handlers.
- Give deadline interruption its own safe diagnostic classification.
- Requeue cooperative deadline interruptions according to the existing attempt
  policy.
- Ensure heartbeat and cancellation-monitor timers always stop.
- Test interruption before lease, during handler work, and immediately after a
  handler result commits.

### Commit 6: Make the handler registry deadline-aware

- Update handler interfaces to accept the combined signal without casts.
- Audit provider calls, storage downloads, Docling calls, report rendering, and
  corpus operations for signal propagation.
- Add safe checkpoints between durable stages and embedding/evaluation batches.
- Preserve existing domain idempotency so a reclaimed job resumes rather than
  duplicates results.

### Commit 7: Centralize scheduled-job maintenance in drains

- Ensure cleanup and legal-source monitoring schedules at drain start.
- Preserve their database uniqueness guarantees so concurrent drains cannot
  create duplicate active schedules.
- Continue scheduling the next occurrence after terminal execution.
- Remove equivalent startup behavior from the standalone entrypoint only after
  parity tests pass.

### Commit 8: Convert the resident worker into a thin adapter

- Make the resident loop call the shared drain interface.
- Preserve idle polling, generated local identities, production identity
  requirements, graceful drain on termination, and close-on-exit database
  behavior.
- Migrate smoke commands and evaluations from the compatibility single-job
  export where doing so improves determinism.
- Keep the compatibility export until every deliberate single-job caller is
  accounted for.

### Commit 9: Add the Next.js after-response adapter

- Schedule one bounded drain after successful asynchronous responses.
- Dynamically load execution code inside the after-response callback.
- Generate a correlation-safe invocation identity per callback.
- Log callback failures without modifying the committed response.
- Test that 202 responses schedule once, replayed 202 responses schedule once,
  other statuses do not schedule, and the route response is not blocked by job
  completion.

### Commit 10: Add polling-assisted recovery

- Schedule a bounded drain after authorized reads of non-terminal jobs.
- Do not change the public job DTO or expose internal lease state.
- Coalesce redundant scheduling within one invocation where appropriate.
- Test that terminal jobs do not wake execution and unauthorized reads never
  wake execution.

### Commit 11: Add the authenticated recovery route

- Add the non-cacheable Node-runtime drain route with explicit duration.
- Require the configured bearer secret and fail closed when configuration is
  missing.
- Return only safe execution totals and correlation metadata.
- Test missing, malformed, and incorrect authorization; successful empty and
  non-empty drains; concurrent invocations; and error redaction.

### Commit 12: Share job-execution environment validation

- Extract the environment required by handlers into a shared server execution
  contract.
- Compose it into web and standalone validation.
- Keep resident-only identity and debug restrictions with the standalone
  adapter.
- Require the recovery secret in production when the recovery adapter is
  enabled.
- Extend environment tests without printing secret values.

### Commit 13: Add explicit deployment topology

- Separate lifecycle validation from private-self-hosted versus managed-cloud
  network validation.
- Preserve existing private-host and database-pool restrictions for the
  self-hosted topology.
- Require encrypted managed database and provider connections for the
  managed-cloud topology.
- Reject localhost, plaintext, incomplete credentials, and ambiguous topology
  in production.
- Update all example environments and deployment contract tests.

### Commit 14: Make local development request-driven by default

- Keep the default development command focused on Next.js because it now wakes
  and executes HTTP-created jobs itself.
- Add explicit local resident-worker and single-drain commands that load the
  local environment file.
- Document when a developer should use request-driven execution, the resident
  adapter, or the full acceptance stack.
- Demonstrate an asynchronous feature completing locally with no resident
  worker process.

### Commit 15: Add Vercel recovery configuration

- Configure the internal drain route as a scheduled production invocation.
- Set a statically analyzable function duration and leave a safety margin in
  the drain deadline.
- Document Hobby delayed-recovery behavior and the Pro/Enterprise per-minute
  option.
- Document required Vercel lifecycle, topology, database, Supabase, AI,
  recovery-secret, and region settings.
- Keep secrets outside Git.

### Commit 16: Qualify Vercel and standalone builds

- Build the Next.js application with every handler dynamically reachable from
  the after-response and recovery adapters.
- Inspect generated function bundles for native parsing dependencies and size
  limits.
- Exercise storage, parsing, embedding, generation, and report handlers under
  the portable invocation deadline.
- Confirm managed-cloud database connection behavior under concurrent function
  reuse and release database resources correctly.

### Commit 17: Qualify interruption and recovery

- Terminate an invocation after leasing work and verify another invocation
  reclaims it only after lease expiry.
- Exercise cooperative deadline abort, hard termination, provider timeout,
  deployment replacement, and concurrent recovery calls.
- Verify attempt counts, safe errors, domain state, typed results, and audit
  events remain consistent.
- Verify chained processing and embedding work completes across multiple
  invocations.

### Commit 18: Update Docker deployment adapters

- Point local and production resident-worker images at the shared execution
  module through the thin adapter.
- Run after-response execution and the resident adapter concurrently during
  acceptance to prove lease safety.
- Make the local resident worker optional after request-driven acceptance
  passes.
- Retain the production resident adapter until the operator deliberately
  chooses scheduled/request-driven-only execution for that topology.

### Commit 19: Complete cross-adapter acceptance

- Run the same durable-job contract suite against direct drain, after-response,
  recovery-route, and resident adapters.
- Verify an HTTP-created job completes without a manually started worker.
- Verify scheduled work completes without a user request through the recovery
  route.
- Verify cancellation, retries, idempotent replay, and authorization across all
  adapters.
- Run repository verification and record non-secret acceptance evidence.

### Commit 20: Remove obsolete worker assumptions

- Remove the compatibility single-job export if no intentional caller remains.
- Update architecture and operations documentation to describe one execution
  module and multiple wake-up adapters.
- Remove instructions that imply local developers must manually start a worker
  for normal asynchronous commands.
- Preserve explicit resident-worker operations and troubleshooting guidance.

## Testing Decisions

Good tests exercise observable behavior through the execution module's
interface. They verify claimed work, persisted job/domain state, retry and
cancellation behavior, stop reason, and safe outputs. Tests must not depend on
private helper call order, internal timer implementation, or the layout of the
handler registry.

The execution module receives the strongest coverage:

- deterministic tests for limits, deadlines, aborts, stop reasons, and result
  accounting;
- database-backed tests for leasing, skip-locked concurrency, lease recovery,
  attempts, heartbeats, cancellation, and typed finalization;
- handler contract tests proving signal propagation and idempotent resume; and
- cross-adapter tests proving each adapter reaches the same execution behavior.

Existing durable state-machine, generation lifecycle, job route, deployment
environment, worker handler, smoke workflow, and Docker acceptance tests are
the prior art. Tests are extended or replaced at the deeper execution
interface rather than duplicating assertions for every adapter.

The after-response adapter is tested with a controlled Next.js `after()` fake.
The callback must be registered before the response completes, execute after
the response contract is produced, and be unable to change that response.

The recovery route receives route-contract tests for authentication,
redaction, caching, duration-independent semantics, and safe output. End-to-end
qualification uses a real database because concurrency and expired leases
cannot be established adequately with function mocks alone.

Vercel qualification includes a production build, bundle inspection, a preview
deployment using non-production data, forced invocation interruption, and
recovery through the same authenticated route used by cron. A successful local
`after()` test is not accepted as proof of Vercel lifecycle behavior.

## Acceptance Criteria

- One execution module owns handler dispatch, leasing, heartbeat,
  cancellation, retries, deadlines, finalization, and scheduled-job upkeep.
- An asynchronous HTTP command can complete locally with only Next.js and its
  dependencies running; no manually started worker is required.
- The same command can complete on Vercel through `after()` without changing
  its public HTTP contract.
- A missed or interrupted after-response invocation is recoverable through the
  authenticated drain route.
- Concurrent adapters cannot execute the same valid lease simultaneously.
- Scheduled cleanup and legal-source monitoring do not depend on user traffic.
- Supported handlers finish or checkpoint within the portable invocation
  budget.
- Production self-hosted and managed-cloud topologies both validate without
  weakening lifecycle security.
- Existing Docker deployments can retain the resident adapter without carrying
  a second implementation of job behavior.
- Job payloads, secrets, provider responses, document content, and stack traces
  remain absent from public responses and operational logs.
- Linting, type checking, unit tests, database-backed job tests, route tests,
  production build, and cross-adapter acceptance all pass.

## Out of Scope

- Replacing PostgreSQL jobs with Vercel Queues, Redis, BullMQ, or another
  broker.
- Rewriting durable workflows using Vercel Workflow.
- Removing the resident worker adapter from every self-hosted production
  topology in the first rollout.
- Changing public job DTOs, client polling intervals, or cancellation UX.
- Increasing job concurrency inside one invocation before current sequential
  execution is qualified.
- Adding new document formats, OCR features, AI providers, or corpus behavior.
- Changing job result schemas or resetting any database.
- Treating a larger Vercel timeout as a replacement for checkpointed work.
- Committing populated Vercel, database, Supabase, AI, or cron secrets.

## Operational Rollout

1. Deploy the shared execution module with the resident adapter only and verify
   behavior parity.
2. Enable after-response wake-up while the resident adapter remains active;
   observe lease contention, queue delay, errors, and bundle size.
3. Enable the authenticated recovery schedule and prove missed-invocation and
   expired-lease recovery.
4. Make local development request-driven by default.
5. Qualify a Vercel preview against isolated managed-cloud dependencies.
6. Enable Vercel production only after duration, interruption, security,
   privacy, and bundle gates pass.
7. Decide per self-hosted environment whether to retain the resident adapter
   for throughput or rely on request-driven and scheduled adapters.

Rollback disables after-response wake-up and recovery scheduling while leaving
the resident adapter running. Because PostgreSQL remains the source of truth
and no initial schema change is required, queued and leased work remains
recoverable without data conversion.

## References

- [Next.js `after()`](https://nextjs.org/docs/app/api-reference/functions/after)
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Cron usage and plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
