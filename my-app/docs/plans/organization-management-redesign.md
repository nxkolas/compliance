# Organization Management Redesign

Status: implemented and environment-verified, 25 July 2026.

## Outcome

Rebuild organization switching, creation, management, editing, archival, and
member management around the supplied dark desktop designs while preserving
the application's existing authorization, concurrency, guest-claim, and
organization-scoped routing contracts.

The redesign has four primary surfaces:

1. an always-available organization switcher;
2. a searchable, infinitely scrolling organization-management page;
3. the redesigned organization-creation page; and
4. an organization edit modal that owns master data and AI-provider policy.

The existing organization settings page becomes a localized placeholder that
links back to organization management. Organization facts and the fixed
framework card are removed from the settings UI, but their persisted data and
workflow use remain unchanged.

## Confirmed Product Decisions

### Active organization context

- Keep the current URL-scoped organization context.
- Do not add a last-active-organization cookie, browser preference, or database
  preference.
- Organization routes select the organization from `[organizationId]`.
- Context-free routes such as `/tool/organizations` and
  `/tool/organizations/new` show the switcher placeholder rather than inventing
  a selected organization.
- Selecting an organization navigates to its dashboard.

### Organization switcher

- Always render the switcher, including when the user has no organizations.
- List active organizations only.
- Show a check beside the URL-selected organization.
- Add “Neue Organisation erstellen” and “Organisationen verwalten” actions.
- In the zero-organization state, show “Organisation auswählen” plus the create
  and manage actions.
- Keep the dropdown intentionally compact. Load a bounded, alphabetically
  sorted active set and use the management page as the complete catalog.
- Derive a two-character avatar from the display name and a stable accessible
  color from the organization ID. Do not add logo or color persistence.

### Organization-management page

- Default to active organizations.
- Show display name, legal name, localized country, deterministic avatar, and
  active-member count.
- Count only memberships whose status is `active`. Suspended memberships and
  invitations do not count.
- Make active rows keyboard-accessible links to the organization dashboard.
- Keep the row kebab as a separate control that does not trigger row
  navigation.
- Search display name and legal name case-insensitively. Do not search country
  or member identity.
- Apply the same search query to active and archived sections.
- Show section-specific empty results.
- Use opaque cursor pagination and infinite scroll, with request
  deduplication, abort handling, loading/error rows, and an accessible manual
  fallback when automatic observation is unavailable or fails.
- Remove the current hidden 50-organization management limit. The switcher may
  remain bounded.

### Roles and actions

- Every active member may open organization management and see organizations
  they belong to.
- Owners and administrators may edit organization data and AI-provider policy.
- Owners and administrators see “Mitglieder verwalten.”
- Members and auditors see “Mitglieder anzeigen” and the same roster in
  read-only mode.
- Only owners may archive or restore an organization.
- Omit unauthorized menu actions and enforce the same rules on the server.
- Administrators may manage administrators, members, and auditors, but may not
  promote, demote, suspend, or otherwise alter owners.
- Only owners may promote an existing active member to owner or change another
  owner's role/status.
- Owner invitations remain unavailable. Ownership is granted only to an
  existing active member.
- The final active owner cannot leave, be suspended, or be demoted.

### Archival

- Keep the visible destructive label “Organisation löschen,” but implement it
  as reversible archival.
- Use an explicit confirmation dialog naming the organization and explaining
  that it disappears from the switcher, cannot be opened, and can be restored.
- Do not require typing the organization name.
- Put archived organizations in a separate management-page section.
- Archived organizations are not row links and never appear in the switcher.
- Owners see “Organisation wiederherstellen.”
- A bookmarked workspace URL for an archived organization redirects to
  `/tool/organizations` with a localized archived notice.
- Data remains preserved. Restoration is required before workspace screens can
  be opened again.

### Edit modal and settings

- Open the edit modal from the management-page kebab menu.
- Load edit data only when the modal opens; do not over-project AI policy into
  every organization list item.
- Include:
  - organization display name;
  - legal name;
  - localized country selector; and
  - AI-provider/external-disclosure policy, including the required reason when
    the policy changes.
- Remove the organization-facts view and current-framework card from the UI.
- Save master data and AI policy atomically through one server command and one
  “Änderungen speichern” action.
- Validate both concurrency versions before changing either record. A conflict
  changes neither.
- Record separate audit events for organization-data and policy changes even
  though they share a transaction.
- Make `/tool/organizations/[organizationId]/settings` a localized placeholder
  with a link to `/tool/organizations`.

### Creation and country selection

- Redesign the page and form to match the reference card layout.
- Use corrected, finished German copy:
  - title: “Neue Organisation erstellen”;
  - subtitle: “Erstellen Sie einen Arbeitsbereich für eine juristische
    Person.”; and
  - country label: “Land.”
- Keep the formal German “Sie” voice and provide equivalent English copy.
- Share one localized, searchable country selector between creation and edit.
- Include all ISO 3166-1 alpha-2 countries, display localized names, store the
  alpha-2 code, and default new organizations to `DE`.
- Keep organization country separate from compliance-jurisdiction eligibility.
- Preserve redirects:
  - normal creation to the new organization dashboard;
  - `next=assessment` to a new applicability check; and
  - guest claim to the claimed applicability result.

### Member management

- Expand the existing team route rather than creating a parallel workflow.
- Show active and suspended members with safe identity, role, and status.
- Allow authorized role changes, suspension, and reactivation with
  optimistic-concurrency checks.
- Add pending invitation resend and revoke controls.
- Keep accepted, expired, and revoked invitations in a collapsed history
  section rather than the pending work queue.
- Allow self-service “Organisation verlassen.” Leaving suspends membership and
  preserves history.
- Redirect a departed user to organization management.
- Enforce the final-owner rule under the existing organization-level
  transaction lock.

### Responsive and accessible behavior

- Retain the reference proportions on desktop.
- Compress management rows without losing member count or actions.
- Stack the creation form on narrow screens.
- Render the expanded edit dialog as a full-height mobile sheet with a sticky
  save area.
- Render member records as stacked cards on small screens instead of forcing
  horizontally scrolling controls.
- Preserve focus trapping, Escape/close behavior, visible focus, semantic
  labels, keyboard row navigation, and screen-reader announcements for
  infinite-scroll loading and mutation results.

## Database Impact

A database change is required only because memberships currently contain an
auth user UUID and no safe display identity. The UI cannot build a meaningful
member roster from `organization_memberships` alone.

### Required additive table

Add a server-only `user_directory` table to `src/db/schema.ts`:

| Column | Contract |
| --- | --- |
| `user_id` | UUID primary key matching Supabase Auth user ID |
| `email` | normalized current email, required |
| `display_name` | optional name from trusted auth metadata |
| `created_at` | creation timestamp |
| `updated_at` | last projection refresh |

Add a case-insensitive unique email index if the connected Auth tenant's
identity rules guarantee one account per normalized email. Otherwise use a
non-unique lookup index and keep `user_id` authoritative. Do not expose the
table directly to browser database roles and do not store auth credentials,
tokens, or unrestricted user metadata.

Add a composite
`organization_memberships(organization_id, status)` index only if the reviewed
query plan shows it materially improves active-member aggregation. It is an
optional performance index, not a functional dependency.

### Projection lifecycle

Add a small server module under `src/server/users/` that:

1. accepts an authenticated Supabase `User`;
2. normalizes email and the optional `full_name`;
3. upserts only the safe projection fields; and
4. updates `updated_at` only when projected values change.

Synchronize the projection at the authenticated server boundary and on
invitation acceptance. Add an idempotent operator backfill that:

1. selects distinct membership user IDs;
2. resolves them through the Supabase Admin API in bounded batches;
3. upserts safe identity fields;
4. reports missing auth identities without deleting memberships; and
5. can be rerun safely.

Until a missing identity is repaired, the member DTO must return a localized
safe fallback rather than leaking or failing the entire roster.

### Security work

- Add `user_directory` to the server-only RLS/revocation SQL and to the
  server-only grant verifier.
- Permit reads only through organization-authorized server services.
- Project only `email` and `displayName` into a roster after checking
  `members:read`.
- Never allow client-supplied email/name values to update the directory.

### Applying the schema

A clear/reseed is not required for this additive change. Preferred rollout:

1. add schema and security-verifier tests;
2. review the generated SQL for the table and indexes;
3. apply the additive schema to the intended development database;
4. reapply/verify server-only security for the new table;
5. run the idempotent directory backfill; and
6. run organization/member smoke checks.

If existing development-database drift makes the additive application unsafe
or harder than a clean rebuild, the user has authorized a guarded development
clear and reseed. In that case follow
`docs/database/database-reset-and-reseed.md` exactly: verify the target is the
disposable development database, run all preflight checks, stop on the first
failed gate, restore every reviewed security/integrity SQL layer, republish
required releases, and run the complete smoke suite. Do not clear or reseed
merely because it is convenient.

No organization, membership, invitation, assessment, document, fact, report,
or AI-policy data migration is otherwise needed.

## API and Domain Contracts

### Organization collection read

Extend the organization collection query contract with:

```ts
type OrganizationListQuery = {
  status: "active" | "archived";
  query?: string;
  cursor?: string;
  limit?: number;
};
```

Return a dedicated list item rather than overloading `OrganizationDto`:

```ts
type OrganizationListItem = {
  id: string;
  name: string;
  legalName: string | null;
  country: string;
  archivedAt: string | null;
  version: number;
  activeMemberCount: number;
  currentUserRole: OrganizationRole;
};
```

Use an opaque cursor scoped to user ID, status, and normalized search query.
Order alphabetically by normalized display name with organization ID as the
stable tie-breaker. The service query must:

- authorize through active membership;
- filter archive status explicitly;
- aggregate only active memberships;
- avoid one count query per row; and
- select explicit columns in line with the persistence architecture test.

The switcher uses a bounded active-only server read. The management client uses
the paginated API for infinite scroll.

### Atomic organization settings command

Add a combined settings read/command under the organization domain:

- `GET /api/organizations/:organizationId/settings`
- `PATCH /api/organizations/:organizationId/settings`

The read returns organization master data, AI-provider policy, allowed actions,
and a composite concurrency token. The patch accepts both logical inputs and
requires that composite token through `If-Match`.

Implement the command in one database transaction:

1. require `organizations:update`;
2. lock/read organization and policy versions;
3. reject a stale composite token with `412 PRECONDITION_FAILED`;
4. validate organization fields and the conditional policy-change reason;
5. update only changed rows;
6. increment only changed resource versions;
7. append distinct audit events; and
8. return the refreshed combined DTO and ETag.

Do not implement the modal as two sequential client mutations.

### Archive and restore

- Split `organizations:archive` out of the shared owner/admin capability set
  and grant it to owners only.
- Keep archive/restore version checks and add missing audit events and path
  revalidation.
- The restore command uses the actor's active owner membership even while the
  organization is archived.
- Reject archive/restore calls from administrators, members, and auditors.
- Add the archived route guard to the organization layout so every workspace
  page inherits it.

### Membership governance

Add a separate owner-governance capability, for example
`members:manage-owners`, granted only to owners. Retain `members:manage` for
owners and administrators.

The member command must inspect actor and target roles inside the same locked
transaction:

- an administrator cannot assign `owner`;
- an administrator cannot mutate a current owner;
- only an owner can promote/demote an owner;
- no command can remove the final active owner;
- self-leave remains available unless it violates the final-owner invariant;
  and
- all successful changes append an audit event.

Extend the member read DTO with the authorized safe identity projection and
return the actor's effective controls separately from member data. Add client
methods for member update, deactivate, reactivate, leave, invitation resend,
and invitation revoke; components must continue to use the feature client
rather than calling `fetch` directly.

## Implementation Plan

### 1. Establish contracts and permission invariants

Files:

- `src/server/auth/capabilities.ts`
- `src/server/auth/capability-service.ts`
- `src/contracts/organizations/index.ts`
- `src/server/organizations/types.ts`
- organization capability and route tests

Work:

1. Add owner-only archive and owner-governance capabilities.
2. Define list query/list item, combined settings, member identity, and
   invitation-history contracts.
3. Add pure helpers for effective organization actions by role.
4. Add failing tests for admin archival, admin owner promotion/demotion, final
   owner, and read-only roster behavior.

### 2. Add the safe user-directory projection

Files:

- `src/db/schema.ts`
- new `src/server/users/` public module
- authenticated server boundaries under `lib/supabase` and `src/server/api`
- new idempotent backfill script
- server-only security SQL/verifier
- schema, security, and projection tests

Work:

1. Add the additive table and reviewed indexes.
2. Implement safe, conditional upsert from authenticated Supabase users.
3. Backfill existing membership identities in bounded batches.
4. Join the directory in member reads without exposing it outside authorized
   DTOs.
5. Provide a deterministic fallback for unresolved historical identities.

### 3. Build scalable organization list reads

Files:

- `src/server/organizations/service.ts` or focused organization read module
- `app/api/organizations/route.ts`
- `src/client/organizations.ts`
- pagination and query-performance tests

Work:

1. Add active/archive and normalized search filters.
2. Aggregate active-member counts in the list query.
3. Scope cursors to user, filter, and search to prevent cursor reuse across
   result sets.
4. Keep an active-only bounded read for the sidebar.
5. Prove pagination has no duplicates or omissions when names collide.
6. Inspect the query plan before adding the optional membership-status index.

### 4. Rebuild the organization switcher

Files:

- `components/organization-switcher.tsx`
- `components/app-sidebar.tsx`
- `components/app-sidebar-nav.tsx`
- new shared organization-avatar helper/component
- navigation and switcher component tests

Work:

1. Match the supplied trigger/dropdown styling and states.
2. Always render empty, placeholder, selected, loading, and open states.
3. Render active organizations, deterministic avatars, and selected check.
4. Add create and manage actions with separators/icons.
5. Ensure organization selection navigates to the dashboard without persisting
   independent active state.
6. Verify keyboard navigation, focus restoration, truncation, and screen-reader
   labels.

### 5. Rebuild organization management with infinite scroll

Files:

- `app/tool/organizations/page.tsx`
- new client management-list components under `components/organizations/`
- `src/client/organizations.ts`
- organization messages in German and English
- page/component/API tests

Work:

1. Implement the reference header, search field, create CTA, bordered list,
   rows, counts, and kebab menus.
2. Keep active and archived result streams/cursors independent.
3. Debounce search and reset both cursors when it changes.
4. Use `IntersectionObserver` with deduplication, abort, retry, and accessible
   fallback behavior.
5. Make active rows links and archived rows non-links.
6. Derive visible actions from server-authorized role/capability data.
7. Render localized empty, no-result, loading, error, archived, and success
   notices.

### 6. Add atomic edit modal and archive/restore dialogs

Files:

- new organization settings read/command service
- new settings API route
- `src/client/organizations.ts`
- new modal/dialog components under `components/organizations/`
- existing AI-provider policy form, refactored into reusable fields
- `components/ui/dialog.tsx` or existing sheet primitives where appropriate
- service, API, concurrency, audit, and UI tests

Work:

1. Fetch combined settings when the edit modal opens.
2. Compose master-data fields, shared country selector, and AI policy fields.
3. Implement the composite ETag and atomic transaction.
4. Keep the modal open with localized field/global errors on failure.
5. Refresh affected row/switcher data and close with a success notice on
   success.
6. Add owner-only archive confirmation and restore actions.
7. Revalidate management, sidebar, organization, and settings paths after
   mutations.
8. Adapt the modal to a full-height mobile sheet with sticky actions.

### 7. Redesign organization creation and shared country selection

Files:

- `app/tool/organizations/new/page.tsx`
- `components/organizations/organization-create-form.tsx`
- new localized country data/selector module
- `lib/i18n/messages/organizations.ts`
- creation, localization, and country-selector tests

Work:

1. Build the supplied full-width card/form layout.
2. Maintain one canonical ISO alpha-2 code list and localize labels with
   `Intl.DisplayNames`, with deterministic fallback labels.
3. Reuse the selector in the edit modal.
4. Preserve guest-claim and `next=assessment` behavior exactly.
5. Add pending/error/success semantics without changing create idempotency.

### 8. Complete member and invitation management

Files:

- `app/tool/organizations/[organizationId]/settings/team/page.tsx`
- `components/organizations/organization-invite-panel.tsx`
- new roster and invitation-section components
- membership/invitation API routes already present
- `src/client/organizations.ts`
- member/invitation messages and tests

Work:

1. Load member identities, permissions, and pending/history invitations.
2. Render read-only roster mode for members/auditors.
3. Add owner/admin role and status controls.
4. Add owner-only ownership controls and final-owner explanations.
5. Wire resend, revoke, suspend, reactivate, and self-leave through feature
   client methods.
6. Preserve versions after each mutation so subsequent `If-Match` requests use
   current values.
7. Use confirmation dialogs for suspension, ownership changes, and leave where
   impact warrants it.
8. Render responsive member cards on narrow screens.

### 9. Guard archived routes and replace settings page

Files:

- `app/tool/organizations/[organizationId]/layout.tsx`
- `app/tool/organizations/[organizationId]/settings/page.tsx`
- obsolete settings-only components after reuse is extracted
- localized navigation/settings messages
- route/layout tests

Work:

1. Detect `archivedAt` in the shared organization layout.
2. Redirect archived workspace URLs to management with a safe notice.
3. Do not block the archive/restore API path needed by management.
4. Replace the settings contents with the agreed placeholder and management
   link.
5. Remove the facts/framework UI and dead imports without deleting underlying
   organization-fact persistence or APIs.

### 10. Cross-surface polish and documentation

Files:

- affected loading skeletons
- organization product/architecture docs
- API route inventory if the combined settings route is added
- this plan's implementation record

Work:

1. Align spacing, colors, borders, typography, icons, overlay, and responsive
   states with the references using existing design tokens where possible.
2. Verify German and English copy and eliminate current encoding regressions in
   touched organization messages.
3. Document organization archival visibility, owner governance, user-directory
   privacy, and atomic settings semantics.
4. Record final verification and any deliberate visual deviations.

## Delivery Sequence

Use independently reviewable slices:

1. contracts and permission tests;
2. additive user directory, security, and backfill;
3. list query/search/count/pagination;
4. switcher and shared avatar;
5. management list and infinite scroll;
6. atomic settings API and edit modal;
7. archive/restore UX and archived route guard;
8. creation page and shared country selector;
9. member/invitation management;
10. settings placeholder, responsive/accessibility polish, and documentation.

Do not combine the schema rollout with unrelated compliance schema changes.
Do not modify or discard pre-existing documentation work in the current
worktree.

## Verification

### Focused automated coverage

Add or extend tests for:

- role-to-capability mapping;
- owner-only archive/restore;
- owner-only ownership transitions;
- final-owner concurrency;
- user-directory schema, safe projection, backfill idempotency, and grants;
- organization list filtering, search, counts, stable cursors, and query count;
- switcher empty/selected/action states;
- infinite-scroll deduplication, reset, abort, retry, and fallback;
- atomic settings success, no-op, validation, stale organization version, stale
  policy version, rollback, and audit events;
- archive/restore list movement and path revalidation;
- archived workspace redirect;
- localized country selector and ISO-code persistence;
- preserved create/assessment/guest-claim redirects;
- read-only versus managed roster controls;
- invitation resend/revoke/history; and
- German/English dictionary completeness.

Run at minimum:

```powershell
npm.cmd run verify
npm.cmd run build
```

Run focused Playwright coverage for:

1. zero-organization switcher to creation;
2. switch organization from the dropdown;
3. search and infinite-scroll management results;
4. edit master data and AI policy in one save;
5. owner archive, archived direct-route redirect, and restore;
6. admin denial for archive and owner governance;
7. member/auditor read-only roster;
8. invitation resend/revoke and member lifecycle; and
9. mobile creation, edit sheet, and member cards.

### Database verification

Without a reset:

1. inspect the intended database target;
2. apply the reviewed additive schema;
3. apply and verify server-only grants/RLS;
4. run the directory backfill;
5. verify every active membership resolves either a safe identity or the
   explicit fallback;
6. verify active-member counts against direct SQL; and
7. run relevant application smoke tests.

If the guarded clear/reseed fallback is used, complete every verification,
publication, activation, storage, and smoke step in the repository runbook
before declaring the feature complete.

## Acceptance Criteria

- The switcher matches the reference states and never disappears.
- Context-free routes do not persist or imply an active organization.
- The switcher excludes archived organizations.
- The management page searches all accessible organizations rather than a
  first-page subset.
- Infinite scroll produces no duplicate or missing rows and has an accessible
  recovery path.
- Active-member counts exclude suspended users and all invitations.
- Active rows open; archived rows do not.
- Only owners can archive/restore and manage ownership.
- Administrators can manage non-owner members but cannot affect owners.
- Members/auditors can discover and read the roster without mutation controls.
- The final active owner invariant remains safe under concurrent requests.
- “Organisation löschen” archives with confirmation and preserves data.
- Archived workspace URLs redirect to management until restoration.
- Master data and AI policy save atomically with concurrency protection.
- Facts/framework UI is removed without deleting persisted fact data.
- The old settings page is a localized placeholder linking to management.
- Country selection covers all ISO countries and persists alpha-2 codes.
- Existing creation redirect and guest-claim flows remain intact.
- Member identity comes only from the server-owned safe directory projection.
- Invitation resend/revoke/history and self-leave work with localized feedback.
- Desktop, tablet, mobile, keyboard, and screen-reader states are covered.
- German and English i18n checks, verification, build, and focused E2E tests
  pass.

## Non-Goals

- Persisting a last-active organization.
- Adding organization logos or user-selected avatar colors.
- Permanently erasing an organization or its compliance history.
- Exposing archived workspaces before restoration.
- Editing assessment-derived organization facts from organization management.
- Changing the fixed compliance framework or country-eligibility policy.
- Deleting organization-fact persistence or its server APIs.
- Redesigning unrelated compliance modules or the global navigation order.

## Implementation Record

Implemented on 25 July 2026 in the delivery slices described above.

- Added owner-only archival and owner-governance capabilities, searchable
  status-specific organization list contracts, active-member aggregation, and
  search-scoped opaque cursors.
- Added the server-only `user_directory` projection, authenticated-boundary
  synchronization, idempotent Admin API backfill, grant verification, and
  localized-safe roster fallback.
- Rebuilt the always-visible switcher, active/archived management streams,
  atomic edit modal, archive/restore dialogs, country selection, creation
  layout, responsive roster, invitation queue/history, and settings
  placeholder.
- Added the shared archived-workspace redirect and retained the existing
  creation, applicability, and guest-claim redirects.
- Applied the additive user-directory SQL to the approved disposable
  development Supabase project without a clear or reseed. The final backfill
  projected three identities with zero missing Auth identities. Server-only
  verification covered all 123 public tables.
- Direct database smoke verification found six active memberships, zero
  fallback identities, and one archived organization (the retained E2E
  archival fixture).
- The optional composite membership-status index was deliberately not added:
  it is not a functional dependency, the development dataset did not provide
  evidence of a material query-plan improvement, and the existing status and
  organization/user indexes remain in place.

Final verification:

```text
npm.cmd run verify
  87 test files passed
  483 tests passed
  i18n guard passed

npm.cmd run build
  production build passed

RUN_ORGANIZATION_E2E=1 PLAYWRIGHT_PORT=3100 npm.cmd run test:e2e -- e2e/organization-management.spec.ts
  1 serial Chromium scenario passed
  covered zero-state creation, mobile creation, switcher navigation, search,
  atomic edit, resend/revoke, administrator denials, auditor read-only roster,
  self-leave, final-owner protection, archive redirect, and restore
```
