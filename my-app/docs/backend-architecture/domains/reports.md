# PDF Reports

> Status: current as of 7 August 2026.

## Purpose

A report bundles the organization's compliance state into a downloadable PDF:
the applicability revision, the current Gap revision, the optional Action
Plan, and the selected document versions.

## Lifecycle

1. A member with `reports:create` calls
   `POST /api/organizations/:id/reports`. The server verifies inputs exist
   (applicability and Gap completed), pins the current applicability
   revision, current Gap revision, optional Action Plan, and the gap
   revision's selected document versions, then enqueues a `report_render`
   job and returns `202`.
2. The worker builds an **exact in-memory render snapshot** — including
   current Action Plan item statuses and legal references — and hashes it
   (`src/server/reports/render-snapshot.ts`).
3. The same snapshot object is rendered with `@react-pdf/renderer`
   (`src/server/reports/renderer.tsx`).
4. The PDF is uploaded to the `compliance-reports` bucket under a
   deterministic key derived from the report inputs.
5. One fenced transaction commits the PDF hash, byte size, bucket/key, and
   metadata, while verifying the job's live lease.

Completed reports are **immutable**: the pinned revisions, the render
snapshot hash, and the PDF hash cannot change. The report is the audit trail
of exactly what was shown at render time.

## Download

Downloads are authorized server-side reads
(`POST /api/organizations/:id/reports/:reportId/download`) that stream the
PDF from Storage. Report creation is rate-limited and concurrency-bounded
(at most three active renders per organization,
`src/server/reports/quota.ts`).

## Practical navigation

- Service: `src/server/reports/service.ts`.
- Render job: `src/server/reports/job-handler.ts`.
- Snapshot hashing: `src/server/reports/render-snapshot.ts`.
- Renderer and theme: `src/server/reports/renderer.tsx`, `theme.ts`.
- Legal references: `src/server/reports/legal-references.ts`.
