# Organizations (Multi-Tenancy)

> Status: current as of 9 September 2026.

## The tenant model

An organization is the tenant boundary of the application. All compliance
data — applicability results, documents, Gap revisions, Action Plans, and
reports — belongs to exactly one organization, and every query is scoped by
it.

- `organizations` stores identity, country, AI provider mode, and archive
  state.
- `organization_memberships` is existence-based: a user's role in an
  organization is the row itself.
- `organization_invitations` holds only pending invitations (hashed tokens,
  expiry); rows are deleted when accepted, revoked, or expired.
- `user_profiles` mirrors minimal user display data.

## Organization lifecycle

1. A signed-in user creates an organization and becomes `owner`.
2. Owners invite members by email; invitees accept and gain their role.
3. Members can be promoted/demoted within assignable roles
   (`contributor`, `viewer`) and removed. At least one owner must remain;
   self-leave is allowed for non-owners (and owners with another owner
   present).
4. An organization can be **archived**, never deleted. Archive blocks access
   and workflows; restore reverses it.

## Settings and AI configuration

- `organization_model_settings` records the organization's chosen generation
  and embedding models, including thinking style and embedding identity
  (dimensions, instruction profile). This is what selects the browser relay
  for `self_hosted` organizations.
- Changing the embedding model starts a resumable
  `organization_reembedding` migration
  (`src/server/modules/organizations/embedding-migration-service.ts`), tracked in
  `organization_embedding_migrations`, so documents are re-embedded into the
  new vector space without mixing spaces.

## Progress read model

`src/server/modules/organizations/progress-read-model.ts` maintains a per-organization progress
view (applicability done, gap current, action plan state) used by the
dashboard and workflow gates (`GET /api/organizations/:id/progress`).

The richer dashboard read model lives in
`src/server/modules/organizations/dashboard-read-model.ts`:

- `GET /api/organizations/:id/dashboard` returns the current applicability,
  Gap, evidence, Action Plan, and latest-report summaries, three workflow
  steps, suggested next steps, four recent activity items, and current-year
  progress history.
- `GET /api/organizations/:id/dashboard/activity` returns relevant
  `audit_events` using organization-scoped signed-cursor pagination.
- `GET /api/organizations/:id/dashboard/progress-history` reconstructs monthly
  points and milestones from audit events. The default range is the current
  year, only `month` buckets are supported, and a requested range may span at
  most two years.

Dashboard progress is a rounded average of applicability, Gap, and Action
Plan progress. A completed applicability revision contributes 100%; Gap uses
required questionnaire completion until a Gap revision exists; Action Plan
progress counts `done` items fully and `in_progress` items halfway, excluding
cancelled items. An accepted `not_directly_in_scope` applicability result
short-circuits all three components to 100%.

## Workflow permissions

Actions map to capabilities by role (`src/server/modules/organizations/workflow-permissions.ts`
and `src/server/platform/auth/capabilities.ts`): e.g., starting Action Plan generation
requires `plans:manage` (owner/contributor), reading audit requires
`audit:read` (owner/viewer). Expensive commands additionally verify the
workflow state (applicability done, Gap current and unblocked) before
enqueueing.

## Practical navigation

- Service: `src/server/modules/organizations/`.
- Settings: `src/server/modules/organizations/settings-service.ts`.
- Model settings: `src/server/modules/organizations/model-settings-service.ts`.
- Embedding migration: `src/server/modules/organizations/embedding-migration-service.ts`.
- Progress: `src/server/modules/organizations/progress-read-model.ts`.
- Dashboard: `src/server/modules/organizations/dashboard-read-model.ts`,
  `src/server/modules/organizations/dashboard-progress.ts`.
- Routes: `app/api/organizations/`, `app/api/organization-invitations/`.

