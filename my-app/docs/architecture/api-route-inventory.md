# API Route Inventory

Status: 24 July 2026. Every route below returns the common JSON envelope.

## Shared and organization routes

- `/api/jobs/:jobId` and `/api/jobs/:jobId/cancel`
- `/api/organizations`, `/api/organizations/:organizationId`, archive/restore,
  facts, members, invitations, and invitation inbox/acceptance
- `/api/organizations/:organizationId/dashboard`
- `/api/organizations/:organizationId/applicability-check` with questionnaire,
  answers, result, and submissions; guest submission/result/claim routes
- `/api/organizations/:organizationId/documents` with detail, direct upload
  sessions, immutable versions, archive/restore, and source access
- `/api/organizations/:organizationId/gap-analysis` with assessment,
  questionnaire, shared reassessment, async generation/retry, revision review,
  correction, and approval
- `/api/organizations/:organizationId/action-plan` with plan detail and item
  updates
- `/api/organizations/:organizationId/reports` with detail and controlled
  download
- `/api/organizations/:organizationId/audit-events`

## Platform routes

- `/api/admin/platform-administrators` and deactivation
- `/api/admin/corpus/families`, sources, upload sessions, URL imports, source
  versions, processing generations, review, chunks, and rendition access
- `/api/admin/corpus/releases` with member editing, publish, evaluate, activate,
  and withdraw
- `/api/admin/corpus/monitors` and change-alert resolution
- `/api/admin/jobs` and `/api/admin/audit-events`

Repository-authored compliance and Gap release definitions intentionally retain
their reviewed CLI publication boundary.
