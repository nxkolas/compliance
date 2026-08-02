# API route inventory

Status: current as of 2 August 2026. Routes return the common JSON envelope.

- Jobs: `/api/jobs/:jobId` and `/api/jobs/:jobId/cancel`.
- Organizations: collection/detail, archive/restore, settings, active members,
  pending invitations, mailbox acceptance, and self-leave routes below
  `/api/organizations`.
- Applicability: questionnaire, immutable submission/result/history, and
  browser-submitted guest result/claim routes.
- Documents: collection/detail, direct upload completion, immutable versions,
  archive/restore, indexing retry, and controlled source access.
- Gap Analysis: assessment creation, questionnaire answer autosave/finalize,
  cycle preparation/evidence selection, generation/retry jobs, current and
  historical revision/inputs reads, and
  `/revisions/:revisionId/contradictions/:findingId/resolve` for exactly the
  questionnaire/document decision.
- Action Plan: exactly-once generation/read and status-only item updates.
- Reports: create/list/detail, render job polling, and authorized PDF download.
- Dashboard/progress and organization audit-event reads.

There are no platform-administrator or customer corpus-administration routes.
Legal corpus processing and atomic snapshot activation are deployment-authorized
operator/worker operations.
