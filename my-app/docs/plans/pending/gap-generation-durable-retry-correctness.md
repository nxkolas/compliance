# Gap Generation Durable-Retry Correctness

Status: proposed correctness plan based on the current Gap v12 workflow.

This plan supersedes only the generic retry assumptions in the older Gap v9
reliability plan. It does not reopen the v9 product or prompt design.

## Problem Statement

Gap category generation has bounded provider retries inside one job execution
and durable retries across job leases. AI processing runs use deterministic
idempotency keys and preserve failed attempts.

After the inner provider retries are exhausted, the durable job is queued for
another attempt. That attempt currently recreates the same category and
provider-attempt identities. It therefore encounters the earlier failed AI run
and stops with an existing-run conflict instead of making a permitted new
provider call.

An execution that dies after creating a processing run but before storing
validated output has the same identity problem. Conversely, simply adding the
job attempt number to every key would discard the valuable ability to recover
a validated category after a crash. The workflow needs separate stable
operation identity and individual call-attempt identity.

## Solution

Represent a category phase as one stable generation reservation and represent
each provider call as an append-only attempt beneath that reservation.

On a new durable execution:

- reuse a compatible validated result from an earlier attempt;
- never reuse a failed provider attempt as though it were successful;
- create a new deterministic attempt identity when another provider call is
  allowed;
- leave abandoned and failed attempts in provenance;
- publish only while the current job lease is live.

Use the same reservation/attempt semantics for Gap and Action Plan category
generation so retry behavior cannot drift again.

## Commits

1. `test: expose failed Gap run collision on durable retry`
   - Add a focused test that exhausts the coordinator's transient calls during
     the first durable execution.
   - Re-lease the same job with an incremented attempt count.
   - Make the provider succeed on the second durable execution.
   - Assert that the second execution reaches publication rather than an
     existing-run conflict.

2. `test: preserve validated category recovery across lease loss`
   - Persist a validated processing run without publishing the business
     revision.
   - Re-lease the job.
   - Assert that the candidate is recovered without another provider call and
     is still subject to the new lease's publication fence.

3. `refactor: name stable generation reservations separately from attempts`
   - Introduce explicit internal terminology and types for reservation identity,
     phase identity, durable execution attempt, and provider-call attempt.
   - Keep the existing external job and AI-run DTOs unchanged.
   - Convert Gap and Action Plan key construction to the shared identity helper
     without changing persisted behavior yet.

4. `refactor: pass durable job attempt into Gap execution`
   - Carry the leased job's attempt count through the Gap handler and category
     coordinator input.
   - Validate that it is a positive integer at the execution seam.
   - Keep manual retry nonce semantics separate from automatic durable attempts.

5. `schema: record stable AI reservation identity`
   - Add an indexed stable reservation identity to AI processing runs.
   - Add an explicit call-attempt identity or ordinal that distinguishes
     provider calls within the reservation.
   - Preserve the existing idempotency key as the unique identity of one actual
     call attempt.
   - Backfill is not required for disposable databases; compatibility reads
     must safely ignore legacy rows that lack the new identity until cleanup.

6. `refactor: recover compatible validated attempts`
   - Before making a provider call, search the reservation for a compatible
     validated processing result.
   - Verify definition, prompt contract, locale, pinned inputs, and parent job
     before recovery.
   - Return the persisted context and output through the normal grounding
     interface.
   - Do not recover failed, incompatible, or empty processing attempts.

7. `fix: allocate a fresh AI call attempt after failure`
   - Derive the next deterministic attempt identity from phase, durable
     execution attempt, and bounded provider attempt.
   - Create a new AI processing run when prior attempts failed or never produced
     validated output.
   - Preserve all previous attempts and safe failure information.

8. `fix: reconcile superseded processing attempts`
   - When a successor attempt starts, mark an older empty processing attempt as
     abandoned only when the new worker holds the live parent lease.
   - When publication succeeds, mark other still-processing attempts under the
     reservation as superseded.
   - Keep validated recovered attempts selected for publication in their normal
     succeeded lifecycle.

9. `refactor: align Action Plan retry identity`
   - Move Action Plan generation onto the same reservation/attempt helper.
   - Preserve its currently working cross-attempt retry behavior.
   - Remove its separate attempt-key convention after parity tests pass.

10. `test: cover retry and recovery matrix`
    - Cover transient failure followed by durable success.
    - Cover terminal failure with no durable retry.
    - Cover crash before provider response persistence.
    - Cover crash after validated output but before publication.
    - Cover repair-phase retry independently from initial generation.
    - Cover concurrent stale worker publication rejection.

11. `docs: state Gap retry and recovery semantics`
    - Document stable reservations, append-only call attempts, recoverable
      validated output, and lease-fenced publication.
    - Explicitly distinguish automatic durable retry from a user-requested new
      generation job.

## Decision Document

- One category phase is a stable reservation; one actual provider call is an
  attempt.
- AI attempts are append-only. A retry never rewrites a failed attempt.
- A validated candidate may be recovered because business publication remains
  guarded by the current lease and current input checks.
- Failed and empty abandoned attempts are never treated as recovered output.
- Gap and Action Plan share the same identity and recovery rules.
- Manual retry nonces identify a newly requested generation reservation;
  durable attempt counts identify execution attempts within it.
- The business result and current pointer remain unchanged until the existing
  publication transaction succeeds.

## Testing Decisions

Tests assert observable provider-call count, AI-run lifecycle, job state, and
published revision. They do not assert private hash formulas.

Use the existing job lease database tests, generation lifecycle tests,
grounding provenance tests, generation reliability tests, and publication lease
tests as prior art. At least one test must use the connected PostgreSQL path
because uniqueness and concurrent lease behavior are part of the contract.

## Acceptance Criteria

- A transiently failed Gap job can succeed on a later durable lease.
- A validated category survives lease loss without another provider call.
- Every actual provider call has one immutable AI attempt record.
- Failed or empty attempts are never recovered as valid output.
- Gap and Action Plan use the same reservation and attempt rules.
- A stale worker still cannot publish after losing its lease.

## Rejected Alternatives

- Adding only the job attempt count to the existing key: this fixes collision
  but loses recovery of validated output after a crash.
- Reopening and overwriting a failed AI run: this destroys attempt provenance.
- Disabling durable job retry: this contradicts the current queue contract and
  reduces resilience.

## Out of Scope

- Changing prompts, response schemas, retrieval ranking, or category policy.
- Increasing retry or concurrency limits.
- Retrying terminal policy or invalid-input failures.
- Reusing output across different definition hashes, locales, inputs, or prompt
  contracts.
- Adding a new job kind or user-facing retry control.
