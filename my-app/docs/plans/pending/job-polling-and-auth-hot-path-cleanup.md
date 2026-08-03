# Job Polling and Authentication Hot-Path Cleanup

Status: proposed workflow-polish plan after background-job policy is centralized.

## Problem Statement

The job-status GET operation is not a cheap read. For every non-terminal job it
schedules a long, multi-job global drain. The drain can claim unrelated work
and also performs maintenance scheduling. This couples queue throughput to
browser polling and gives a read endpoint a substantial business side effect.

The same polling request is authenticated in the Next.js proxy and again at the
route. Route authentication also upserts the local user directory on every
request. During polling, this repeats remote identity validation and database
writes even when no identity data changed.

## Solution

Make job status a side-effect-free authorized read. Retain execution wake-up at
the command response and retain the authenticated recovery route, resident
worker, and operator script for stranded work.

Separate authenticated identity resolution from user-directory
synchronization. API routes authenticate authoritatively at their own seam;
profile synchronization occurs only where a local directory row is required or
where identity claims have actually changed. Server-rendered layouts share one
request-scoped actor resolution.

## Commits

1. `test: characterize current polling cost and wake behavior`
   - Record that non-terminal polling currently schedules a drain and terminal
     polling does not.
   - Add an assertion showing that route authentication currently invokes user
     synchronization.
   - Use these as intentional red tests for the target behavior.

2. `refactor: separate actor resolution from directory synchronization`
   - Introduce one authenticated actor projection used by API and server-rendered
     code.
   - Make basic authentication perform no application-table write.
   - Keep an explicit ensure/synchronize operation for workflows that require a
     local user row.

3. `refactor: synchronize directory rows only when required`
   - Audit all current callers that rely on a local user-profile foreign key or
     current email/display name.
   - Call the explicit directory operation at those command seams.
   - Make unchanged identity synchronization a no-op at the database level.
   - Preserve first-login and invitation-acceptance behavior.

4. `refactor: cache server-rendered actor resolution per request`
   - Ensure nested layouts and pages reuse one identity lookup within a render.
   - Do not use cross-request or long-lived user caching.
   - Preserve redirects for missing and anonymous users.

5. `refactor: make API route authentication authoritative`
   - Stop performing the full remote user lookup in the proxy for private API
     routes that authenticate in their route handler.
   - Preserve public/guest route classification and safe JSON errors.
   - Retain proxy session refresh and navigation redirects for page requests.

6. `fix: make job status side-effect free`
   - Remove drain scheduling from the job-status route.
   - Remove the polling execution adapter when no caller remains.
   - Preserve authorization, rate limiting, response validation, and terminal
     refresh behavior.

7. `refactor: bound command-triggered portable wake-up`
   - Keep one wake-up after a successful asynchronous command response.
   - Ensure concurrent wake-ups rely on leases and provider concurrency limits.
   - Keep the portable deadline and maximum jobs configurable by adapter rather
     than implied by a polling read.

8. `test: prove stranded-job recovery without polling`
   - Simulate after-response scheduling failure.
   - Prove that the recovery route can later claim and finish the durable row.
   - Prove the resident worker and local script remain equivalent adapters.

9. `test: prove polling is read-only`
   - Assert no drain scheduling, maintenance scheduling, job mutation, or user
     directory mutation occurs during status reads.
   - Preserve per-user polling rate-limit behavior and page-visibility backoff.

10. `ops: require one recovery mechanism per deployment mode`
    - Make deployment qualification verify either a resident worker or an
      authenticated scheduled recovery invocation.
    - Keep after-response execution as latency optimization, not the only
      recovery guarantee.

11. `docs: correct authentication and polling flows`
    - Show browser cookies terminating at the application origin.
    - Show API routes as the authoritative API authentication seam.
    - Describe polling as observation and the recovery route/worker as
      execution mechanisms.

## Decision Document

- GET job status has no business execution side effect.
- The route remains independently authenticated; proxy navigation protection
  is not treated as API authorization.
- User-directory synchronization is explicit and conditional.
- Request-scoped caching never crosses requests or users.
- Every deployment has a durable recovery mechanism independent of browser
  activity.
- Polling transport, interval behavior, and public DTO remain unchanged.

## Testing Decisions

Route tests assert observable calls to the job reader and absence of execution
scheduling. Authentication tests distinguish actor resolution from directory
synchronization. Recovery tests exercise the real drain interface with bounded
handler adapters.

Use API authentication, Supabase proxy, job route-contract, API job wake-up,
after-response execution, recovery-route, and client polling tests as prior
art.

## Acceptance Criteria

- Polling a job performs authorization and state projection only.
- Polling does not schedule execution, maintenance, or a user-directory write.
- Every asynchronous command still attempts one bounded post-response wake-up.
- A stranded job completes through the configured worker or recovery route
  without browser activity.
- Direct API requests remain independently authenticated.
- First-login and identity-change directory behavior remains correct.

## Rejected Alternatives

- Keeping a smaller poll-triggered drain: GET would still mutate global work
  and deployment health would still depend on browser activity.
- Trusting proxy authentication inside API routes: direct route invocation must
  remain secure.
- Cross-request actor caching: authorization and session revocation must not be
  hidden by application caching.

## Out of Scope

- Replacing polling with realtime subscriptions, server-sent events, or
  WebSockets.
- Removing route-level authentication.
- Caching authorization or membership across requests.
- Changing job DTOs, progress phases, or client-visible timing.
- Adding a new scheduler product.
