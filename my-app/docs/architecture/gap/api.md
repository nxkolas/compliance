# Gap Analysis HTTP API

Status: implemented API, verified against repository sources on 29 July 2026.

This document describes the current internal JSON API for the Gap Analysis
workflow. It documents implemented route behavior, not a proposed public API.
All paths are relative to the application origin.

The direct surface contains 13 method/path combinations under
`/api/organizations/:organizationId/gap-analysis`. Gap release publication and
activation are intentionally not exposed through this HTTP surface; they remain
server-side publication operations implemented by
[release publication](../../../src/server/gap-analysis/publishing/publish-release.ts)
and
[release activation](../../../src/server/gap-analysis/publishing/activate-release.ts).

## Lifecycle

The normal request order is:

1. Read the workflow model.
2. Create or reopen the assessment and its questionnaire draft.
3. Save questionnaire answers, then submit an immutable questionnaire revision.
4. Prepare the shared analysis-input draft and select indexed evidence.
5. Optionally update the evidence selection.
6. Enqueue Gap generation and poll the returned background job.
7. Read the generated revision and, when necessary, correct one finding or
   regenerate one finding's guidance.
8. Enqueue Action Plan generation to finalize the current Gap revision. A
   successful Action Plan job approves that revision, marks it accepted, and
   creates the active Action Plan in one persistence transaction.

Generation locks the analysis-input draft and the submitted questionnaire
inputs. A failed or cancelled draft can be retried. Direct approval is disabled;
finalization is deliberately coupled to successful Action Plan generation.
The `reassessment` path and model name are legacy infrastructure names: this
draft also drives the first Gap generation. Once a current Gap revision exists,
the input lifecycle rejects another preparation or generation with
`GAP_ALREADY_GENERATED`; the current implementation does not expose a second
Gap-analysis/update cycle.

Sources:
[Gap workflow projection](../../../src/server/gap-analysis/workflow-reader.ts),
[reassessment generation](../../../src/server/gap-analysis/reassessment-service.ts),
[Action Plan finalization](../../../src/server/action-plans/generation-service.ts),
and [lifecycle guards](../../../src/server/gap-analysis/lifecycle-guards.ts).

## Common protocol

### Authentication and authorization

Every route requires a non-anonymous authenticated API user. Organization-scoped
services then authorize an active organization membership and a capability.
Missing membership is returned as `404 ORGANIZATION_NOT_FOUND`; insufficient
capability is returned as `403 CAPABILITY_REQUIRED`.

The current effective access is:

| Operation class | Current service capability | Roles |
| --- | --- | --- |
| Read the Gap workflow or a Gap revision | `gap:read` | owner, admin, member, auditor |
| Read a reassessment draft | `organizations:read` | owner, admin, member, auditor |
| Create/edit/submit inputs; generate or retry | `plans:contribute` | owner, admin, member |
| Correct a finding or regenerate its guidance | `plans:manage` | owner, admin |
| Enqueue Action Plan generation | `plans:manage` | owner, admin |
| Poll an organization job | `organizations:read` | owner, admin, member, auditor |
| Cancel a Gap generation job | job policy: `gap:contribute` | owner, admin, member |
| Cancel an Action Plan generation job | job policy: `plans:activate` | owner, admin |

The workflow response's `canContribute` and `canManage` flags are projected from
`gap:contribute` and `gap:approve`, respectively. Those flags currently select
the same role groups as the service checks above, although the capability names
differ. The disabled direct-approval route authenticates the caller but does not
perform an organization capability check before returning its fixed `409`.

Sources:
[API authentication](../../../src/server/api/auth.ts),
[capability enforcement](../../../src/server/auth/capability-service.ts),
[role capability map](../../../src/server/auth/capabilities.ts),
[workflow permissions](../../../src/server/gap-analysis/page-reader.ts), and
[organization workflow assertions](../../../src/server/organizations/service.ts).

### Envelopes and request IDs

Successful JSON responses use:

```json
{
  "data": {},
  "meta": {
    "requestId": "request-id",
    "version": 2
  }
}
```

`meta.requestId` is always present. `meta.version` is present only for
versioned responses documented below. Every response also sets `x-request-id`.

Errors use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe client-facing message",
    "details": {},
    "requestId": "request-id"
  }
}
```

`details` is optional. Unexpected errors are normalized to
`500 INTERNAL_ERROR` without returning the original exception.

Sources:
[API handler](../../../src/server/api/handler.ts),
[response helpers](../../../src/server/api/response.ts), and
[envelope contracts](../../../src/contracts/common/envelopes.ts).

### IDs, JSON validation, concurrency, and idempotency

- Route parameters whose names end in `Id` must be valid UUIDs. Invalid values
  return `400 INVALID_ROUTE_PARAMETER`.
- JSON request bodies are parsed with the route's Zod contract. Invalid JSON or
  invalid fields return `400`.
- `PATCH` requests for questionnaire answers and reassessment evidence require
  `If-Match`. The header accepts a decimal version with optional quotes and an
  optional weak ETag prefix, for example `"4"` or `W/"4"`.
- For those two `PATCH` routes, the header version must equal
  `expectedVersion` or `expectedLockVersion` in the body. A disagreement
  returns `400 PRECONDITION_MISMATCH`. A stale version returns the
  route-specific conflict described below.
- `Idempotency-Key` is required for assessment creation, questionnaire
  submission, reassessment preparation, generation, retry, correction,
  guidance regeneration, and Action Plan generation. It must contain 1-255
  printable ASCII characters with no spaces.
- Repeating the same operation, actor, scope, key, and input replays the stored
  result and returns `reused: true`. Reusing a key with different input returns
  `409 IDEMPOTENCY_KEY_REUSED`; an unfinished matching request returns
  `409 IDEMPOTENCY_IN_PROGRESS`.

Sources:
[request parsing](../../../src/server/api/request.ts),
[concurrency helpers](../../../src/server/api/concurrency.ts),
[idempotency implementation](../../../src/server/api/idempotency.ts), and
[Gap request schemas](../../../src/contracts/gap-analysis/generation.ts).

## Endpoint inventory

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/organizations/:organizationId/gap-analysis` | `200` | Read the complete browser-safe workflow model. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/assessments` | `201` | Create or reopen the active assessment and questionnaire draft. |
| `PATCH` | `/api/organizations/:organizationId/gap-analysis/questionnaire-draft/answers/:questionId` | `200` | Create or replace one draft answer. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/questionnaire-submissions` | `201` | Submit an immutable questionnaire revision and deterministic evaluations. |
| `GET` | `/api/organizations/:organizationId/gap-analysis/reassessment?assessmentId=:assessmentId` | `200` | Read the latest shared analysis-input draft for an assessment. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/reassessment` | `201` | Create or reopen the shared input draft and select evidence. |
| `PATCH` | `/api/organizations/:organizationId/gap-analysis/reassessment/evidence` | `200` | Replace the evidence selection on an open input draft. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/reassessment/generate` | `202` | Lock inputs and enqueue Gap generation. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/reassessment/retry` | `202` | Retry a failed or cancelled generation draft. |
| `GET` | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId` | `200` | Read one localized immutable revision and its findings. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId/correct` | `201` | Correct exactly one finding and create a new revision. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId/regenerate-guidance` | `201` | Regenerate one finding's guidance and create a new revision. |
| `POST` | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId/approve` | none | Always returns `409 GAP_FINALIZATION_REQUIRED`. |

## Workflow read

### `GET /api/organizations/:organizationId/gap-analysis`

Returns `200` with:

```ts
{
  data: {
    workflow: {
      role: "owner" | "admin" | "member" | "auditor";
      canContribute: boolean;
      canManage: boolean;
      release: null | {
        id: UUID;
        versionLabel: string;
        questions: Question[];
        requirements: Array<{
          id: UUID;
          position: number;
          title: LocalizedText;
          questionStableKeys: string[];
        }>;
      };
      assessment: null | {
        id: UUID;
        currentRevisionId: UUID | null;
      };
      answers: Record<UUID, UUID>;
      questionnaireDraft: null | {
        id: UUID;
        version: number;
        status: "open";
        answers: Record<UUID, UUID>;
        updatedAt: ISODateTime;
      };
      documentLibrary: DocumentLibrary;
      run: null | { errorCode: string | null };
      revision: RevisionIdentity | null;
      acceptedRevision: RevisionIdentity | null;
      candidateRevision: RevisionIdentity | null;
      activePlan: null | { sourceGapArtifactRevisionId: UUID };
      reassessment: ReassessmentWorkflowProjection | null;
      prerequisite: ApplicabilityPrerequisite;
      history: WorkflowHistoryItem[];
      generatedInputs: GeneratedInputs | null;
      reviewBlockers: ReviewBlocker[];
      planUpdateAvailable: boolean;
      acceptedStaleness: Staleness | null;
      candidateStaleness: Staleness | null;
      staleness: Staleness | null;
      lifecycleMode: string;
      lifecycle: LifecycleCapabilities;
      answerSummary: AnswerSummary[];
      selectedDocuments: Document[];
      findings: CustomerFinding[];
      gapCounts: StatusCounts;
      comparison: FindingComparison[];
      lastWorkflowChange: WorkflowHistoryItem | null;
    };
  };
  meta: { requestId: string };
}
```

The projection intentionally exposes document IDs, not internal document
version IDs. Findings include their customer-facing status, severity, review
notice, ordered atomic gaps, localized requirement identity, evidence-source
links, and manual-change/questionnaire-disagreement indicators. The
prerequisite reports whether the pinned applicability result is eligible and,
when not, why the workflow is blocked.

Source: [workflow route](<../../../app/api/organizations/[organizationId]/gap-analysis/route.ts>)
and [workflow projection](../../../src/server/gap-analysis/workflow-reader.ts).

## Assessment and questionnaire

### `POST /api/organizations/:organizationId/gap-analysis/assessments`

Headers: `Idempotency-Key` is required. There is no request body.

Returns `201`:

```ts
{
  data: {
    assessment: Assessment;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The command requires an active published Gap release and a current approved,
eligible applicability artifact compatible with that release. It reuses an
active assessment already pinned to the active release; otherwise it archives
the previous active assessment for the module, creates a new assessment, and
opens a questionnaire draft. Typical prerequisite failures are `503` when the
active release/questionnaire is unavailable and `409` or `400` applicability
eligibility errors.

Source:
[assessment route](<../../../app/api/organizations/[organizationId]/gap-analysis/assessments/route.ts>)
and [assessment service](../../../src/server/gap-analysis/assessment-service.ts).

### `PATCH /api/organizations/:organizationId/gap-analysis/questionnaire-draft/answers/:questionId`

Headers: `If-Match` is required.

Body:

```ts
{
  draftId: UUID;
  optionId: UUID;
  expectedVersion: PositiveInteger;
}
```

Returns `200`:

```ts
{
  data: {
    answer: {
      draftId: UUID;
      version: PositiveInteger;
      questionId: UUID;
      optionId: UUID;
      updatedAt: ISODateTime;
    };
  };
  meta: {
    requestId: string;
    version: PositiveInteger;
  };
}
```

The option must belong to the route question and the question must belong to
the draft's pinned questionnaire version. The operation creates or replaces
that answer and increments the shared draft version. A stale draft returns
`412 GAP_QUESTIONNAIRE_DRAFT_CHANGED`; a locked draft returns
`409 GAP_INPUTS_LOCKED`.

Source:
[answer route](<../../../app/api/organizations/[organizationId]/gap-analysis/questionnaire-draft/answers/[questionId]/route.ts>)
and [questionnaire draft service](../../../src/server/gap-analysis/questionnaire-draft-service.ts).

### `POST /api/organizations/:organizationId/gap-analysis/questionnaire-submissions`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  assessmentId: UUID;
  draftId: UUID;
  expectedVersion: PositiveInteger;
}
```

Returns `201`:

```ts
{
  data: {
    revision: AssessmentRevision;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The command verifies the draft is open and at `expectedVersion`, verifies every
required question is answered exactly once with a valid option, creates an
immutable submitted assessment revision, supersedes the previous revision, and
stores deterministic requirement evaluations. The body version is the
optimistic-concurrency token for this endpoint; it does not use `If-Match`.
A changed draft returns `412 GAP_QUESTIONNAIRE_DRAFT_CHANGED`.

Source:
[submission route](<../../../app/api/organizations/[organizationId]/gap-analysis/questionnaire-submissions/route.ts>)
and [questionnaire service](../../../src/server/gap-analysis/questionnaire-service.ts).

## Shared analysis inputs and generation

### `GET /api/organizations/:organizationId/gap-analysis/reassessment`

Required query parameter:

```text
assessmentId=<UUID>
```

Returns `200` with `{ data: { reassessment }, meta }`, where `reassessment` is
`null` or:

```ts
{
  draft: ReassessmentDraft;
  selected: Array<{
    documentId: UUID;
    documentVersionId: UUID;
    selectionOrigin:
      | "approved_carryover"
      | "version_replacement"
      | "explicit_addition";
  }>;
  summary: {
    baseAcceptedGapRevisionId: UUID | null;
    baseAcceptedGapRevisionNumber: number | null;
    assessmentRevisionId: UUID;
    assessmentRevisionNumber: number | null;
    gapAnalysisReleaseId: UUID;
    gapAnalysisReleaseVersion: string | null;
    requirementCount: number;
    carried: UUID[];
    replaced: UUID[];
    added: UUID[];
    removed: UUID[];
    selectedDocumentVersionIds: UUID[];
  };
}
```

Unlike the top-level browser workflow projection, this focused response
contains the pinned document-version IDs needed to explain evidence carryover.

Source:
[reassessment route](<../../../app/api/organizations/[organizationId]/gap-analysis/reassessment/route.ts>)
and [reassessment reader](../../../src/server/gap-analysis/reassessment-service.ts).

### `POST /api/organizations/:organizationId/gap-analysis/reassessment`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  assessmentId: UUID;
  selectedDocumentIds: UUID[];
}
```

Returns `201`:

```ts
{
  data: {
    reassessment: ReassessmentSnapshot;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The operation creates the shared open input draft or reuses the existing one.
Evidence from an accepted revision is carried forward, replaced with a current
version when necessary, or removed; the explicit document IDs are added to
that selection. Every selected document must have a current indexed version.
Unavailable evidence returns `409 GAP_DOCUMENT_NOT_READY`. A concurrent draft
creation or edit returns `409 GAP_DRAFT_CHANGED`.

Source:
[reassessment route](<../../../app/api/organizations/[organizationId]/gap-analysis/reassessment/route.ts>)
and [reassessment preparation](../../../src/server/gap-analysis/reassessment-service.ts).

### `PATCH /api/organizations/:organizationId/gap-analysis/reassessment/evidence`

Headers: `If-Match` is required.

Body:

```ts
{
  draftId: UUID;
  expectedLockVersion: PositiveInteger;
  selectedDocumentIds: UUID[];
}
```

Returns `200`:

```ts
{
  data: {
    draft: ReassessmentDraft;
  };
  meta: {
    requestId: string;
    version: PositiveInteger;
  };
}
```

Only an open draft can be edited. The operation resolves document IDs to
current indexed versions, atomically replaces the selection, and increments
`lockVersion`. A non-open draft returns `409 GAP_DRAFT_NOT_OPEN`; unavailable
evidence returns `409 GAP_DOCUMENT_NOT_READY`; a stale lock version returns
`409 GAP_DRAFT_CHANGED`.

Source:
[evidence route](<../../../app/api/organizations/[organizationId]/gap-analysis/reassessment/evidence/route.ts>)
and [evidence update service](../../../src/server/gap-analysis/reassessment-service.ts).

### `POST /api/organizations/:organizationId/gap-analysis/reassessment/generate`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  draftId: UUID;
  expectedLockVersion: PositiveInteger;
}
```

Returns `202`:

```ts
{
  data: {
    draft: {
      id: UUID;
      status: "locked" | "generated" | "failed" | "cancelled";
      outputLocale: "de" | "en";
      lockVersion: PositiveInteger;
      generationJobId: UUID;
      aiProcessingRunId: UUID | null;
      outputGapRevisionId: UUID | null;
    };
    job: Job;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The command revalidates the pinned Gap release and applicability prerequisite,
pins the current application locale (`de` or `en`) as the output locale, locks
the open draft at `expectedLockVersion`, locks the matching questionnaire
draft, and enqueues a cancellable background job. A changed or non-open draft
returns `409`. Generation is limited to five requests per user and organization
per five-minute window; excess requests return `429 RATE_LIMITED` with
`Retry-After`.

Source:
[generate route](<../../../app/api/organizations/[organizationId]/gap-analysis/reassessment/generate/route.ts>),
[generation enqueue service](../../../src/server/gap-analysis/reassessment-service.ts), and
[rate-limit policy](../../../src/server/api/operation-rate-limit.ts).

### `POST /api/organizations/:organizationId/gap-analysis/reassessment/retry`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  draftId: UUID;
  retryNonce: string; // trimmed, 1-100 characters
}
```

Returns the same `202` response shape as generation. Retry is accepted only
when the draft status is `failed` or `cancelled`. It retains the locale pinned
by the original generation request and uses `retryNonce` as part of the
idempotency fingerprint. It shares the generation rate limit.

Source:
[retry route](<../../../app/api/organizations/[organizationId]/gap-analysis/reassessment/retry/route.ts>)
and [retry implementation](../../../src/server/gap-analysis/reassessment-service.ts).

## Revision read and review

### `GET /api/organizations/:organizationId/gap-analysis/revisions/:revisionId`

Returns `200`:

```ts
{
  data: {
    revision: {
      id: UUID;
      outputLocale: "de" | "en" | null;
    };
    findings: CustomerFinding[];
    staleness: Staleness | null;
  };
  meta: { requestId: string };
}
```

The revision must be a Gap Analysis artifact revision belonging to the
organization. Findings are localized from the revision's pinned release and
projected to customer-safe data with evidence-source links. Missing revisions
return `404 GAP_REVISION_NOT_FOUND`.

Source:
[revision route](<../../../app/api/organizations/[organizationId]/gap-analysis/revisions/[revisionId]/route.ts>)
and [revision reader](../../../src/server/gap-analysis/workflow-reader.ts).

### `POST /api/organizations/:organizationId/gap-analysis/revisions/:revisionId/correct`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  corrections: [
    {
      findingId: UUID;
      status?:
        | "fulfilled"
        | "partially_fulfilled"
        | "not_fulfilled"
        | "insufficient_evidence";
      evidenceSufficiency?: "sufficient" | "partial" | "none";
      requiresReview?: boolean;
      reason: NonEmptyString;
      resolutionReason?: NonEmptyString;
    }
  ]; // exactly one entry
}
```

Returns `201`:

```ts
{
  data: {
    revision: GeneratedArtifactRevision;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The command corrects exactly one finding, regenerates that finding's atomic
guidance, and creates a new immutable current revision. Supplying any number of
corrections other than one is rejected. Review changes are blocked while an
Action Plan generation job reserves the revision
(`409 GAP_RESERVED_BY_ACTION_PLAN_GENERATION`) and after an active Action Plan
exists (`409 GAP_LOCKED_BY_ACTION_PLAN`).

Source:
[correction route](<../../../app/api/organizations/[organizationId]/gap-analysis/revisions/[revisionId]/correct/route.ts>)
and [review service](../../../src/server/gap-analysis/review-service.ts).

### `POST /api/organizations/:organizationId/gap-analysis/revisions/:revisionId/regenerate-guidance`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  findingId: UUID;
  reason: NonEmptyString;
  retryNonce?: string; // trimmed, 1-100 characters
}
```

Returns the same `201` response shape as correction. The command regenerates
one finding's atomic guidance without directly requesting a status,
evidence-sufficiency, or review-state change, and creates a new immutable
current revision. The same Action Plan reservation and lock guards apply.

Source:
[guidance route](<../../../app/api/organizations/[organizationId]/gap-analysis/revisions/[revisionId]/regenerate-guidance/route.ts>)
and [review service](../../../src/server/gap-analysis/review-service.ts).

### `POST /api/organizations/:organizationId/gap-analysis/revisions/:revisionId/approve`

This endpoint has no success response. For every authenticated request with
valid route UUIDs, it returns:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "GAP_FINALIZATION_REQUIRED",
    "message": "Generate the action plan to finalize the Gap Analysis",
    "requestId": "request-id"
  }
}
```

Clients must use Action Plan generation below. No request body,
`Idempotency-Key`, or `If-Match` header is consumed by this disabled route.

Source:
[disabled approval route](<../../../app/api/organizations/[organizationId]/gap-analysis/revisions/[revisionId]/approve/route.ts>).

## Related lifecycle endpoints

These routes are outside the `/gap-analysis` namespace but complete or operate
the Gap lifecycle.

### `POST /api/organizations/:organizationId/action-plan`

Headers: `Idempotency-Key` is required.

Body:

```ts
{
  gapRevisionId: UUID;
}
```

Returns `202`:

```ts
{
  data: {
    job: Job;
    reused: boolean;
  };
  meta: { requestId: string };
}
```

The source must be the organization's current, finalizable Gap revision. Only
one Action Plan and one active Action Plan generation job are allowed for an
organization. On successful worker persistence, the operation atomically:

- verifies the Gap revision is still current and its pinned Gap release is
  still active;
- marks the Gap revision `approved`;
- sets it as the artifact's accepted revision;
- creates and activates the Action Plan and its items; and
- completes the background job.

Failure or cancellation does not partially approve the Gap revision or create
an active plan.

Source:
[Action Plan route](<../../../app/api/organizations/[organizationId]/action-plan/route.ts>),
[Action Plan request contract](../../../src/contracts/action-plans/index.ts),
and [Action Plan generation service](../../../src/server/action-plans/generation-service.ts).

### `GET /api/organizations/:organizationId/action-plan`

Returns `200` with `{ data: { current }, meta }`. `current` is `null` or the
active plan, grouped items, and source-Gap staleness. When a plan exists the
response also includes `meta.version` and an `ETag` header for the plan version.

Source:
[Action Plan route](<../../../app/api/organizations/[organizationId]/action-plan/route.ts>)
and [Action Plan reader](../../../src/server/action-plans/service.ts).

### `GET /api/jobs/:jobId`

Returns `200` with `{ data: { job }, meta }`. Polling is limited to 120 requests
per user per minute.

### `POST /api/jobs/:jobId/cancel`

Returns `200` with `{ data: { job }, meta }`. Cancellation is authorized by the
capability stored on the job, and is accepted only while the job remains
cancellable. A queued job transitions directly to `cancelled`; a running job
transitions to `cancellation_requested`. A terminal or otherwise
non-cancellable job returns `409 JOB_NOT_CANCELLABLE`.

Both job endpoints use this DTO:

```ts
type Job = {
  id: UUID;
  kind: string;
  state:
    | "queued"
    | "running"
    | "cancellation_requested"
    | "succeeded"
    | "failed"
    | "cancelled";
  progress: IntegerFrom0To100;
  attemptCount: NonNegativeInteger;
  safeError: null | {
    code: string;
    message: string;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  startedAt: ISODateTime | null;
  finishedAt: ISODateTime | null;
  cancellable: boolean;
  resultLink: string | null;
  result?: null | {
    actionPlanId: UUID;
  };
};
```

The Action Plan result is attached only to a succeeded job. Gap generation
completion is discovered through the workflow/reassessment response's
`outputGapRevisionId`, not a job `result` object.

Sources:
[job polling route](<../../../app/api/jobs/[jobId]/route.ts>),
[job cancellation route](<../../../app/api/jobs/[jobId]/cancel/route.ts>),
[job service](../../../src/server/jobs/service.ts), and
[job contract](../../../src/contracts/common/jobs.ts).

## Notable state and error behavior

The API uses status codes and stable error codes to distinguish client action:

| Status/code | Meaning |
| --- | --- |
| `400 INVALID_REQUEST` | Invalid JSON, query, or body contract. |
| `400 INVALID_ROUTE_PARAMETER` | A route `*Id` parameter is not a UUID. |
| `400 IDEMPOTENCY_KEY_REQUIRED` | A required `Idempotency-Key` is missing. |
| `401 AUTHENTICATION_REQUIRED` | There is no authenticated non-anonymous user. |
| `403 CAPABILITY_REQUIRED` | The active member lacks the service capability. |
| `404 ORGANIZATION_NOT_FOUND` | The caller has no active membership in the organization. |
| `409 ORGANIZATION_ARCHIVED` | A mutating capability is blocked because the organization is archived. |
| `428 IF_MATCH_REQUIRED` | A versioned `PATCH` omitted `If-Match`. |
| `400 INVALID_IF_MATCH` | `If-Match` is not a valid non-negative integer version. |
| `400 PRECONDITION_MISMATCH` | `If-Match` and the body version disagree. |
| `412 GAP_QUESTIONNAIRE_DRAFT_CHANGED` | A questionnaire draft version is stale. |
| `409 GAP_DRAFT_CHANGED` | Shared reassessment inputs changed concurrently. |
| `409 GAP_DOCUMENT_NOT_READY` | Selected evidence lacks a current indexed version. |
| `409 GAP_INPUTS_LOCKED` | Generation has locked mutable Gap inputs. |
| `409 GAP_ALREADY_GENERATED` | The assessment already has a generated current Gap revision. |
| `409 GAP_RESERVED_BY_ACTION_PLAN_GENERATION` | Action Plan generation has reserved finding review. |
| `409 GAP_LOCKED_BY_ACTION_PLAN` | An active Action Plan makes Gap findings immutable. |
| `409 GAP_FINALIZATION_REQUIRED` | Direct approval was attempted instead of Action Plan generation. |
| `409 IDEMPOTENCY_KEY_REUSED` | A key was reused with different input. |
| `409 IDEMPOTENCY_IN_PROGRESS` | The matching idempotent command has not completed. |
| `429 RATE_LIMITED` | Generation/retry or job polling exceeded its operation limit. |

Service methods can return additional, more specific release, applicability,
review, generation, and job errors. Callers should branch on `error.code` and
treat `message` as safe display text.

Sources:
[API errors](../../../src/server/api/errors.ts),
[capability service](../../../src/server/auth/capability-service.ts),
[lifecycle guards](../../../src/server/gap-analysis/lifecycle-guards.ts),
and [rate limiting](../../../src/server/api/rate-limit.ts).
