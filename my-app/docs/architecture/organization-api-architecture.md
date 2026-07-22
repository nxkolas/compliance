# Internal API Architecture

Status: implemented baseline, 22 July 2026.

All internal JSON routes use the shared success/error envelopes in
`src/contracts/common/envelopes.ts`. Routes authenticate, validate untrusted
input with shared Zod contracts, and call a server service; authorization and
business invariants never live only in UI code.

Browser code uses feature clients under `src/client`. Client Components do not
call `fetch` directly, and Server Components call services rather than their
own HTTP endpoints.

## Safety contracts

- Mutating shared resources require `If-Match` and return version metadata.
- Create-once or costly operations require `Idempotency-Key`.
- Long work returns `202` with a durable common job DTO; `/api/jobs/:jobId`
  provides authorized polling and cancellation.
- Files upload directly to private storage using expiring upload sessions.
- Original evidence, legal renditions, and reports are returned only through
  authorized short-lived access links.
- Organization capabilities and platform capabilities are disjoint. An
  organization owner is not thereby a Platform Administrator.

## Domain surfaces

The organization API covers organizations/members/invitations, dashboard,
applicability, documents, asynchronous Gap analysis, action plans, reports, and
append-only audit reads. The platform API under `/api/admin` covers the
administrator registry, legal corpus catalog and ingestion, mandatory review,
release evaluation/activation, monitors, jobs, and platform audit.

The complete route inventory is maintained in
[API route inventory](./api-route-inventory.md).

## Grounded AI boundary

Every production Gap generation request is a worker job. The worker calls the
Grounding Gateway, which owns retrieval, authority/date policy, provenance,
prompt-injection isolation, citation validation, and abstention. Compliance and
Gap releases cannot activate without immutable corpus-release pins.
