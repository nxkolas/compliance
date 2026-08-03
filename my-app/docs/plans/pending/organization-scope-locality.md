# Organization-Scope Locality

Status: proposed incremental authorization and persistence refactor.

## Problem Statement

Browser roles are denied direct application-table access, while trusted server
code enforces organization access. This is a deliberate architecture, but its
current interface requires every domain operation to remember several facts:

- which capability to check;
- whether archived organizations permit the operation;
- which organization predicate belongs on every query;
- whether authorization must be repeated inside a transaction; and
- which compound organization/resource relationship must be verified.

That repeated knowledge reduces locality. A missed predicate or an
authorization check separated from a sensitive write can become a cross-tenant
or time-of-check/time-of-use defect.

## Solution

Introduce an organization-scope module that creates authorized read scopes and
authorized command transactions.

The interface accepts actor, organization, and capability once. It resolves
membership and archive policy, then supplies the domain operation with an
executor and immutable scope identity. Command authorization and writes occur
inside the same transaction. Domain modules continue to own business rules and
projections.

Migrate one vertical slice at a time; do not introduce a generic repository
framework or rewrite every query at once.

## Commits

1. `test: establish organization-scope security properties`
   - Add shared tests for missing membership, insufficient capability, archived
     organization policy, mismatched organization/resource identifiers, and
     successful access.
   - Assert inaccessible organization identifiers remain non-enumerable where
     current behavior requires 404.

2. `refactor: make capability resolution executor-aware`
   - Allow capability and archive checks to use either the default database
     executor or an existing transaction.
   - Preserve current role-to-capability mapping and error codes.
   - Add no new capability.

3. `refactor: add authorized read scope`
   - Resolve membership and allowed archived-state behavior once.
   - Return immutable actor and organization identities with a scoped executor.
   - Keep domain-specific queries explicit rather than hiding them behind a
     generic data abstraction.

4. `refactor: add authorized command transaction`
   - Start a transaction, lock or read the required membership and organization
     state, enforce the requested capability, and run the command callback.
   - Ensure important writes cannot occur after authorization has been revoked
     within the same transaction ordering.

5. `refactor: migrate one representative read`
   - Choose a simple organization dashboard or progress read.
   - Remove its separate capability call and pass its queries through the read
     scope.
   - Prove identical DTO and error behavior.

6. `refactor: migrate one representative command`
   - Choose document upload completion after its atomicity fix.
   - Put authorization, session lock, domain writes, job insertion, and audit in
     the authorized command transaction.
   - Prove membership or archive-state changes cannot race the command.

7. `test: add adversarial cross-tenant identifiers`
   - For each migrated domain, combine an authorized organization with resource
     identifiers from another organization.
   - Assert no row is returned or changed and no existence detail leaks.

8. `refactor: migrate document and report domains`
   - Migrate reads first, then commands.
   - Preserve compound tenant foreign keys and existing immutable version
     behavior.
   - Keep storage I/O outside transactions and revalidate scope before durable
     publication when necessary.

9. `refactor: migrate Gap and Action Plan domains`
   - Apply authorized command transactions to enqueue, contradiction
     resolution, and mutable item status operations.
   - Keep worker lease authorization distinct from human capability checks.
   - Preserve pinned organization identities in job payloads and publication
     fences.

10. `refactor: migrate organization administration and audit reads`
    - Preserve last-owner, invitation, archive, restoration, and audit-access
      invariants.
    - Keep platform operator commands outside organization membership scope.

11. `cleanup: remove redundant capability choreography`
    - Remove per-service pre-checks only after all queries and writes in that
      operation use the scope.
    - Retain narrowly named convenience operations where they improve domain
      readability.

12. `test: qualify organization isolation`
    - Run the organization-management verification and server-only RLS checks.
    - Add connected-database concurrency tests for authorization revocation and
      archive races on important commands.
    - Run all route and service capability tests.

13. `docs: describe trusted server tenancy accurately`
    - State that browser default-deny RLS and trusted-server organization scope
      serve different purposes.
    - Document the authorized read and command interfaces as the required seams
      for organization data.

## Decision Document

- This plan improves application-level tenant locality; it does not add browser
  table policies.
- Authorization for important commands occurs inside their database
  transaction.
- Domain modules retain business rules, projections, and transaction contents.
- The scope module carries actor and organization identity but does not become a
  service locator.
- Worker execution continues to rely on pinned job scope and lease fences, not
  human membership that may change after enqueue.
- Migration is vertical and incremental; old and new patterns may coexist only
  while each operation is wholly on one pattern.

## Testing Decisions

Tests exercise domain operations through the authorized scope and assert only
observable authorization, data, and audit outcomes. They do not inspect whether
a particular helper function was called.

Use archived-organization capability tests, organization management tests,
document usage/source-access tests, route contracts, server-only RLS tests, and
connected database behavior verification as prior art.

## Acceptance Criteria

- Migrated operations accept actor, organization, and capability once at their
  external interface.
- Important command authorization and writes occur in one transaction.
- Cross-organization resource identifiers cannot read or modify data.
- Existing archived-organization and capability behavior remains unchanged.
- Worker publication remains governed by persisted scope and leases.
- No browser table policy or new role is introduced.

## Rejected Alternatives

- A generic repository per table: it adds interface surface without owning a
  complete business operation.
- Relying on developer review to catch every organization filter: this keeps
  the knowledge distributed.
- Introducing browser-oriented RLS policies in the same refactor: that is a
  separate access architecture with different identity propagation needs.

## Out of Scope

- Direct browser access to application tables.
- New roles, capabilities, or organization lifecycle states.
- Platform-operator authorization redesign.
- A generic ORM repository for every table.
- Moving remote storage or AI calls into database transactions.
- Replacing Supabase Auth.
