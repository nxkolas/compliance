# Internal API and Client/Server Service Completion

Status: proposed implementation plan; product and architecture decisions
confirmed on 2026-07-22.

> Current-state note (2026-07-24): report provenance is implemented through
> typed action-plan, artifact, and document source tables. References below to
> polymorphic `report_sources` are historical design context.

## Outcome

Complete the application backend as an internal Next.js backend-for-frontend:

1. Every browser use case has a deliberate, authorized HTTP contract.
2. Client Components use typed feature clients instead of raw fetch calls.
3. Server Components and trusted server code call server services directly.
4. Thin route handlers share authentication, validation, response, error,
   idempotency, concurrency, pagination, quota, and observability behavior.
5. Server services own use-case authorization, transactions, workflow rules,
   immutable history, and audit events.
6. Long-running work returns a durable job and executes outside the request.
7. Existing internal contracts may change when every in-repository caller is
   migrated in the same increment.

This is not a public API. It carries no partner compatibility guarantee,
external API keys, externally published OpenAPI lifecycle, or speculative
generic CRUD.

Supabase Auth remains responsible for sign-up, login, confirmation, password
recovery, and session cookies through the existing auth routes/SSR helpers.
Do not add duplicative JSON authentication endpoints; application services
begin with the authenticated user and own organization/platform authorization.

## Scope

Included:

- Supabase-authenticated organization and invitation workflows;
- organization members, multiple owners, role/lifecycle administration, and
  assignee lookup;
- organization archival/restoration;
- authenticated and existing guest Betroffenheitscheck use cases;
- organization documents, versions, direct-storage uploads, source access, and
  processing status;
- Gap-Analyse assessment, questionnaire, reassessment, asynchronous generation,
  review, approval, and staleness;
- Maßnahmeplan creation, editing, history, reconciliation, and activation;
- dashboard read model;
- asynchronous PDF reports, history, status, cancellation, and download;
- organization and platform audit reads;
- common jobs, idempotency, concurrency, pagination, quotas, and telemetry;
- Platform Administrator and legal-corpus administration required by
  authoritative-legal-corpus-and-grounded-ai.md.

Deferred:

- public or partner API;
- notifications and comments;
- guest Gap-Analyse;
- general-purpose AI chat;
- permanent organization erasure;
- persisted help/FAQ/glossary content;
- automatic AI calls after uploads or source changes.

## Current baseline

The repository currently has 25 route patterns under app/api. They cover core
mutations but leave many reads to direct server calls and omit member
administration, dashboard data, reports, audit reads, common jobs, and corpus
administration.

Nine Client Component files call fetch directly:

- components/action-plans/action-plan-workflow.tsx
- components/applicability-check/applicability-questionnaire-form.tsx
- components/applicability-check/guest/guest-applicability-actions.tsx
- components/documents/organization-document-manager.tsx
- components/gap-analysis/gap-analysis-workflow.tsx
- components/organizations/organization-create-form.tsx
- components/organizations/organization-inbox.tsx
- components/organizations/organization-invite-panel.tsx
- components/organizations/organization-settings-form.tsx

Existing server services already hold substantial business behavior. Preserve
their working domain logic while separating broad service files into cohesive
readers, commands, contracts, and policies only when a feature is migrated.

## Architectural rules

### Dependency direction

    Client Component
      -> src/client/<feature>.ts
      -> app/api/.../route.ts
      -> shared Zod contract
      -> src/server/<feature>/ service/use case
      -> database, storage, worker, provider adapters

    Server Component or trusted server workflow
      -> src/server/<feature>/ service/use case directly

Server code must not call its own HTTP API. Client code must not import database
schema types or server-only modules. Route handlers must not implement business
transactions.

### Suggested layout

Add:

- src/contracts/common/: envelopes, IDs, cursors, versions, jobs, uploads.
- src/contracts/<feature>/: request, query, response, and error-code schemas.
- src/client/api-client.ts: credentials, JSON parsing, envelope handling,
  AbortSignal, request ID, idempotency, If-Match, and typed errors.
- src/client/<feature>.ts: small feature-oriented methods.
- src/server/api/handler.ts: common route adapter and safe error boundary.
- src/server/api/response.ts: JSON envelope and request ID.
- src/server/api/pagination.ts: opaque cursor encode/decode and bounded limits.
- src/server/api/idempotency.ts: request fingerprint and replay lifecycle.
- src/server/api/concurrency.ts: ETag/version parsing and preconditions.
- src/server/api/rate-limit.ts: configurable subject/scope limits.
- src/server/auth/capabilities.ts: deny-by-default capability resolution.
- src/server/jobs/: durable job service and authorization.
- src/server/uploads/: upload-session lifecycle and object verification.

Keep feature-specific validation beside shared contracts, not duplicated in
routes and services.

### Response contract

JSON success:

    {
      "data": {},
      "meta": {
        "nextCursor": "...",
        "version": 4,
        "requestId": "..."
      }
    }

Only include relevant meta fields.

JSON error:

    {
      "error": {
        "code": "ACTION_PLAN_STALE",
        "message": "The action plan changed.",
        "details": {},
        "requestId": "..."
      }
    }

Error codes are stable and drive localization/client behavior. Messages are
safe fallbacks. Validation details never expose database/provider internals.

Non-JSON exceptions:

- direct private-storage uploads use Supabase's signed upload protocol;
- downloads use a short-lived signed URL response or an authorized redirect;
- health endpoints may return minimal plain responses and are not user APIs.

### HTTP and workflow semantics

- GET reads a resource or collection and has no business side effect.
- POST creates a resource or invokes a named business command.
- PATCH updates an explicitly mutable projection and requires If-Match.
- DELETE is reserved for ephemeral, truly deletable records. Published,
  referenced, audited, organization, document, assessment, artifact, plan, and
  corpus history uses archive/withdraw/cancel commands instead.
- Create responses use 201.
- Asynchronous commands use 202 and return the domain resource plus job.
- Successful commands without a body may use 204.
- Validation, authentication, authorization, conflict, expiry, payload/media,
  semantic-validation, and rate-limit statuses use the agreed HTTP status set.

Generic PATCH status mutations are forbidden for domain state machines.
Generate, approve, publish, activate, archive, restore, withdraw, retry, cancel,
and resolve remain named commands.

### Pagination

Use opaque cursor pagination for every growing collection. A cursor contains
only signed/encoded stable sort values and scope, not raw SQL. Each endpoint:

- defines one stable default order with an ID tie-breaker;
- accepts a bounded limit;
- validates supported filters and sort keys;
- returns meta.nextCursor when more rows exist;
- rejects a cursor created for another scope/filter set.

Fixed published questionnaire/catalog data can remain unpaginated.

### Idempotency

Require Idempotency-Key for:

- organization creation;
- invitation creation/resend;
- upload completion;
- assessment start and questionnaire submission;
- reassessment prepare/generate/retry;
- action-plan creation/reconciliation/activation;
- PDF report creation;
- corpus import/process/retry/publish/evaluate/activate;
- all other costly or create-once commands.

Persist actor, scope, operation, key, canonical request fingerprint, lifecycle,
and result reference. Same key plus same request replays the result; same key
plus different request returns a conflict. Never hold a database transaction
open during storage, provider, or model I/O.

### Optimistic concurrency

Expose an integer version or immutable state token as ETag. Require If-Match
for:

- organization settings/archive state;
- membership role/status;
- document mutable metadata/current state;
- reassessment evidence drafts;
- action-plan operational items;
- reconciliation decisions;
- corpus source metadata, monitors, draft release membership, and change-alert
  resolution.

Missing required preconditions return 428; stale tokens return 412. Existing
domain conflicts that are not simple stale writes remain 409.

### Authorization

Resolve capabilities from active membership or the server-owned Platform
Administrator registry. Suggested capability groups:

- organizations:read, organizations:update, organizations:archive
- members:read, members:invite, members:manage
- applicability:read, applicability:submit
- documents:read, documents:write, documents:archive
- gap:read, gap:contribute, gap:review, gap:approve
- plans:read, plans:contribute, plans:manage, plans:activate
- reports:read, reports:create
- audit:read
- corpus:read, corpus:curate, corpus:review, corpus:publish,
  corpus:activate, corpus:operate
- platform-admins:manage

Services enforce capabilities even after routes authenticate. Organization
lookups should generally return 404 rather than reveal inaccessible tenant IDs.
The final active owner invariant is enforced transactionally.

## Common service contracts

### API client

api-client.ts should provide:

- request<TInput, TOutput>();
- automatic credentials and accepted locale headers;
- shared envelope/error parsing;
- schema validation in development/tests;
- AbortSignal support;
- Idempotency-Key and If-Match options;
- 202 job normalization;
- 204 handling;
- typed ApiClientError with status, code, details, and request ID.

It must not show toast messages, mutate React state, or choose translations.

### Jobs

Common job states:

- queued
- running
- cancellation_requested
- succeeded
- failed
- cancelled

The public job DTO includes ID, kind, state, progress, attempt count, safe
error, timestamps, cancellability, and result link. It excludes payloads,
leases, credentials, raw provider responses, and stack traces.

### Uploads

Upload-session flow:

1. Create a session after capability, quota, filename, MIME, size, and scope
   checks.
2. Return an immutable object path and short-lived signed upload token.
3. Client uploads bytes directly to the private bucket.
4. Complete the session idempotently.
5. Server verifies object existence, actual size/type, and content hash before
   creating the immutable version and processing work.
6. Expired abandoned sessions and unreferenced draft objects are cleaned up.

Organization-evidence completion may retain synchronous parsing initially.
Legal-source completion always enqueues worker processing.

## Endpoint inventory

Paths are the target internal contract. Existing paths should be retained when
they fit; contract normalization may update them with all callers in the same
commit.

### User invitation mailbox

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organization-invitations | List the current user's pending invitations |
| POST | /api/organization-invitations/:invitationId/accept | Accept by authenticated email |

Keep raw-token acceptance only if email delivery still requires it; isolate it
from mailbox acceptance and never return stored token hashes.

### Organizations and team

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations | Paginated active/archived memberships |
| POST | /api/organizations | Create organization and first owner |
| GET | /api/organizations/:organizationId | Read organization and caller capabilities |
| PATCH | /api/organizations/:organizationId | Update mutable settings with If-Match |
| POST | /api/organizations/:organizationId/archive | Archive after explicit confirmation |
| POST | /api/organizations/:organizationId/restore | Restore archived organization |
| GET | /api/organizations/:organizationId/facts | Read current localized facts |
| GET | /api/organizations/:organizationId/members | Paginated members/assignee lookup |
| PATCH | /api/organizations/:organizationId/members/:memberId | Change role with If-Match |
| POST | /api/organizations/:organizationId/members/:memberId/deactivate | Deactivate membership |
| POST | /api/organizations/:organizationId/members/:memberId/reactivate | Reactivate membership |
| POST | /api/organizations/:organizationId/members/leave | Leave while preserving last-owner rule |
| GET | /api/organizations/:organizationId/invitations | Paginated invitation history |
| POST | /api/organizations/:organizationId/invitations | Create invitation |
| POST | /api/organizations/:organizationId/invitations/:invitationId/revoke | Revoke pending invitation |
| POST | /api/organizations/:organizationId/invitations/:invitationId/resend | Replace token/expiry and send or return delivery work |

Multiple owners are allowed; no command may remove, deactivate, or demote the
last active owner. Product-facing "remove member" behavior is a membership
deactivation, not deletion of membership or audit history.

### Dashboard

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/dashboard | Current applicability, gap, evidence, plan, report, and next-step summary |

Implement a dashboard query service assembled from authoritative current
pointers. Do not add a denormalized dashboard table until a measured query
problem justifies it. Return source timestamps and stale/outdated flags so the
UI never presents mixed snapshots as one atomic assessment.

### Betroffenheitscheck

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/applicability-check | Workflow overview/current state |
| GET | /api/organizations/:organizationId/applicability-check/questionnaire | Pinned localized questionnaire |
| GET | /api/organizations/:organizationId/applicability-check/answers | Current submitted answers |
| GET | /api/organizations/:organizationId/applicability-check/result | Current approved result and provenance |
| POST | /api/organizations/:organizationId/applicability-check/submissions | Submit deterministic answers idempotently |

Retain the existing guest endpoints for questionnaire/submission/result/claim.
Bring them onto the common envelope/error helpers where cookie semantics allow,
but do not add guest Gap-Analyse.

### Organization Evidence

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/documents | Paginated/filterable document library |
| GET | /api/organizations/:organizationId/documents/:documentId | Document detail and usage |
| PATCH | /api/organizations/:organizationId/documents/:documentId | Edit mutable title/metadata |
| POST | /api/organizations/:organizationId/documents/upload-sessions | Start first-version upload |
| POST | /api/organizations/:organizationId/documents/:documentId/version-upload-sessions | Start later-version upload |
| POST | /api/organizations/:organizationId/document-upload-sessions/:sessionId/complete | Verify upload/create immutable version/process |
| GET | /api/organizations/:organizationId/documents/:documentId/versions | Paginated immutable versions |
| GET | /api/organizations/:organizationId/document-versions/:versionId | Version/extraction/index status |
| POST | /api/organizations/:organizationId/document-versions/:versionId/source-access | Short-lived authorized original access |
| POST | /api/organizations/:organizationId/documents/:documentId/archive | Archive from future selection |
| POST | /api/organizations/:organizationId/documents/:documentId/restore | Restore when policy allows |

The existing multipart POST /documents and POST /versions routes are removed
only after direct-upload clients and completion endpoints are live.

### Gap-Analyse

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/gap-analysis | Complete workflow read model |
| POST | /api/organizations/:organizationId/gap-analysis/assessments | Start/open assessment |
| POST | /api/organizations/:organizationId/gap-analysis/questionnaire-submissions | Save immutable questionnaire revision |
| GET | /api/organizations/:organizationId/gap-analysis/reassessment | Read shared draft/job state |
| POST | /api/organizations/:organizationId/gap-analysis/reassessment | Prepare/open shared draft |
| PATCH | /api/organizations/:organizationId/gap-analysis/reassessment/evidence | Change evidence with If-Match |
| POST | /api/organizations/:organizationId/gap-analysis/reassessment/generate | Lock and enqueue generation |
| POST | /api/organizations/:organizationId/gap-analysis/reassessment/retry | Explicitly retry failed locked input |
| GET | /api/organizations/:organizationId/gap-analysis/revisions/:revisionId | Read candidate/reviewed/approved revision |
| POST | /api/organizations/:organizationId/gap-analysis/revisions/:revisionId/correct | Create corrected immutable revision |
| POST | /api/organizations/:organizationId/gap-analysis/revisions/:revisionId/approve | Approve complete revision |

Generation returns 202 with the locked draft, AI run, and common job. Generic
job cancellation applies according to authorization; cancellation never
restores a locked input to editable state without an explicit domain command.

### Maßnahmeplan

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/action-plan | Current plan/readiness state |
| POST | /api/organizations/:organizationId/action-plan | Create first plan idempotently |
| GET | /api/organizations/:organizationId/action-plans | Paginated plan history |
| GET | /api/organizations/:organizationId/action-plans/:planId | Plan revision/detail |
| PATCH | /api/organizations/:organizationId/action-plan/items/:itemId | Update operational fields with If-Match |
| GET | /api/organizations/:organizationId/action-plan/reconciliation | Read current reconciliation |
| POST | /api/organizations/:organizationId/action-plan/reconciliation | Prepare successor plan/reconciliation |
| PATCH | /api/organizations/:organizationId/action-plan/reconciliation/items/:itemId | Record decision with If-Match |
| POST | /api/organizations/:organizationId/action-plan/reconciliation/activate | Atomically activate reconciled plan |

Assignee IDs must resolve through active organization membership. Preserve
predecessor lineage and historical read-only plans.

### PDF reports

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/reports | Paginated report history/status |
| POST | /api/organizations/:organizationId/reports | Pin current inputs and enqueue PDF generation |
| GET | /api/organizations/:organizationId/reports/:reportId | Report metadata, snapshot, and job state |
| POST | /api/organizations/:organizationId/reports/:reportId/download | Authorized short-lived file access |

Add report_definitions only if multiple stable report kinds emerge. Initial
tables:

- reports: organization, kind, locale, state, immutable input snapshot/hash,
  job, creator, output object/hash/size, safe failure, and timestamps.
- report_sources: exact applicability/gap/plan/document/source revision IDs.

Report generation pins inputs at command time. It must not silently use newer
results that appear while the job runs. Cancellation uses the common job API.

### Jobs

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/jobs/:jobId | Authorized status/progress/result |
| POST | /api/jobs/:jobId/cancel | Request cancellation |

Authorization follows the job's domain scope. Platform operational diagnostics
use separate administrator endpoints rather than expanding the ordinary DTO.

### Organization audit

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/organizations/:organizationId/audit-events | Paginated/filterable append-only history |

Filters may include event type, entity type/ID, actor, and date interval. No
audit create/update/delete route exists.

### Platform and corpus administration

| Method | Path | Use case |
| --- | --- | --- |
| GET | /api/admin/platform-administrators | List administrator registry |
| POST | /api/admin/platform-administrators | Add administrator |
| POST | /api/admin/platform-administrators/:userId/deactivate | Deactivate administrator safely |
| GET/POST | /api/admin/corpus/families | List/create corpus families |
| GET/PATCH | /api/admin/corpus/families/:familyId | Read/update family |
| GET/POST | /api/admin/corpus/sources | Search/create source identity |
| GET/PATCH | /api/admin/corpus/sources/:sourceId | Read/update source metadata |
| POST | /api/admin/corpus/sources/:sourceId/withdraw | Withdraw from future use |
| POST | /api/admin/corpus/sources/:sourceId/upload-sessions | Start rendition upload |
| POST | /api/admin/corpus/sources/:sourceId/url-imports | Import exact URL asynchronously |
| POST | /api/admin/corpus/upload-sessions/:sessionId/complete | Finalize stored rendition/enqueue process |
| GET | /api/admin/corpus/source-versions/:versionId | Version/rendition/review state |
| GET | /api/admin/corpus/processing-generations/:generationId | Processing quality/status |
| POST | /api/admin/corpus/processing-generations/:generationId/retry | Explicit retry |
| POST | /api/admin/corpus/source-versions/:versionId/review | Record mandatory human review |
| GET | /api/admin/corpus/chunks/:chunkId | Inspect exact extracted anchor |
| POST | /api/admin/corpus/renditions/:renditionId/source-access | Controlled original access |
| GET/POST | /api/admin/corpus/releases | List/create draft family release |
| GET/PATCH | /api/admin/corpus/releases/:releaseId | Read/edit draft members with If-Match |
| POST | /api/admin/corpus/releases/:releaseId/publish | Validate/hash/publish |
| POST | /api/admin/corpus/releases/:releaseId/evaluate | Enqueue activation evaluations |
| POST | /api/admin/corpus/releases/:releaseId/activate | Activate after gate or audited override |
| POST | /api/admin/corpus/releases/:releaseId/withdraw | Withdraw from future authoring |
| GET/POST | /api/admin/corpus/monitors | List/create exact-URL monitor |
| PATCH | /api/admin/corpus/monitors/:monitorId | Update/pause monitor |
| GET | /api/admin/corpus/change-alerts | Paginated source-change alerts |
| POST | /api/admin/corpus/change-alerts/:alertId/resolve | Resolve/create candidate |
| GET | /api/admin/jobs | Operational job list and worker health context |
| GET | /api/admin/audit-events | Paginated platform audit history |

Do not expose direct browser publication endpoints for repository-authored
compliance/gap release definitions in this phase. Their existing reviewed
scripts/services remain the operator boundary and are extended to pin corpus
releases.

## Client service inventory

Create these browser-safe modules:

- organizations-client.ts
- invitations-client.ts
- members-client.ts
- dashboard-client.ts
- applicability-client.ts
- guest-applicability-client.ts
- documents-client.ts
- gap-analysis-client.ts
- action-plans-client.ts
- reports-client.ts
- jobs-client.ts
- audit-client.ts
- corpus-admin-client.ts
- platform-admin-client.ts

Each exports use-case methods, not endpoint-building primitives. For example,
documentsClient.completeUpload() may internally call the common client but
components never construct storage completion URLs or response envelopes.

React components retain presentation/loading/toast concerns. Polling should use
one shared cancellable utility with bounded exponential backoff, Retry-After
support, page-visibility awareness, and a final authoritative refresh.

## Server service inventory

Refactor toward these cohesive seams:

- organizations/read-service.ts and command-service.ts
- organizations/membership-service.ts and invitation-service.ts
- dashboard/service.ts
- applicability-check/read-service.ts and existing submission services
- documents/read-service.ts, command-service.ts, upload-service.ts,
  processing-service.ts, retrieval.ts, and usage.ts
- gap-analysis/workflow-reader.ts, assessment/questionnaire services,
  reassessment-service.ts, generation-enqueue-service.ts, worker handler,
  review-service.ts, and staleness.ts
- action-plans/read-service.ts, command-service.ts, reconciliation-service.ts
- reports/service.ts and worker handler
- audit/read-service.ts and append-service.ts
- corpus services defined by the grounded-AI plan

Avoid renaming or splitting working modules only for symmetry. Split when it
creates a clear authorization/transaction boundary or prevents server/client
coupling.

## Data-model changes owned by this plan

In addition to common job/upload/idempotency/platform tables shared with the
grounded-AI plan:

- organizations: lifecycle status, archived fields, and concurrency version;
- organization_memberships: concurrency version and lifecycle attribution;
- organization_invitations: delivery/revocation attribution and safe resend
  lineage if not already represented;
- reports and report_sources;
- optional rate_limit_counters or usage_ledger when the selected limiter needs
  durable cross-instance accounting.

Do not store dashboard cards as mutable business truth. Do not create separate
API DTO tables. DTOs are projections defined in contracts.

## Rate limits and quotas

Apply configurable limits at both request and domain layers:

- upload-session creation/completion by user and organization;
- maximum open sessions and stored byte quotas;
- one active Gap generation per locked draft and bounded active generation per
  organization;
- report creation/concurrency;
- invitation creation/resend;
- corpus URL imports, processing retries, and evaluations;
- polling rate per user/job.

Return 429 with Retry-After and a stable error code. Database uniqueness and
idempotency remain the final correctness boundary; a rate limiter is not a
workflow lock.

## Observability

Every route creates or accepts a safe request ID and emits structured timing and
outcome data. Correlate requestId, jobId, aiRunId, feature, operation, and
non-sensitive scope identifiers.

Metrics:

- request counts/latency/error code;
- idempotency replay/conflict;
- stale-write rejection;
- upload bytes/completion/failure;
- job queue age, run time, attempts, lease expiry, cancellation;
- AI tokens/cost/provider latency and citation-validation failures;
- retrieval result counts by channel, not excerpt content;
- report generation duration/size;
- rate-limit rejections.

Never log document/source text, prompts, signed URLs, invitation tokens,
credentials, raw provider responses, or sensitive organization fields.

## Implementation sequence

Use vertical slices. Do not convert every route to new infrastructure in one
unreviewable change.

### Phase 0: Contract baseline

1. Snapshot current route behavior with route tests.
2. Add shared common contracts and ApiClientError.
3. Add the route adapter, standardized envelopes/errors, and request IDs.
4. Add a contract test helper that invokes route handlers and validates both
   server output and client parsing.

### Phase 1: Cross-cutting safety

1. Add capability resolution and migrate existing role checks behind it.
2. Add opaque cursor, If-Match/ETag, idempotency, and rate-limit helpers.
3. Add common jobs, upload sessions, Platform Administrator registry, and
   platform audit primitives in coordination with the grounded-AI plan.
4. Verify server-only RLS/grants and no client-bundle imports.

### Phase 2: Organizations and team

1. Migrate organization/invitation routes and their four current client
   components to typed clients.
2. Add organization read/archive/restore and facts endpoints.
3. Add members, role/status, multiple-owner invariant, leave, revoke, and resend.
4. Add member picker support for action-plan assignees.

### Phase 3: Betroffenheitscheck

1. Add the missing authenticated read endpoints over existing services.
2. Migrate authenticated and guest questionnaire clients.
3. Preserve deterministic evaluation, guest cookie/claim lifecycle, release
   pinning, and historical result behavior.

### Phase 4: Documents and uploads

1. Introduce direct-storage upload sessions alongside existing multipart routes.
2. Migrate first-version and later-version clients to create/upload/complete.
3. Add detail/version/source-access/restore contracts and cursor pagination.
4. Remove multipart routes after tests and deployed clients no longer use them.

### Phase 5: Gap-Analyse jobs

1. Add complete workflow/revision read contracts.
2. Add durable generation enqueue and common job polling/cancellation.
3. Migrate gap-analysis-workflow.tsx from raw fetch.
4. Cut over the worker to the Grounding Gateway according to the first plan.

### Phase 6: Maßnahmeplan

1. Normalize current plan/item/reconciliation contracts and errors.
2. Add history/detail reads and concurrency tokens.
3. Migrate action-plan-workflow.tsx to the typed client.
4. Verify assignee membership, stale activation, and predecessor history.

### Phase 7: Dashboard, reports, and audit

1. Build the dashboard query service and endpoint from authoritative pointers.
2. Add report schema, input snapshot, worker renderer, private output storage,
   polling, download, and cancellation.
3. Add organization audit reads.
4. Replace the dashboard/PDF placeholders only after their backend contracts
   pass integration tests.

### Phase 8: Platform/corpus administration

1. Add the administrator and corpus contracts/routes/clients in the order
   defined by the grounded-AI implementation phases.
2. Add platform job diagnostics and audit reads.
3. Verify that no organization role grants platform access.

### Phase 9: Consolidation

1. Ensure no Client Component calls raw fetch.
2. Ensure no Server Component self-fetches.
3. Remove superseded request/error helpers and dead route contracts.
4. Update architecture/product/API docs and the route inventory.
5. Run full lint, test, build, database, worker, storage, and manual smoke gates.

## Per-slice completion gate

A slice is done only when it has:

- shared request/query/response/error schemas;
- a typed feature client when browser use exists;
- thin route tests for auth, parsing, envelope, status, and safe errors;
- server-service tests for capabilities and business rules;
- database integration tests for transaction/constraint behavior;
- idempotency replay and mismatch tests where required;
- If-Match missing/stale/success tests where required;
- pagination ordering/cursor-scope tests for collections;
- quota/rate-limit tests for expensive work;
- worker duplicate-delivery/retry/cancellation tests for jobs;
- audit-event and privacy-safe telemetry assertions;
- grounding/citation evaluations for AI consumers.

## Migration and rollout

- Schema evolution is additive before route removal.
- New response contracts and typed clients ship together per feature.
- Run old and new upload paths briefly only when necessary; write new immutable
  records once, never dual-write competing domain state.
- Job-backed generation is feature-flagged until both web and worker deployments
  support its states.
- Existing persisted IDs and immutable revisions remain valid.
- Internal contract breaks require a repository-wide caller search and route/
  client contract test in the same commit.
- Rollback restores the previous route/client pair or feature flag. It does not
  delete jobs, reports, audit events, uploads already finalized, or artifacts.

## Verification commands

Run at minimum:

    npm.cmd run lint
    npx.cmd vitest run tests evals
    npm.cmd run test:ai
    npm.cmd run build

Add targeted scripts for:

- worker unit/integration tests;
- route-contract inventory/validation;
- database migration and server-only grant verification;
- private upload/download smoke tests;
- report rendering smoke test;
- corpus publish/evaluate/activate smoke test.

Manual smoke paths:

1. Create organization; invite, accept, promote another owner, and prove the
   final owner cannot leave.
2. Complete guest and authenticated Betroffenheitscheck paths.
3. Direct-upload Organization Evidence, add a version, inspect processing,
   archive/restore, and retrieve a controlled original.
4. Prepare a reassessment, enqueue/cancel/retry generation, review/approve, and
   preserve the old accepted result while work runs.
5. Create/edit/reconcile/activate a plan with a member selected as owner.
6. Load dashboard, create/cancel/download a pinned PDF report, and inspect audit
   history.
7. As Platform Administrator, ingest/review/publish/evaluate/activate a legal
   corpus release and inspect its jobs/audit without organization access leaks.

## Acceptance criteria

- All Client Components use typed feature clients; raw fetch is absent there.
- All trusted server reads/writes call server services directly.
- Every JSON endpoint uses the common envelope and stable error codes.
- Every route validates untrusted params/query/body with the shared contract.
- Every service enforces a capability independent of UI visibility.
- Growing collections use stable bounded cursor pagination.
- Costly/create-once commands are idempotent and mismatched replays fail.
- Shared mutable resources reject missing/stale preconditions.
- Long-running work returns 202 and a durable authorized job.
- Job retries/cancellation cannot duplicate business artifacts or erase
  provenance.
- Direct uploads never expose service-role credentials or create database rows
  for unverified objects.
- Multiple owners are supported and the last active owner is protected.
- Archival blocks organization writes/new AI while preserving read/export
  history.
- Dashboard/report data pins or declares its exact source state.
- Organization and platform audit histories are read-only and correctly scoped.
- No route exposes stack traces, raw provider failures, tokens, signed URLs in
  logs, cross-tenant existence, or source excerpts through errors.
- Existing deterministic applicability and immutable gap/plan history remain
  green.

## Related documents

- ./authoritative-legal-corpus-and-grounded-ai.md
- ../architecture/organization-api-architecture.md
- ../architecture/database-structure.md
- ../database/supabase-security-runbook.md
- ../product/product-structure.md
- ../product/gap-analysis-current-workflow.md
- ../../CONTEXT.md
