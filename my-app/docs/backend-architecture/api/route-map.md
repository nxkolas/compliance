# API Route Map

> Status: current as of 3 September 2026.

All routes are under `app/api/`. JSON application routes return the standard envelope; health checks return a small bare health payload, and document download/source-access routes return redirects. `:id`
placeholders are entity UUIDs; `:organizationId` is the tenant scope.

## Organizations and tenancy

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/api/organizations` | List own organizations / create one |
| GET / PATCH | `/api/organizations/:organizationId` | Read / update organization |
| POST | `/api/organizations/:organizationId/archive` | Archive (never delete) |
| POST | `/api/organizations/:organizationId/restore` | Restore archived organization |
| GET / PATCH | `/api/organizations/:organizationId/settings` | Read / update settings |
| GET / PUT | `/api/organizations/:organizationId/model-settings` | Read / change AI model settings |
| GET | `/api/organizations/:organizationId/progress` | Organization progress read model |
| GET | `/api/organizations/:organizationId/dashboard` | Dashboard data |
| GET | `/api/organizations/:organizationId/audit-events` | Organization audit stream |

## Members and invitations

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/organizations/:organizationId/members` | List members |
| PATCH / DELETE | `/api/organizations/:organizationId/members/:userId` | Change role / remove member |
| POST | `/api/organizations/:organizationId/members/me/leave` | Leave organization |
| GET / POST | `/api/organizations/:organizationId/invitations` | List / create invitations |
| POST | `/api/organizations/:organizationId/invitations/:invitationId/resend` | Resend invitation |
| POST | `/api/organizations/:organizationId/invitations/:invitationId/revoke` | Revoke pending invitation |
| GET | `/api/organization-invitations` | Pending invitations for the current user |
| POST | `/api/organization-invitations/:invitationId/accept` | Accept invitation |

## Applicability check (Betroffenheitscheck)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/organizations/:organizationId/applicability-check` | Current applicability state |
| GET | `/api/organizations/:organizationId/applicability-check/questionnaire` | Versioned questionnaire |
| GET | `/api/organizations/:organizationId/applicability-check/answers` | Current answers |
| POST | `/api/organizations/:organizationId/applicability-check/submissions` | Submit and evaluate |
| GET | `/api/organizations/:organizationId/applicability-check/result` | Latest result revision |

Guest (public) flow:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/guest/applicability-check/submissions` | Submit guest check |
| POST | `/api/guest/applicability-check/claim` | Claim a guest result by token |
| GET / DELETE | `/api/guest/applicability-check/result` | Read / delete a guest result |

## Documents

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/organizations/:organizationId/documents` | List documents |
| POST | `/api/organizations/:organizationId/documents/upload-sessions` | Create a signed upload session |
| POST | `/api/organizations/:organizationId/document-upload-sessions/:sessionId/complete` | Verify and complete upload, enqueue indexing |
| GET | `/api/organizations/:organizationId/documents/:documentId` | Document detail and versions |
| GET | `/api/organizations/:organizationId/documents/:documentId/download` | Download current version |
| GET | `/api/organizations/:organizationId/documents/:documentId/source-access` | Access a controlled source rendition |
| POST | `/api/organizations/:organizationId/documents/:documentId/archive` | Archive document |
| POST | `/api/organizations/:organizationId/documents/:documentId/restore` | Restore document |
| POST | `/api/organizations/:organizationId/documents/:documentId/retry-indexing` | Retry failed indexing |

## Gap analysis

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/organizations/:organizationId/gap-analysis` | Gap state and eligibility |
| POST | `/api/organizations/:organizationId/gap-analysis/assessments` | Create gap assessment |
| POST | `/api/organizations/:organizationId/gap-analysis/cycles` | Prepare a cycle (idempotent, 201) |
| GET | `/api/organizations/:organizationId/gap-analysis/cycles/:cycleId` | Read cycle state |
| PUT | `/api/organizations/:organizationId/gap-analysis/cycles/:cycleId/evidence` | Select evidence documents |
| POST | `/api/organizations/:organizationId/gap-analysis/cycles/:cycleId/generation-jobs` | Enqueue generation job (202) |
| PATCH | `/api/organizations/:organizationId/gap-analysis/questionnaire-draft/answers/:questionKey` | Autosave a draft answer |
| POST | `/api/organizations/:organizationId/gap-analysis/questionnaire-submissions` | Finalize questionnaire |
| GET | `/api/organizations/:organizationId/gap-analysis/progress` | Cycle progress |
| GET | `/api/organizations/:organizationId/gap-analysis/history` | Revision history |
| GET | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId` | Read a Gap revision |
| GET | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId/inputs` | Pinned inputs of a revision |
| POST | `/api/organizations/:organizationId/gap-analysis/revisions/:revisionId/contradictions/:findingId/resolve` | Enqueue contradiction resolution (202) |

## Action plan

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/api/organizations/:organizationId/action-plan` | Read plan / start generation (202) |
| GET | `/api/organizations/:organizationId/action-plan/progress` | Generation progress |
| PATCH | `/api/organizations/:organizationId/action-plan/items/:itemId` | Status-only item update |

## Reports

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/api/organizations/:organizationId/reports` | List / create report (202) |
| GET | `/api/organizations/:organizationId/reports/:reportId` | Report detail and render job state |
| POST | `/api/organizations/:organizationId/reports/:reportId/download` | Authorized PDF download |

## Jobs

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/jobs/:jobId` | Poll a job's state and progress |
| POST | `/api/jobs/:jobId/cancel` | Request cancellation |

## Client inference (local AI relay)

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/organizations/:organizationId/client-inference/claim` | Claim a pending inference request |
| POST | `/api/organizations/:organizationId/client-inference/:requestId/heartbeat` | Extend a claim lease |
| POST | `/api/organizations/:organizationId/client-inference/:requestId/result` | Submit the local model's response |
| POST | `/api/organizations/:organizationId/client-inference/:requestId/failure` | Report a local failure |

## Health and internal

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health/live` | Process liveness |
| GET | `/api/health/ready` | Database readiness |
| GET / POST | `/api/internal/jobs/drain` | Authenticated scheduled job drain (cron secret) |

## Notes

- There are no platform-administrator web routes: legal corpus processing and
  snapshot activation are operator/job-runtime operations.
- The `202`-returning routes are Gap generation, contradiction resolution,
  Action Plan generation, report creation, and local-inference result/failure
  acknowledgement.
- Route behavior details and DTOs live in `src/contracts/` per domain; the
  shared envelope is documented in [Conventions](./conventions.md).
