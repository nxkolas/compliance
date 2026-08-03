# Background-Job Module Deepening

Status: implemented on 3 August 2026.

## Problem Statement

The durable queue is reliable at the database level, but its module interface
does not own all knowledge needed to use a job kind correctly.

Callers currently need to know payload shape, organization/requester
requirements, maximum attempts, direct insert details, cancellation policy,
read capability, failure classification, handler selection, and result
projection. This knowledge is spread across enqueueing domains, job services,
execution runtime, worker adapters, and stale policy constants.

Consequences already visible include ignored enqueue options, raw job inserts,
partial payload validation, a dead Action Plan capability name, and different
AI failure treatment for closely related job kinds.

## Solution

Create one deep background-job module with a small command interface:

- enqueue a typed job, optionally inside an existing transaction;
- lease and execute a persisted job through its definition;
- authorize reading or cancellation through definition-owned policy;
- project its safe result through definition-owned logic.

A complete internal job catalog defines every persisted kind's payload schema,
scope rules, attempt policy, cancellation/read capabilities, failure
classifier, execution handler, and result schema. Web, resident worker,
recovery route, and scripts continue to call the same drain interface.

## Commits

1. `test: inventory current job-kind behavior`
   - Add a table-driven characterization test for every persisted job kind.
   - Capture payload validity, required scope, read capability, cancellation
     capability, cancellability, retry classification, and result type.
   - Assert catalog completeness against the persisted kind union.

2. `refactor: define typed job commands`
   - Introduce a discriminated union pairing each kind with its payload.
   - Preserve the persisted JSON representation.
   - Make invalid kind/payload combinations fail type checking for internal
     callers.

3. `refactor: centralize payload schemas`
   - Move or expose one runtime schema for every job payload.
   - Validate at enqueue and again at execution because persisted rows may
     outlive a deployment.
   - Return safe terminal errors for incompatible persisted payloads.

4. `refactor: create the job definition catalog`
   - Associate each kind with scope requirements, attempt defaults, read and
     cancellation capabilities, handler, failure classifier, and result
     projection.
   - Make omission of a persisted kind a compile-time or catalog test failure.
   - Keep adapter and hosting policy out of individual definitions.

5. `refactor: add transaction-aware enqueue`
   - Accept either the default database executor or a caller's active
     transaction.
   - Validate the command before insertion.
   - Derive attempts and scope policy from the definition instead of caller
     options.
   - Remove ignored cancellability and capability parameters from the old
     interface.

6. `refactor: migrate atomic publishing callers`
   - Migrate Gap generation, reports, Action Plan generation, and document
     upload completion first because their job row belongs to a domain
     transaction.
   - Keep domain state and job creation atomic.
   - Preserve identifiers and payloads.

7. `refactor: migrate standalone callers`
   - Migrate contradiction resolution, indexing retry, legal-source processing,
     maintenance cleanup, and operator enqueue paths.
   - Remove every remaining direct background-job insert outside the module.

8. `refactor: dispatch execution through definitions`
   - Replace the central conditional handler chain with catalog lookup and
     validated execution.
   - Preserve the shared heartbeat, cancellation signal, lease fence, and
     success/failure transitions around the handler.

9. `fix: unify generation failure policy`
   - Apply AI failure classification to every AI-backed kind, including
     contradiction resolution.
   - Keep terminal input/policy failures non-retryable.
   - Keep transient provider failures bounded and delayed consistently.
   - Preserve cancellation as cancellation rather than failure.

10. `refactor: derive authorization and cancellability from definitions`
    - Replace read-capability, cancellation-capability, and cancellable-kind
      switches.
    - Remove the stale Action Plan generation policy and nonexistent capability
      name.
    - Preserve current effective owner/contributor/viewer behavior.

11. `refactor: derive safe result projection from definitions`
    - Validate result locators before job success.
    - Project result links and result DTOs without generic unchecked objects.
    - Preserve current public DTO shape.

12. `test: qualify all execution adapters`
    - Run every kind through the common definition using an in-memory handler
      adapter where I/O is external.
    - Prove the web after-response path, resident worker, recovery route, and
      script use the same execution implementation.
    - Prove an unknown or incompatible persisted payload cannot reach a domain
      handler.

13. `cleanup: delete superseded job policy code`
    - Remove old switches, raw payload casts, dead policy constants, deprecated
      re-exports, and tests of implementation details.
    - Retain tests at the new job interface and observable route/worker seams.

14. `docs: document the job module interface`
    - Document at-least-once handler execution, typed payloads, attempts,
      cancellation, and lease-fenced publication.
    - Keep hosting adapters distinct from job business definitions.

## Decision Document

- A job definition is internal implementation knowledge, not a public plugin
  interface.
- There is one catalog and one execution implementation for all hosting
  adapters.
- Payload validation occurs both before persistence and after lease.
- Domain transactions may enqueue through the same interface using their
  transaction executor.
- Job definitions own policy; callers provide business payload and scope only.
- Public job DTOs remain stable and never expose payloads or leases.
- No new database queue, broker, or job kind is introduced.

## Testing Decisions

Tests exercise enqueue, authorization, cancellation, execution, retry, and
projection through the job module interface. Handler-specific domain behavior
stays in domain tests.

Use job state-machine, job route-contract, database lease, execution drain,
generation lifecycle, report publication, Action Plan publication, and upload
completion tests as prior art. Replace tests that assert private switches once
catalog-level behavior tests exist.

## Acceptance Criteria

- Every persisted job kind has one complete definition.
- Invalid payloads fail before insertion and again before handler execution.
- No domain or operator module inserts a background-job row directly.
- Read, cancellation, retry, and result policy have no separate kind switches.
- All hosting adapters execute the same handler implementation.
- Public job DTOs and existing business outcomes remain compatible.

## Rejected Alternatives

- Keeping independent switches with a shared list of constants: callers would
  still need to coordinate several shallow interfaces.
- A public plugin system: job kinds are closed, internal application behavior.
- One generic handler accepting unchecked JSON: this preserves the current
  payload and policy drift.

## Out of Scope

- Replacing PostgreSQL as the queue.
- Changing lease duration, heartbeat frequency, concurrency limits, or retry
  counts unless a current inconsistency must be corrected.
- Exposing job definitions to browser code.
- Adding job priorities, dependencies, batches, or scheduling features.
- Refactoring domain handlers beyond what the new interface requires.
