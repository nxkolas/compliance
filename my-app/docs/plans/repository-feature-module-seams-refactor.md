# Repository Feature and Module Seams Refactor Plan

## Status

Proposed on 8 September 2026.

## Problem Statement

The repository has the intended shape of a modular Next.js application, but
several delivery and feature paths do not consistently use that shape. The
result is duplicated knowledge rather than duplicated syntax alone.

The document library exposed the problem clearly. The Documents module already
owned a current-document query and a canonical browser DTO, while the Gap
Analysis workflow repeated the document/version join and maintained a second
document projection. Size and upload date were consequently present in the
document manager but absent from the Gap Analysis picker. Fixing the missing
fields repaired the symptom but left the duplicated ownership in place.

The same class of architectural drift is possible elsewhere because:

- browser components can import types and pure workflow behavior from internal
  server implementation files;
- business modules can deep-import another business module's implementation
  rather than using its public interface;
- composite workflow readers can recreate resource DTOs and business rules
  already owned by another module;
- browser clients sometimes repeat response shapes instead of consuming the
  canonical contracts;
- visually identical feature elements, including document upload and file
  identity elements, have separate implementations that can drift; and
- the existing architecture tests protect several important backend rules but
  do not cover all browser-to-server and module-to-module seams.

This makes small changes unexpectedly cross-cutting. A new document field,
status, or label can require edits in multiple queries, contracts, and UI
implementations, with no automatic indication that one path was missed.

The refactor must preserve the product exactly. It must not change visible
layout, styling, wording, accessibility, navigation, permissions, API behavior,
background-job behavior, or database behavior. The goal is to make existing
behavior have one owner and to make every delivery path reuse that owner.

The frontend target is explicitly client-first. Authenticated product pages and
guest workflows load their runtime feature data in the browser through the same
typed clients and HTTP routes used for later refreshes. Server-rendered route
entries stop loading business-module data for screens. Existing loading visuals
and user flows are preserved while their data lifecycle moves to the client.

## Solution

Adopt and enforce one simple dependency model across the repository:

- Contracts own serializable DTOs, request schemas, response schemas, and pure
  values shared with the browser.
- Each business module owns the rules and general persistence operations for
  its feature.
- Each business module exposes supported behavior through one public interface.
- Authenticated product pages and guest workflows are client-first and obtain
  runtime feature data through typed browser clients.
- HTTP route handlers remain thin adapters over business-module interfaces and
  become the only delivery path for browser feature data.
- TanStack Query owns browser-side read lifecycle, caching, deduplication,
  invalidation, polling, and mutation coordination.
- Composite workflows use other modules through their public interfaces and add
  only workflow-specific fields or decisions.
- Reusable UI is extracted only after two real call sites demonstrate identical
  semantics and markup.

Runtime feature data has one browser delivery path. Client page entries and
feature screens call typed clients, which call authenticated HTTP routes. Server
layouts remain only where Next.js needs them for the document shell, metadata,
static locale bootstrapping, session-cookie refresh, or authenticated actor
synchronization. They do not fetch business data for feature screens.

Organization existence and archive guards move to a client layout guard backed
by the Organizations HTTP interface. It preserves the current skeleton,
not-found behavior, and archive redirect. Interactive feature screens own forms,
local state, events, polling, optimistic updates, and browser APIs. Client code
must never import database or server implementation code.

### Contract seam

Every resource visible to the browser gets one canonical DTO and runtime schema.
Feature-specific responses compose or extend those schemas instead of spelling
the same fields again. Browser code imports types only from contracts or from a
small shared pure-feature model; it does not infer types from server-function
return values.

Contracts describe transport data rather than database rows. Dates remain
serialized consistently. Internal persistence fields remain private unless a
current browser behavior demonstrably needs them.

### HTTP and browser-client seam

HTTP routes keep their existing paths, methods, authentication, validation,
rate limits, idempotency requirements, status codes, envelopes, and error codes.
They translate transport concerns and dispatch to module interfaces; they do
not contain alternate business rules.

Each browser client remains the only place where its feature constructs URLs,
invokes the shared request helper, and validates responses. Components never
use raw fetch. A browser client reuses exported feature schemas rather than
reconstructing equivalent response objects locally.

Every browser-consumed read must have an HTTP route and typed-client operation.
Missing reads are added without renaming or removing existing routes. OpenAPI
operation metadata reuses the same request and response schemas; it never
introduces a second DTO definition.

### Client-page and query seam

Authenticated product pages and guest workflow pages load runtime feature data
with TanStack Query through the existing typed browser clients. Query keys are
owned by each feature and include every scope or filter that changes the result.
Mutations update or invalidate the same feature keys. Existing dedicated job
polling may remain where its cancellation and terminal-state behavior is more
specific than a normal query; it must not create a second feature-data cache.

A single application Query Client is created in a Client Component provider.
No server prefetch, dehydration, Hydration Boundary, or server-provided initial
feature data is used. This deliberately keeps one runtime owner of screen data
and avoids server/client cache divergence.

Use `@tanstack/react-query` directly. Do not add React Query Devtools to the
production application and do not hide TanStack Query behind a repository-wide
custom query framework.

Existing loading components and skeletons become the initial query fallbacks.
Existing localized error surfaces handle query failures. Retry-on-focus,
automatic retries, stale times, and polling intervals are set explicitly by
feature rather than inherited from surprising global defaults.

Route-entry files may remain minimal Server Components only where Next.js needs
a server entry for metadata or static locale setup. Such files render a client
page entry and do not call business modules. Public marketing, legal, and other
static-content pages do not need conversion because they load no runtime feature
data.

### OpenAPI and Swagger seam

The existing Zod contracts remain authoritative. An OpenAPI registry references
those schemas and adds only transport metadata: paths, methods, parameters,
security, status codes, content types, and operation descriptions. Generated
OpenAPI output is checked against the route inventory so undocumented public
operations and documented nonexistent operations fail verification.

Use `@asteasolutions/zod-to-openapi` for Zod 4 contract conversion and
`swagger-ui-react` for the developer viewer. Pin both as direct dependencies and
verify their installed licenses through the repository's existing license scan.

The repository does not generate browser clients from OpenAPI during this
refactor. Existing typed clients are already small, encode application-specific
behavior such as idempotency and uploads, and validate with the authoritative
Zod contracts.

Swagger UI consumes the generated OpenAPI document through an authenticated,
unlinked developer route. It is not added to product navigation, does not reuse
product styling, and is disabled by default in production. Internal recovery
operations and secrets are excluded. No secret, session token, customer data,
or realistic sensitive example is embedded in the specification.

### Organizations seam

Organizations owns organization identity, lifecycle, membership, invitations,
settings, model settings, organization-scoped authorization helpers exposed as
business behavior, and organization-level progress/dashboard composition.

Browser-visible organization, membership, invitation, and settings DTOs move to
canonical contracts. Organization UI stops importing database-derived or
implementation-local server types.

Organization dashboard and progress readers may remain specialized aggregate
read models. They should reuse another module's public summary or predicate when
they repeat a business decision. A count or existence query that does not
reconstruct a canonical resource is not forced through a full list function.

### Documents seam

Documents owns document identity, current-version resolution, upload, archive,
restore, indexing status, retrieval, storage access, and the canonical document
DTO.

There is one current-document row query and one canonical mapping from rows to
the browser DTO. Authorized list/detail operations and preauthorized workflow
composition reuse that implementation. Filtering, search, counts, and
pagination remain list concerns layered over the canonical read.

Gap Analysis, Grounding, Reports, and Organizations do not recreate the general
current-document projection. They may perform specialized snapshot, aggregate,
or retrieval queries when those queries represent genuinely different data,
such as immutable historical evidence or ranked chunks.

Shared document UI is limited to proven identical elements: upload behavior,
file identity/icon rendering, MIME-type labeling, byte formatting, and date
formatting. Management status and Gap eligibility remain separate because they
express different product semantics.

### Applicability Check seam

Applicability Check owns questionnaire delivery, answers, submissions, guest
lifecycle, result projection, eligibility output, and the current applicability
release selection.

Browser-visible questionnaire and result types live at the contract seam. Pure
question visibility and wizard-flow behavior needed by browser code moves to a
shared pure-feature model or is exposed through the contract package; it does
not remain reachable only through server implementation paths.

Other modules consume applicability decisions through the Applicability Check
public interface. They do not deep-import its release implementation.

### Compliance Content seam

Compliance Content owns shared release types, NIS2 rule evaluation primitives,
legal-citation primitives, compilation, and code-owned compliance definitions
that are genuinely shared between workflows.

It remains independent from product workflows. Applicability Check and Gap
Analysis depend on Compliance Content, not the reverse. A workflow-specific
current release remains owned by that workflow unless multiple real callers
require a shared compliance concept.

### Gap Analysis seam

Gap Analysis owns assessment lifecycle, questionnaire drafts and submissions,
analysis cycles, evidence selection, generation, findings, contradiction
resolution, workflow navigation, history, and Gap-specific read models.

The Gap workflow DTO becomes an explicit contract rather than a browser type
inferred from a server reader. Pure workflow navigation and selection logic used
by the browser becomes a shared pure Gap model with no database or server-only
imports.

The document picker consumes the canonical document DTO plus only the Gap-specific
eligibility projection. Selection commands continue to revalidate current,
active, indexed versions server-side before persistence. UI eligibility never
replaces authoritative command validation.

Historical generated-input reads remain snapshot-oriented and may join pinned
versions because they are not the current document library.

### Grounding seam

Grounding owns evidence coordination, provider-independent retrieval orchestration,
prompt context assembly, validation, provenance, and provider dispatch through
its public interface.

It consumes document retrieval through the Documents interface and legal-source
resolution through the Legal Corpus interface. Workflow modules provide the
workflow-specific query units, instructions, and output contracts. Grounding
does not import workflow internals.

### Legal Corpus seam

Legal Corpus owns source versions, renditions, processing generations, corpus
snapshots, activation, validation, and legal-source retrieval inputs. It uses
shared Compliance Content primitives only through that module's public interface.

Validation that requires a Gap contract consumes an intentionally exported Gap
contract value. It must not reach into the Gap release implementation.

### Action Plans seam

Action Plans owns plan lifecycle, generation, item updates, progress, publication,
and Action Plan read models. Browser-visible plan and preparation DTOs move to
contracts instead of being inferred from implementation functions.

Action Plans consumes accepted Gap artifacts through the Gap Analysis public
interface. Shared prompt-contract concepts are promoted only if both modules
truly own the same concept; otherwise the dependency points from Action Plans to
Gap Analysis and not back again.

### Reports seam

Reports owns report creation, report library reads, rendering snapshots,
rendering, downloads, quotas, and report jobs. Browser-visible report library
and detail data use the report contracts.

Reports consumes published Applicability, Gap, Action Plan, Compliance Content,
and document-source information through public module interfaces. It does not
deep-import current-release implementations. Rendering-only types remain private
to Reports.

### Audit seam

Audit owns audit-event reads and platform audit writes. Business modules continue
to write domain audit events as part of their authoritative transactions where
atomicity requires it. The refactor does not introduce an event bus or move
transactional audit writes behind a remote-looking abstraction.

### Platform and bootstrap seams

Platform owns reusable HTTP, authentication primitives, jobs, AI adapters,
content processing, storage, rate limiting, idempotency, health, and other
non-business execution behavior. Platform never imports business modules.

Bootstrap owns static application composition such as job-handler registration.
No plugin registry, dependency-injection container, repository hierarchy, or
runtime module discovery is introduced.

### UI reuse seam

Feature screens remain independent when their behavior differs. Reuse is
limited to leaf elements and complete interactions whose semantics are already
identical in at least two places.

The refactor explicitly avoids a universal data table, universal workflow
component, generic CRUD layer, generic repository, or large configurable form
builder. Those abstractions would increase the interface developers must learn
without removing meaningful behavior.

## Commits

Every commit below must pass type checking and its focused tests. Mechanical
moves and behavior-preserving logic changes are kept separate. Temporary
compatibility exports are permitted only within one feature sequence and are
removed before that sequence ends.

### Baseline and guardrails

1. Record the current type-check, lint, focused feature tests, full-suite results,
   and production build result. Classify any pre-existing failures so later
   commits are required to introduce no new failure.
2. Add characterization tests for the document DTO returned by the Documents
   list path and embedded in the Gap workflow. Assert equivalent identity,
   metadata, lifecycle, and indexing information without asserting internal SQL.
3. Extend the existing client/server boundary test to detect server imports from
   Client Components, but temporarily allow only the confirmed current offenders.
   This makes the debt visible without breaking the baseline.
4. Extend the module-boundary test to detect cross-module deep imports, again with
   a temporary explicit allowlist of confirmed offenders.

### Documents and Gap Analysis integration

5. Make the Gap workflow obtain the current document library from the existing
   preauthorized Documents read interface. Remove the duplicate current-document
   join and preserve the returned ordering and document availability behavior.
6. Compose the Gap document contract from the canonical document DTO plus the
   Gap-specific eligibility value. Remove duplicated field declarations and
   migrate the picker from archive timestamps to canonical lifecycle status.
7. Keep Gap selection command validation unchanged and add a focused test proving
   that archived, missing, non-current, processing, and failed documents remain
   unselectable even if a browser sends their identifiers directly.
8. Remove now-unused Gap document projection code and contract fixtures. Prove
   that the Documents page, Gap picker, review step, upload refresh, and generation
   selection still display and behave identically.

### Shared document UI

9. Extract the identical document file icon and file-identity rendering without
   changing markup, class names, dimensions, colors, labels, or accessibility.
   Switch the document manager and Gap picker in the same commit.
10. Extract the shared document upload interaction using the existing browser
    client. Preserve both trigger placements, dialog appearance, accepted file
    types, validation, messages, focus behavior, and refresh behavior.
11. Consolidate any remaining duplicate MIME labeling, byte formatting, and date
    formatting calls around the existing helpers. Do not introduce a general
    table abstraction.

### Organizations browser contract

12. Define canonical browser contracts for organization identity, list items,
    membership, invitations, and settings that are currently consumed from
    server-derived types. Add parsing tests for serialized dates and strict
    fields.
13. Update organization browser clients and Client Components to use those
    contracts. Preserve all list, switcher, inbox, settings, invitation, member,
    archive, and restore behavior.
14. Remove organization-type imports from server implementation files in browser
    code and shrink the client/server-boundary allowlist accordingly.

### Applicability Check browser contract

15. Complete explicit contracts for questionnaire, answers, overview, and result
    data used by the browser. Preserve guest and authenticated response shapes.
16. Move or expose browser-used pure question-visibility behavior through a
    server-independent feature model. Preserve question ordering, conditional
    visibility, defaults, validation, and both locales.
17. Update the applicability browser client and interactive screens to consume
    only contracts and the pure feature model. Remove their server-module imports
    and shrink the boundary allowlist.

### Gap Analysis browser contract

18. Replace the browser's inferred Gap workflow return type with the explicit Gap
    workflow contract type. Preserve every current workflow field and strict
    runtime validation.
19. Move browser-used Gap navigation and lifecycle derivation into a pure shared
    Gap model, or expose an already-pure implementation from a server-independent
    seam. Preserve allowed steps, redirects, generated views, and back/forward
    navigation.
20. Move finding-source and other browser-visible Gap types to the Gap contracts.
    Update all Gap screens and shrink the boundary allowlist.

### Action Plans and Reports browser contracts

21. Define or complete explicit Action Plan browser DTOs for current plan,
    preparation state, progress, items, and generation status. Migrate the Action
    Plan client and screen without changing workflow behavior.
22. Define or complete explicit Report browser DTOs for library, detail, job
    status, and downloads. Migrate the Report client and screen without changing
    rendering or download behavior.
23. Remove the remaining browser imports from Action Plan and Report server
    implementation files. Delete the client/server-boundary allowlist when it is
    empty.

### Client data-loading foundation

24. Add TanStack Query as the one explicit browser server-state dependency and
    mount one Query Client provider around the application. Do not migrate a
    feature in this commit; prove the existing application renders unchanged.
25. Set conservative global defaults that preserve current behavior. Disable
    surprising automatic retries and focus refetch globally, then enable them
    only for features that already retry or poll. Add provider lifecycle tests.
26. Establish feature-owned query-key factories and typed query options that call
    existing browser clients. Do not wrap all of TanStack Query in a custom
    framework; small feature hooks are permitted only when they remove repeated
    loading, error, or invalidation behavior.
27. Add reusable test support for pending, successful, failed, cancelled, stale,
    and invalidated queries. Keep production loading and error UI unchanged.

### Organizations client pages and shell

28. Convert the organization list and organization switcher runtime reads to
    TanStack Query through the Organizations browser client. Preserve active and
    archived tabs, counts, search parameters, and current selection.
29. Replace the server-side organization layout lookup with a client organization
    guard. Preserve the existing skeleton, not-found outcome, archived-organization
    redirect, and all capability enforcement in downstream routes.
30. Convert organization inbox and management reads to client queries. Mutations
    update or invalidate the exact organization and invitation keys while keeping
    notices, confirmation dialogs, and optimistic behavior unchanged.
31. Convert member, invitation, team, settings, and model-settings reads to client
    queries one screen at a time. Keep permission-based control visibility and
    every current mutation response unchanged.
32. Convert organization dashboard, progress, and activity reads to client queries.
    Preserve charts, progress calculations, date ranges, polling, empty states,
    and action links.

### Documents client page

33. Convert the document manager's initial library read to the Documents browser
    client and TanStack Query. Preserve URL-backed status/search state, pagination,
    counts, the existing skeleton, and empty states.
34. Route upload, retry, archive, and restore success through targeted document
    cache updates or invalidation. Preserve dialogs, messages, processing states,
    and download behavior.

### Applicability Check client pages

35. Convert the authenticated Applicability overview read to the browser client.
    Preserve redirect and empty-state decisions in the client screen.
36. Convert questionnaire and recalculation-lock reads to client queries. Preserve
    conditional question visibility, saved drafts, defaults, and disabled states.
37. Convert authenticated answers and result reads to client queries. Preserve
    tabs, localized result presentation, and route navigation.
38. Add any missing guest read operation and convert guest questionnaire and result
    runtime data to client queries. Preserve the guest cookie lifecycle, claim
    behavior, public loading UI, and error handling.

### Gap Analysis client page

39. Convert the Gap workflow's initial read to the existing Gap browser client and
    TanStack Query. Preserve requested step/view resolution, allowed navigation,
    selected documents, questionnaire state, and every current loading surface.
40. Update Gap mutations, document uploads, history, inputs, generation progress,
    and contradiction resolution to update or invalidate the owning query keys.
    Remove data refreshes that depend on re-running a Server Component while
    preserving visible refresh timing and job cancellation behavior.

### Action Plans and Reports client pages

41. Convert Action Plan initial plan, preparation, progress, and generation-status
    reads to client queries. Preserve generation, item updates, progress display,
    plan locks, and Gap revision relationships.
42. Convert Report library and detail reads to client queries. Preserve creation,
    job polling, list order, quotas, failure states, and downloads.
43. Convert any remaining authenticated product-page runtime read to an existing
    typed browser client. Add a missing read route only when no current route can
    express the existing server read without changing its semantics.
44. Remove business-module reads from product page entries and feature layouts.
    Retain only Next.js document/metadata work, static locale bootstrapping,
    session-cookie refresh, and authenticated actor synchronization on the server.

### Cross-module server interfaces

45. Replace Reports deep imports of Applicability and Gap release implementations
    with intentional exports from those modules' public interfaces. Preserve
    report legal references and rendered output byte-for-byte where deterministic.
46. Replace Grounding deep imports of organization types with contract types or
    the Organizations public interface. Preserve prompt inputs and provider
    behavior.
47. Remove the Gap-to-Action-Plan deep import by assigning the shared concept to
    one existing owning module and exporting only the minimum required value or
    type. Add a focused dependency-direction test for the resolved relationship.
48. Replace any remaining confirmed cross-module deep imports with public-interface
    imports one dependency at a time. Delete the module-boundary allowlist when
    it is empty.

### Composite read models

49. Inventory composite readers in Organizations, Gap Analysis, Action Plans,
    and Reports for repeated canonical resource projections or duplicated
    business predicates. Record which reads are canonical-resource reuse and
    which are legitimate aggregate or immutable-snapshot reads.
50. Replace duplicated canonical projections with preauthorized module reads,
    one feature at a time. Preserve query concurrency, ordering, authorization,
    and response shape.
51. Keep specialized counts, existence checks, ranked retrieval, and historical
    snapshot joins local when routing them through a full resource list would
    add work or obscure their meaning. Add focused tests only where a business
    predicate is shared.

### OpenAPI and Swagger

52. Add one Zod-compatible OpenAPI generator and register the existing shared
    envelope, error, identifier, pagination, job, and upload schemas. Zod remains
    the source of truth; OpenAPI metadata must not fork validation logic.
53. Register Organizations and Documents operations using their existing request
    and response schemas. Describe cookie authentication, parameters, status
    codes, binary redirects, and upload-session behavior without sensitive examples.
54. Register Applicability Check and Gap Analysis operations. Include guest-cookie
    behavior, idempotency, asynchronous job responses, conflicts, and locale-aware
    results.
55. Register Action Plans, Reports, Audit, progress, model settings, invitations,
    members, and remaining public job operations. Exclude internal recovery and
    operator-only operations.
56. Expose the generated OpenAPI document and Swagger UI through authenticated,
    unlinked developer routes. Disable the documentation surface by default in
    production and prevent online validation or external credential forwarding.
57. Add route-inventory verification that fails when a public operation is missing
    from OpenAPI or when OpenAPI names a route or method that does not exist.
    Permit explicit documented exceptions for non-JSON redirects and health probes.

### Browser-client and transport consistency

58. Make each browser client consume its feature's exported output schemas rather
    than reconstructing equivalent schemas. Do this one client at a time and
    preserve the shared response envelope behavior.
59. Verify each HTTP route remains a thin adapter over a business-module interface.
    Remove only proven pass-through helpers that add no policy.
60. Verify every Client Component uses a browser client rather than raw fetch and
    every runtime feature read is owned by TanStack Query. Preserve cancellation,
    idempotency keys, notices, error localization, and feature-specific polling.

### Final enforcement and documentation

61. Turn the architecture tests from allowlist-based migration guards into strict
    rules: Client Components and browser clients cannot import server code;
    product page entries cannot import business modules for runtime screen data;
    external callers cannot deep-import business modules; and platform cannot
    import business modules.
62. Add a small ownership check for canonical browser DTOs so feature contracts
    are composed rather than redeclared where practical. Do not add a dependency
    graph package.
63. Update the architecture documentation to describe client-owned runtime data,
    TanStack Query ownership, canonical DTOs, preauthorized module composition,
    the composite read-model exception, OpenAPI generation, and UI leaf reuse.
64. Run the complete verification matrix and perform a manual visual comparison
    of every touched screen in both supported locales and both themes. Resolve
    only regressions introduced by the refactor.

## Decision Document

- This is a behavior-preserving architecture refactor, not a redesign.
- Existing route paths, HTTP methods, envelopes, status codes, stable error codes,
  permissions, and idempotency behavior remain unchanged.
- Existing database tables, columns, indexes, constraints, relations, and stored
  data remain unchanged.
- Business modules continue to use direct Drizzle access internally. No repository
  layer is added.
- Each feature exposes one public module interface. Cross-module callers use that
  interface and never implementation paths.
- Contracts own all browser-visible DTOs and runtime schemas.
- A feature-specific DTO composes a canonical resource DTO instead of copying its
  fields.
- Authorized entry operations remain suitable for HTTP routes. Preauthorized
  variants are allowed for server-side module composition after an organization
  scope has already been established.
- Authenticated product pages and guest workflows load runtime feature data in
  the browser through typed clients and HTTP routes.
- Product page entries and feature layouts do not call business modules for
  initial screen data.
- TanStack Query is the single owner of client-side server state: initial reads,
  cache, deduplication, invalidation, refetch, and ordinary polling.
- No TanStack server prefetching, dehydration, or server-provided initial feature
  data is used.
- Existing dedicated polling remains only where it owns additional job lifecycle
  semantics and does not duplicate a feature query cache.
- Minimal Server Components may remain for the Next.js document shell, metadata,
  static locale bootstrapping, session-cookie refresh, and authenticated actor
  synchronization.
- Public marketing, legal, and static-content pages remain server-rendered when
  they do not load runtime feature data.
- Composite read models may retain specialized aggregate and historical snapshot
  queries. They may not redefine canonical resource projections or duplicate
  business decisions without an explicit reason.
- Selection and mutation commands always revalidate authorization and current
  domain state server-side, regardless of what the UI displays.
- UI reuse is limited to identical leaf presentation or complete identical
  interactions with at least two real callers.
- TanStack Query is added as the only new browser data-fetching dependency. No
  additional state-management or request library is introduced.
- The selected query dependency is `@tanstack/react-query`; React Query Devtools
  and custom repository-wide query abstractions are not added.
- The existing Zod contracts remain authoritative. OpenAPI is generated from
  them and is never maintained as a parallel handwritten schema set.
- The selected documentation dependencies are
  `@asteasolutions/zod-to-openapi` and `swagger-ui-react`.
- Existing typed browser clients remain hand-maintained and Zod-validated; no
  OpenAPI client generation is added.
- Swagger UI is developer tooling, authenticated, unlinked from the product,
  excluded from normal product styling, and disabled by default in production.
- No universal table, CRUD framework, form engine, event bus, dependency-injection
  container, or runtime plugin system is introduced.
- File moves are not a goal. The existing business-module, platform, bootstrap,
  contract, browser-client, route, and component folders remain the overall
  structure.
- Any discovered change that would alter product behavior is split into a separate
  proposal rather than hidden inside this refactor.

## Testing Decisions

A good test observes a stable interface or user-visible behavior. It should
prove that a caller receives the same contract, a command enforces the same
rule, or a rendered screen exposes the same controls and states. It should not
assert implementation filenames, internal helper calls, or exact SQL unless the
test is specifically an architecture or persistence-integrity check.

The repository already has broad prior art across approximately 150 test files:
module-boundary tests, client/server-boundary tests, route-contract tests,
feature-domain tests, job lifecycle tests, and server-rendered UI tests. This is
sufficient to execute the refactor test-first without introducing a new test
framework.

Testing by seam:

- Contracts: strict parsing, serialization, optionality, enums, and response
  composition.
- Business queries: authorized and preauthorized callers return equivalent DTOs
  for the same scope.
- Commands: authorization, lifecycle, version, eligibility, idempotency, and
  conflict behavior remain authoritative.
- Routes: request parsing, envelopes, status codes, error codes, headers, and
  response DTOs remain unchanged.
- Browser clients: URL construction, method, input, cancellation signal,
  idempotency key, and output validation remain unchanged.
- Client queries: stable feature keys, disabled/dependent query behavior,
  cancellation, stale state, invalidation, retry, refetch, and polling are tested
  through observable screen behavior.
- Client screens: headings, controls, labels, enabled/disabled states, visible
  statuses, table content, dialogs, navigation, and localized formatting remain
  unchanged.
- Loading and errors: each converted page renders the same existing skeleton or
  loading treatment while pending and the same localized error/retry controls on
  failure.
- Client guards: unauthenticated, forbidden, missing, and archived organization
  outcomes preserve their current destination and visible fallback.
- OpenAPI: generated operations reuse the canonical schemas, cover the public
  route inventory, describe authentication and error responses, and contain no
  sensitive examples.
- Shared UI extraction: render both callers before and after extraction and keep
  existing markup and accessibility assertions.
- Architecture: dependency direction is checked using the existing lightweight
  standard-library approach.
- Final qualification: type checking, linting, the complete test suite, production
  build, and relevant connected qualifications pass with no new failures.

Full visual snapshots are not introduced. They would be brittle and would add a
new maintenance surface. For components whose markup is extracted, focused
render assertions and manual before/after comparison in German and English,
light and dark themes, are sufficient because styles are not intentionally
edited.

## Out of Scope

- Any visual redesign, spacing change, color change, typography change, responsive
  behavior change, animation change, or wording change.
- Any new or removed user capability, workflow step, route, action, filter, status,
  notification, or navigation behavior.
- Database schema changes, migrations, data cleanup, or seed redesign.
- Authentication, authorization, role, capability, RLS, or tenancy changes.
- Changes to document parsing, indexing, embeddings, retrieval ranking, supported
  formats, storage, or background-job execution.
- Changes to applicability rules, compliance releases, Gap evaluation, prompts,
  generated outputs, Action Plan generation, report content, or legal citations.
- Server prefetching, TanStack Query dehydration, or mixed ownership of the same
  feature data between a Server Component and the browser cache.
- Converting public marketing, legal, licenses, or other static-content pages
  that do not load runtime feature data.
- Introducing another state-management library, another data-fetching library,
  or a new HTTP framework alongside TanStack Query.
- Generating browser clients or server route implementations from OpenAPI.
- Replacing Zod contracts with OpenAPI schemas.
- Exposing Swagger UI in product navigation or enabling it by default in
  production.
- Combining semantically different feature endpoints merely because they read
  related tables.
- A universal document table or generic CRUD/repository architecture.
- Broad file or folder reorganization already completed by the backend module
  organization work.
- Performance optimization except removal of demonstrably redundant reads. Any
  query-plan change requires separate evidence and review.

## Further Notes

The earlier backend module-organization plan is complete and remains the basis
for the current folder structure. This plan does not repeat it. It closes the
remaining seams between those modules, contracts, HTTP routes, browser clients,
client page entries, and interactive screens.

The motivating document-picker defect should be fixed early because it provides
a small, concrete proof of the architecture: one Documents read implementation,
one document DTO, one Gap-specific eligibility extension, and two unchanged user
interfaces.

The plan is formatted as a GitHub issue description. It is stored locally because
the current environment has no GitHub CLI or connected GitHub tool available.
