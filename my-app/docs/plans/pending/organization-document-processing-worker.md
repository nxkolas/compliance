# Asynchronous Organization Document Processing

Status: proposed on 2026-07-28.

## Problem Statement

Organization document completion currently performs parsing, chunking, and
embedding in the HTTP request. The request therefore remains open across
storage download, local document processing, and an external embedding call.
A slow provider, process restart, expired request, or closed browser can make a
valid upload appear to fail even though durable records were already created.

The application already has a PostgreSQL-backed background-job system with
leasing, heartbeats, retries, typed results, polling, audit events, and worker
deployment support. Gap Analysis and Action Plan generation already belong in
that system. Organization document processing should use the same durable
boundary.

The existing worker leases all supported job kinds and executes one job at a
time. After document processing moves into the queue, a large document or
corpus job could delay user-facing Gap Analysis or Action Plan generation.
Worker roles should therefore isolate latency-sensitive generation from
throughput-oriented background work.

## Goals

- Complete an upload request after durable work has been scheduled, without
  waiting for parsing or an embedding provider.
- Make document processing safe across browser closure, HTTP timeout, worker
  restart, expired leases, and transient provider failures.
- Preserve exactly-once document materialization while allowing at-least-once
  job execution.
- Make retries resume work instead of duplicating chunks or embeddings.
- Keep Gap Analysis and Action Plan jobs responsive while long document or
  corpus jobs are running.
- Continue using PostgreSQL as the queue; do not add Redis or another broker.
- Use `drizzle-kit push` for the disposable development database.
- Keep staging and production on reviewed, committed forward migrations.

## Non-Goals

- Moving every AI request into a worker.
- Replacing the existing Gap Analysis or Action Plan job contracts.
- Adding Redis, BullMQ, a queue priority column, or provider-specific
  background execution.
- Adding a general-purpose chat or streaming AI endpoint.
- Adding OCR or new document formats.
- Supporting user cancellation of document processing in the first version.
- Resetting the development database as the normal schema-change mechanism.

## Recommendation

Use a background job for organization document processing because it is a
durable, multi-step workflow whose result must outlive one HTTP connection.
Keep future short, interactive, streamed AI requests in the web process when
their result does not need durable orchestration.

Use two worker roles:

| Role | Job kinds |
| --- | --- |
| `interactive` | Gap Analysis generation and Action Plan generation, including versioned job kinds |
| `background` | Organization document processing, legal corpus import/process/embed/monitor/evaluation, report rendering, and cleanup |
| `all` | Every registered kind; backward-compatible local/default behavior |

Role-specific leasing is sufficient because the current job repository already
accepts an allowlist of job kinds. No queue schema or priority algorithm is
needed for the role split.

## Target Flow

```text
Browser
  |
  | upload bytes directly to private storage
  v
Complete-upload API
  |
  | one transaction:
  | - lock and validate upload session
  | - create document and version
  | - create pending extraction and embedding generation
  | - enqueue a document-processing job
  | - record upload/idempotency results
  v
HTTP 202: document + job
  |
  +-----------------------> UI shows "Processing" and polls the job
  |
  v
Background worker
  |
  | download -> parse -> chunk -> embed in batches -> persist typed result
  v
Succeeded document version
  |
  v
Eligible for retrieval and Gap reassessment
```

The API transaction is the handoff boundary. It must commit either all durable
records and the queued job, or none of them. It must perform no parsing,
chunking, storage download, or embedding-provider call.

## Domain and State Decisions

### Job kind

Add one job kind named `organization-document-process`.

Its payload identifies:

- the organization;
- the document version;
- the extraction;
- the embedding generation; and
- the pinned parser, chunking, embedding-provider, model, model revision,
  vector dimensions, and retrieval-instruction configuration needed to resume
  deterministically.

The worker must re-read and validate authoritative database records rather than
trusting tenant or configuration values from the payload alone.

### Processing states

New extraction and embedding-generation rows start as `pending`. The worker
changes a stage to `processing` only when it starts that stage.

A document becomes usable by retrieval and reassessment only when the current
embedding generation is `succeeded`. Existing read-side eligibility rules
remain authoritative.

Terminal document-processing failures update both domain processing state and
the job. Transient failures leave already completed chunks and embeddings
available for the next attempt.

### Retry policy

Classify failures explicitly:

| Failure class | Examples | Behavior |
| --- | --- | --- |
| transient storage | timeout, connection reset, temporary service error | retry job |
| transient provider | 429, timeout, retryable 5xx | retry job with bounded delay |
| transient worker | lease loss or process termination | resume after lease expiry |
| terminal input | missing object, hash mismatch, unsupported MIME type | fail immediately |
| terminal parsing | corrupt/unreadable supported file | fail immediately |
| terminal policy | tenant/configuration mismatch | fail immediately |

Disable automatic retries inside the embedding SDK for this workflow so the
worker job remains the single retry owner. Honor `Retry-After` where available;
otherwise use bounded backoff.

The first version is not cancellable. Cancellation needs an explicit
`cancelled` document-processing state and cleanup semantics, so it should be a
separate product change.

### Manual retry

A user with document-management capability may explicitly requeue a terminally
failed document-processing job. Requeueing preserves the job identity and
resets its execution counters and safe error fields in one guarded
transaction. It does not create another document version or embedding
generation.

Manual retry must reject succeeded, currently queued, running, or unauthorized
jobs.

## Resume-Safe Processing

The processor must be an idempotent executor independent of HTTP concerns.

### Parsing and chunks

- Validate the storage object and content hash before parsing.
- Persist extraction metadata and chunks transactionally.
- Use the extraction/chunk index uniqueness rule as an invariant.
- On retry, detect a complete existing extraction and reuse it.
- If an earlier attempt left a partial extraction, replace or reconcile it in
  one transaction before continuing.
- Never append a second logical copy of the same chunk set.

The preferred first implementation is stage-level atomicity: parse and build
chunks in memory, then replace the extraction's derived chunk set in one
transaction. This keeps partial extraction recovery simple.

### Embeddings

- Split chunks into bounded batches rather than one unbounded provider call.
- Before each call, load only chunks that do not yet have an embedding for the
  pinned generation.
- Persist each successful batch before requesting the next batch.
- Make insertion conflict-safe on the existing generation/chunk primary key.
- Update job progress after each committed batch.
- Mark the generation `succeeded` only after every expected chunk has exactly
  one embedding.

This permits an expired lease or transient provider failure to resume from the
first missing batch.

## Database Changes

Database work is necessary because successful jobs require one typed result
and the current result model has no organization-document target.

### Drizzle-owned schema

Add:

- nullable `job_id` on document embedding generations;
- a foreign key from that column to background jobs;
- a partial index for non-null job lookup;
- a uniqueness rule ensuring one processing job is attached to one embedding
  generation;
- nullable `document_version_id` on background job results;
- a foreign key and partial lookup index for that result column; and
- `document_version_id` in the exactly-one-result check.

All new columns are nullable so existing data remains valid. No data reset or
backfill is required.

The upload-completion transaction generates all IDs up front, inserts the job,
then inserts the extraction/embedding records and typed upload result in
foreign-key-safe order.

### Operator-owned integrity

Add a new, immutable operator SQL file rather than modifying a previously
recorded operator SQL file. The additive SQL must:

- extend typed job-result validation for
  `organization-document-process`;
- require the job, document version, extraction, and embedding generation to
  belong to the same organization and relationship chain;
- reject document-version results for every other job kind;
- reconcile the legacy duplicated exactly-one check after the existing base
  integrity SQL runs on a fresh database; and
- remain idempotent.

Register the new operator SQL in both the approved local SQL allowlist and the
locked migration runner after the base integrity SQL. This preserves checksum
history and ensures a fresh environment ends in the same state as an upgraded
environment.

### Development database workflow

The development database is disposable, but a reset is unnecessary for this
additive change. Use the repository's approved Drizzle workflow:

```powershell
node -e "require('dotenv').config({ quiet: true }); const value=process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL; if (!value) throw new Error('Database URL is not configured'); const u=new URL(value); console.log({ host:u.hostname, port:u.port, database:u.pathname });"
npm.cmd run db:push -- --explain
npm.cmd run db:push
npm.cmd run db:apply-operator-sql -- scripts/sql/organization-document-job-integrity.sql
npm.cmd run db:verify:server-only
npm.cmd run db:verify:integrity
npm.cmd run db:push -- --explain
```

Review the first preview and stop on any unintended drop, RLS change, or change
outside the reviewed tables. Do not use `--force`. The final preview must show
zero drift.

If clean-bootstrap qualification is desired after the implementation passes,
reset only the explicitly verified disposable development target, rebuild it
through the documented bootstrap runbook, and repeat the acceptance tests.
That reset is additional verification, not the implementation mechanism.

### Staging and production workflow

`drizzle-kit push` must not be used for staging or production. Generate and
review a forward SQL migration containing the Drizzle-owned changes, commit it
with the new operator SQL, and apply both through the locked migration runner.

There is no automatic down migration. Rollback is a forward fix or a verified
database restore.

## API Contract

### Complete upload

Change successful completion from `201 Created` to `202 Accepted`.

Return:

- the same document identity and version metadata the client already needs;
- the authorized job DTO;
- a `replayed` flag for idempotent completion calls; and
- a stable processing status derived from the job/domain state.

An idempotent replay returns the same document version and job. It must not
create another job or re-run processing.

### Job projection

Extend the authorized job result projection with `documentVersionId`. Expose it
only after successful processing, following the same typed-result rules as
other job kinds.

The generic job endpoint remains the polling source. Do not add a second
document-specific polling protocol.

### Manual retry

Add a document-processing retry action scoped by organization and document
version. It authorizes document-management capability, validates the current
job/domain state, and requeues the existing failed job.

## UI Behavior

- Add the document row immediately after the completion API returns.
- Show `Processing` while the job is queued or running.
- Poll through the existing job client with the established interval and
  terminal-state handling.
- Change the row to `Indexed` only after the job succeeds.
- Show a safe failure message and retry action after terminal failure.
- Stop polling when the component unmounts or a terminal state is reached.
- On page load, project the current processing job with each document so
  polling resumes after refresh or browser closure.
- Keep failed or processing documents ineligible for reassessment selection.

No generated document text, provider error detail, storage path, or sensitive
payload data should be returned in the job DTO.

## Worker Role Design

Add a validated `WORKER_ROLE` setting:

- `interactive`;
- `background`; or
- `all`, the default for backward compatibility.

The worker runtime maps each role to an immutable list of registered job kinds
and passes only that list to the existing lease function. Startup should fail
for an unknown role or an empty role mapping.

Each worker remains sequential at the top-level job boundary in the first
version. Existing bounded concurrency inside Gap Analysis and Action Plan
generation remains unchanged.

Operational logs and health output should include:

- worker ID;
- worker role;
- registered job kinds;
- current job ID and kind;
- last successful heartbeat; and
- oldest runnable job age for the worker's role.

## Deployment Changes

### Local Compose

Run one interactive worker and one background worker. Keep an optional
single-worker profile using `WORKER_ROLE=all` for lightweight development.

### Production blue/green

For each color, deploy:

- one web service;
- one interactive worker; and
- one background worker.

Update deployment, health, drain, rollback, and cleanup logic so both workers
belong to the same release color. A release is healthy only when the web
service and both worker roles are healthy.

During rollback, stop both roles for the failed color and restore both roles
for the previous color. Never leave workers from two application revisions
leasing the same newly introduced job kind after a schema-incompatible
rollback.

## Implementation Plan

Each numbered item is intended to be a small commit that leaves the repository
working.

### Phase 1: Characterize and isolate current processing

1. Add characterization tests for upload completion, extraction status,
   chunk creation, embedding creation, audit events, and failure projection.
2. Extract document processing into an executor that accepts pinned IDs and
   configuration but preserves the current synchronous caller.
3. Add resume tests for complete extraction reuse and partial extraction
   recovery.
4. Make extraction/chunk persistence stage-atomic and conflict-safe.
5. Add an embedding batch coordinator with a small configurable batch size.
6. Persist each embedding batch and skip already embedded chunks on retry.
7. Set the embedding SDK retry count to zero for the executor.
8. Add typed terminal/transient document failure classification.

### Phase 2: Add the durable document job

9. Add the Drizzle schema fields, foreign keys, indexes, and exactly-one
   result update.
10. Add the new immutable operator SQL and register it after the base
    integrity SQL.
11. Extend database integrity tests for correct kind, tenant, generation,
    extraction, and document relationships.
12. Extend the job result mapping and authorized job DTO with the document
    version result.
13. Add a transaction-scoped enqueue helper that accepts a transaction and
    pre-generated job ID.
14. Change upload completion to create pending domain rows and the queued job
    in one transaction while retaining the synchronous executor temporarily
    behind a compatibility switch used only by tests.
15. Add the organization-document worker handler.
16. Record terminal domain failure and safe audit metadata from the handler.
17. Prove lease expiry resumes missing embedding batches without duplicate
    vectors.

### Phase 3: Switch the API and UI

18. Change the completion response to `202` with document and job data.
19. Remove every parser, storage-download, and embedding-provider call from the
    completion request path.
20. Update the typed document client for the accepted-job response.
21. Show the new document immediately in processing state and poll its job.
22. Include current processing-job state in document-list projection so a
    refresh resumes polling.
23. Add the guarded manual retry service and route.
24. Add the failed-document retry action and localized messages.
25. Remove the synchronous compatibility path once route, worker, and UI tests
    pass.

### Phase 4: Isolate worker lanes

26. Add and validate `WORKER_ROLE` with `all` as the default.
27. Define and test the interactive and background job-kind registries.
28. Pass the role registry to the existing kind-filtered lease operation.
29. Add role-aware startup logs, health output, and oldest-runnable-job age.
30. Split local Compose into interactive and background workers.
31. Split both production colors into interactive and background workers.
32. Update deploy, health, drain, rollback, and old-color cleanup procedures
    for the two worker roles.
33. Add deployment acceptance proving an interactive job can start while a
    background worker is occupied by a long document job.

### Phase 5: Database and release qualification

34. Verify the non-secret development database identity.
35. Run `db:push -- --explain` and review the exact additive DDL.
36. Run `db:push`, apply the new operator SQL, verify RLS and integrity, then
    require a zero-drift preview.
37. Generate and review the committed forward migration for non-development
    environments.
38. Run targeted document, job, route, UI, and worker-role tests.
39. Run lint, typecheck, the full test suite, i18n checks, and production build.
40. Restart a worker during a multi-batch document and verify successful
    resume.
41. Simulate a retryable provider failure and verify no duplicate chunks or
    vectors.
42. Complete an upload, close the browser, reload, and verify the document
    reaches `Indexed`.
43. Optionally rebuild the explicitly verified disposable development
    database from zero and repeat schema, operator SQL, bootstrap, and smoke
    checks.
44. Run Docker acceptance with both worker roles before production rollout.

## Testing Decisions

Tests should assert external behavior and durable invariants, not private
function call order.

### Unit tests

- document failure classification;
- batch partitioning and progress calculation;
- missing-embedding selection;
- role-to-job-kind mapping;
- worker-role environment validation; and
- job result DTO projection.

### Integration tests

- completion returns `202` without invoking parsing or embeddings;
- document, processing rows, job, upload result, and idempotency result commit
  atomically;
- the same completion key returns the same document and job;
- wrong tenant/kind/result combinations are rejected by the database;
- a transient failure resumes at the first missing embedding batch;
- an expired lease is reclaimed safely;
- a corrupt file fails without repeated attempts;
- manual retry is authorized and state-guarded;
- a succeeded document becomes reassessment-eligible;
- processing and failed documents remain ineligible; and
- an interactive worker never leases a background job, and vice versa.

### UI and end-to-end tests

- processing state appears immediately;
- polling survives navigation and resumes after reload;
- success becomes `Indexed`;
- terminal failure shows safe retry UI;
- retry returns the row to processing;
- closing the request/browser does not cancel durable work; and
- an interactive job starts while the background lane is busy.

### Existing prior art

Reuse the repository's job state-machine, job polling, job-route contract,
document parsing/chunking, database integrity, and Docker functional acceptance
test styles.

## Acceptance Criteria

- Upload completion returns within the normal API latency budget after durable
  scheduling and never waits on parsing or an AI provider.
- Closing the browser or losing the HTTP connection does not lose processing.
- A worker restart or expired lease resumes without duplicate chunks or
  embeddings.
- Retryable provider failures are retried by the job layer only.
- Terminal file or policy errors do not consume all attempts.
- Idempotent completion creates exactly one document version and one processing
  job.
- Successful document jobs have exactly one typed document-version result.
- Database integrity rejects the wrong job kind, organization, document,
  extraction, or embedding generation.
- Documents become retrievable and reassessment-eligible only after embedding
  success.
- Interactive jobs are not blocked by work already leased to the background
  worker.
- `drizzle-kit push` finishes with zero drift on the disposable development
  database.
- The committed forward migration and operator SQL build a clean database to
  the same final schema.
- RLS, integrity verification, lint, typecheck, tests, i18n checks, production
  build, and Docker acceptance all pass.

## Rollout

1. Deploy the additive schema and operator integrity change.
2. Deploy code that can read the new nullable fields while still using the old
   synchronous request behavior.
3. Deploy the document worker handler and `all` role compatibility.
4. Switch upload completion to enqueue asynchronously.
5. Deploy separate interactive and background workers.
6. Monitor queue age, job attempts, document-processing duration, terminal
   failure rate, and Gap/Action Plan start latency.
7. Remove temporary compatibility code after one stable release.

This expand-then-switch order keeps every intermediate application revision
compatible with the additive schema.

## Rollback

Before the asynchronous switch, code can be rolled back without reverting the
additive nullable schema.

After the switch:

1. Stop new document completion traffic or deploy the previous compatible web
   release.
2. Keep an `all`-role worker running until already queued document jobs reach a
   terminal state.
3. Revert the web and worker code together.
4. Leave the additive columns, indexes, and operator validation in place.
5. Use a forward fix for schema corrections; do not use `drizzle-kit push
   --force` or an automatic down migration.

If a release introduced a data-corrupting defect, stop all writers and restore
only from a verified backup of the explicitly targeted environment.

