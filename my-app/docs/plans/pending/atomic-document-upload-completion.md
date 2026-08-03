# Atomic Document-Upload Completion

Status: proposed correctness plan for the current direct-upload workflow.

This plan replaces only the upload-completion transaction portion of the older
organization document-processing worker plan. That plan's parsing, chunking,
and worker concerns remain separate.

## Problem Statement

The uploaded object is verified before document creation, which is correct.
After verification, however, document rows, the indexing job, upload-session
completion, and the audit event commit in separate database operations.

A crash can therefore leave:

- a pending document version without a durable indexing job;
- a job without a completed upload-session result;
- a completed business transition without its audit event; or
- an `uploaded` session whose retry creates a second document and version.

The storage download and hash computation should remain outside a database
transaction, but the durable database handoff must be atomic and replayable.

## Solution

Create one upload-completion command whose interface accepts a verified object
description and returns the existing or newly committed result.

Inside one transaction it locks the upload session, verifies its actor,
organization, state, expiry, and object identity, replays a completed result, or
atomically creates the document, version, indexing job, audit event, and upload
result locator.

Only after the transaction commits may the HTTP response trigger portable job
execution.

## Commits

1. `test: capture atomic upload completion contract`
   - Add a database-backed happy-path test proving exactly one document,
     version, indexing job, audit event, and completed session are committed.
   - Assert that the result locator identifies the created immutable version.

2. `test: expose upload completion replay defect`
   - Begin with a verified `uploaded` session.
   - Invoke completion twice with the same input.
   - Assert that both calls return the same result and only one artifact set
     exists.

3. `refactor: separate object verification from database finalization`
   - Introduce a verified-upload value containing immutable session and object
     facts.
   - Make verification perform storage I/O and hashing without creating domain
     rows.
   - Preserve all current size, MIME, hash, expiry, user, and organization
     checks.

4. `refactor: add transaction-scoped upload finalization`
   - Lock the upload-session row.
   - Return the stored result when the session is already completed.
   - Reject failed, expired, mismatched, or differently scoped sessions.
   - Require `uploaded` state before creating new domain state.

5. `fix: commit document version and indexing job together`
   - Generate the stable identifiers before inserts.
   - Insert the document and immutable version.
   - Update the current-version pointer.
   - Insert the validated indexing job within the same transaction.
   - Treat failure to create any row as failure of the entire command.

6. `fix: commit result locator and audit event together`
   - Mark the upload session completed with the version locator in the same
     transaction.
   - Insert the organization audit event with the committed job identity.
   - Return a projected result only after all writes succeed.

7. `refactor: route retries through the atomic command`
   - Replace the current sequence of independent writes.
   - Preserve the current HTTP response and client replay flag.
   - Ensure a completed replay does not download or hash the object again when
     the stored result can be authorized and returned directly.

8. `test: inject failure at every former handoff`
   - Fail document insertion, version insertion, pointer update, job insertion,
     session completion, and audit insertion one at a time.
   - Assert complete rollback each time.
   - Retry after each failure and assert one successful artifact set.

9. `test: cover concurrent completion`
   - Run two completion commands for the same uploaded session.
   - Assert that one creates and the other replays, or that one safely retries
     after serialization.
   - Assert that no duplicate document or job is created.

10. `refactor: reuse the transaction-aware job enqueue interface`
    - Once the background-job module plan lands, replace the direct job insert
      with its transaction-aware enqueue operation.
    - Keep this as a follow-up commit so atomicity does not depend on the larger
      job refactor.

11. `docs: define the direct-upload handoff`
    - State that object verification precedes the transaction.
    - State that document, version, job, audit, and completion locator commit
      atomically.
    - State that completion is safely replayable.

## Decision Document

- Storage I/O never occurs while the database transaction is open.
- Database finalization owns all durable handoff writes.
- The upload session is the idempotency aggregate for completion.
- Completed results are replayed from the stored locator; they are not rebuilt.
- The indexing job is part of the document-version creation transaction.
- Audit is part of successful finalization, not best-effort follow-up work.
- Existing storage object keys, HTTP routes, DTOs, and job kinds remain
  unchanged.

## Testing Decisions

The main tests use PostgreSQL because row locking, rollback, and concurrent
completion are observable requirements. Storage verification is represented by
a deterministic adapter so tests do not require Supabase.

Use upload-session policy tests, document processing tests, document
one-time-contract tests, job lease database tests, and other transactional
publication tests as prior art.

## Acceptance Criteria

- One completed upload creates exactly one document, version, indexing job,
  audit event, and result locator.
- Retrying a completed or interrupted request returns the same result.
- Failure of any database write leaves none of the finalization writes
  committed.
- Concurrent completion cannot create duplicate artifacts.
- Storage I/O occurs before, never during, the finalization transaction.

## Rejected Alternatives

- Relying only on route idempotency: the upload session already owns the
  durable state transition, and crashes can occur below the route record.
- A repair cleanup for missing jobs: cleanup does not prevent duplicate
  documents or missing audit and should not replace atomic publication.
- Holding the transaction open during object download: this would unnecessarily
  extend locks across remote I/O.

## Out of Scope

- Changing direct-upload UX or supported file types.
- Replacing Supabase Storage.
- Changing parsing, chunking, or embedding behavior.
- Introducing later document versions if they are not already supported.
- Deleting orphaned historical data created before this fix; handle that with a
  separately reviewed repair script if inspection finds any.
