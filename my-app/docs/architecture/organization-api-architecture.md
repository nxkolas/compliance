# Internal API Architecture

Status: implemented baseline, updated 25 July 2026.

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
- Direct-upload completion verifies storage bytes and hashes before opening a
  database transaction. The transaction locks the upload session and commits
  the document, immutable version, indexing job, audit event, and completion
  locator together. A completed session replays that stored locator without
  downloading the object again.
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

Organization collection reads are status-explicit and use search-scoped opaque
cursors. Management list items include one aggregated active-member count and
the current member's effective actions; the compact switcher uses a separate,
bounded active-only read.

Organization master data and AI-provider disclosure policy are read and
updated together through `/api/organizations/:organizationId/settings`. The
composite ETag contains both resource versions. The command locks and validates
both versions before updating either row, performs one transaction, and writes
separate audit events for the two logical resources.

Archival is reversible. Only owners receive `organizations:archive`; only
owners receive `members:manage-owners`. Administrators may manage non-owner
members but cannot mutate owners or assign ownership. Every organization
workspace route rejects archived organizations until an owner restores them.
The final-active-owner invariant remains protected by the organization-level
transaction lock.

Roster identity is projected from Supabase Auth into the RLS-enabled,
browser-inaccessible `user_directory` table. Only normalized email and trusted
`full_name` are stored. Authorized member reads join that safe projection and
return an explicit fallback for unresolved historical identities.

The complete route inventory is maintained in
[API route inventory](./api-route-inventory.md).

Each audited business area exposes one public server module entry point:
applicability, compliance, corpus, documents, Gap analysis, action plans,
reports, uploads, jobs, and idempotency. Routes, pages, scripts, and worker
orchestration import those public surfaces instead of private persistence
files. Cross-module calls also go through public entries. Only schema,
verification, and benchmark operator commands may access schema definitions
directly.

Production Drizzle reads specify their columns. Full-row relational reads and
direct `src/db/schema` imports outside the allowed infrastructure surfaces are
rejected by the persistence architecture test. This keeps DTO shape,
authorization, and ownership checks inside the owning module.

## Grounded AI boundary

Every production Gap generation request is a worker job. The worker calls the
Grounding Gateway, which owns retrieval, authority/date policy, provenance,
prompt-injection isolation, citation validation, and abstention. Compliance and
Gap releases cannot activate without immutable corpus-release pins.

Gap revision JSON contains metadata only. Findings, evidence, and review
resolutions are loaded from normalized tables through the Gap module. Typed AI
input tables and typed artifact/report lineage tables replace the former
polymorphic target-kind/target-ID records, so target existence and ownership
are enforced by PostgreSQL foreign keys.
