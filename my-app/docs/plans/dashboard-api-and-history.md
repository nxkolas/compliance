# Dashboard API and History Plan

## Status

Completed on 6 September 2026.

## Objective

Provide the organization dashboard with one complete initial read model, a
paginated activity feed, and reconstructable compliance-progress history. Wire
the current dashboard to those fields so its cards and chart no longer invent
or approximate values in the component.

## User-visible outcome

- Workflow stages distinguish locked, not-started, in-progress, completed, and
  outdated states.
- Gap progress uses required questions answered versus total required.
- Action-plan totals distinguish open, in-progress, done, and cancelled items.
- Document totals distinguish active and archived documents.
- Recent activity contains actor names and useful event details.
- The progress chart shows real historical points and a comparison delta.
- “More activity” can request additional pages without exposing the raw audit
  log.

## Progress definition

Overall progress is the rounded equal-weight average of three components:

1. Applicability: `0` until an accepted applicability revision exists, then
   `100`.
2. Gap analysis: answered required questions divided by total required while a
   questionnaire is in progress; `100` after an accepted Gap revision exists.
3. Action plan: `(done + 0.5 * in_progress) / non_cancelled_total`; `0` before a
   plan exists or when the plan has no non-cancelled items.

For a completed `not_directly_in_scope` applicability result, Gap and Action
Plan are treated as not applicable and the overall workflow is `100`.

Percentages are calculated on the server from counts. The API returns both the
counts and the rounded percentage so every consumer uses the same definition.

## API changes

### Extend the initial dashboard read

`GET /api/organizations/{organizationId}/dashboard`

Keep the existing envelope and compatible fields, and add:

- `workflow.steps[]`: key, status, updated timestamp, stale/outdated flags;
- `gap.progress`: answered, total, remaining, percentage, last-updated time;
- `plan.statuses`: open, in-progress, done, cancelled, plus percentage;
- `evidence.counts`: total, active, archived;
- `recentActivity`: the first four dashboard activity DTOs;
- `complianceProgress`: current percentage, prior percentage, delta,
  comparison label/date, chart points, and milestones.

The server-rendered organization page continues to call the same read-model
function directly; the HTTP route and browser client expose the identical
contract.

### Add paginated dashboard activity

`GET /api/organizations/{organizationId}/dashboard/activity?limit=&cursor=`

- Authorize with normal organization read access, not `audit:read`.
- Return only an allowlist of end-user dashboard events.
- Join the actor profile and return display name plus initials.
- Return an event code and structured parameters for localization, timestamp,
  entity reference, and optional destination.
- Use the existing signed cursor codec.

### Add dashboard progress history

`GET /api/organizations/{organizationId}/dashboard/progress-history?from=&to=&bucket=month`

- Validate ISO date range and a bounded range.
- Reconstruct component progress from allowlisted domain audit events.
- Return bucket-end points, milestones, current percentage, prior percentage,
  and delta.
- Default to the current calendar year and monthly buckets when query values
  are omitted.

## Event capture

Add a dashboard-safe audit event when a Gap questionnaire answer is saved. Its
metadata records the question key/position and the resulting answered/total
counts, never the selected answer text.

Enrich newly written document-upload and action-item-status events with safe
presentation data and state needed by the progress replay:

- document title for `document.uploaded`;
- item title, plan ID, previous status, and new status for
  `action_plan_item.status_changed`.

Existing applicability, Gap-generated, action-plan-created, document-upload,
report, and action-item events remain the source of milestones and activity.
No new database table or production dependency is needed.

Historical data from before deployment is best-effort: accepted workflow
milestones and action changes can be replayed from existing audit events, but
old partial Gap-questionnaire progress cannot be recovered because individual
answers were not previously recorded. The endpoint always appends an
authoritative current point.

## Affected files and components

- `src/contracts/dashboard/` for aggregate, activity, history, and query
  schemas.
- `src/server/modules/organizations/dashboard-read-model.ts` plus focused
  dashboard activity/history read helpers in the Organizations module.
- `src/server/modules/gap-analysis/questionnaire-draft-service.ts` for safe
  answer activity events.
- `src/server/modules/action-plans/action-plan.ts` and
  `src/server/modules/documents/uploads.ts` for enriched event metadata.
- `app/api/organizations/[organizationId]/dashboard/**` for the two new GET
  routes and the extended existing route.
- `src/client/dashboard.ts` for typed client methods.
- `components/dashboard/compliance-dashboard.tsx` for consuming server-derived
  counts, activity, and history.
- Dashboard, route-contract, activity, history, and mutation-service tests.
- Dashboard localization messages only where new event labels are required.

## Implementation sequence

1. Add pure progress calculation/replay functions and focused unit tests.
2. Extend dashboard contracts and query contracts.
3. Add safe Gap-answer events and enrich action/document audit metadata in the
   existing transactions.
4. Implement activity and progress-history readers using organization scope,
   actor profile joins, allowlisted events, and signed cursors.
5. Extend the aggregate dashboard read model using the same calculation and
   include the first activity page and default history.
6. Add the two thin API routes and typed client methods.
7. Wire the current dashboard component to the new server-derived values.
8. Run focused tests, typecheck, lint, i18n validation, the full test suite, and
   the production build.

## Acceptance criteria

- The initial dashboard endpoint contains all data needed by the pictured
  workflow, Gap, action-plan, document, activity, and chart widgets.
- Gap remaining/answered counts and percentages are mathematically consistent.
- Action progress applies the approved half-credit rule for in-progress items
  and excludes cancelled items.
- All three dashboard endpoints reject unauthenticated or cross-organization
  access through existing authorization behavior.
- Contributors can read dashboard activity without receiving arbitrary audit
  events.
- Activity pagination is deterministic and does not duplicate entries.
- Activity responses contain actor display names when a profile exists and a
  safe fallback otherwise.
- History points are ordered, bounded, and end at the authoritative current
  percentage.
- Existing dashboard response fields remain compatible.
- Relevant tests, typecheck, lint, i18n checks, and build pass.

## Non-goals

- Rebuilding the dashboard layout to pixel-match the mockups.
- Adding dashboard write endpoints; existing workflow commands remain the
  mutation API.
- Exposing the full audit log to contributors.
- Recovering unavailable per-question history from before event capture.
- Adding realtime subscriptions, background aggregation jobs, or a snapshot
  table before audit-event replay proves insufficient.
- Adding dependencies.

## Assumptions and unresolved decisions

- The approved equal-weight formula is the product definition for this work.
- Percentages are rounded to whole numbers for display.
- Monthly history for the current calendar year is the default chart range.
- Event labels are localized in the UI from stable event codes; the API does
  not return localized prose.
- No unresolved decision blocks implementation after plan approval.

## Risks and rollback

- Audit metadata is untyped at the database layer. Runtime parsing will ignore
  malformed or legacy metadata and fall back to generic activity labels.
- Event replay may become expensive for very old/high-activity organizations.
  The date range is bounded; add snapshots only after measurement shows replay
  is inadequate.
- Old Gap partial progress cannot be reconstructed. The current point prevents
  the dashboard from displaying stale current data.
- Rollback is code-only because the plan adds no table or migration. Newly
  written audit events remain harmless append-only records if the feature is
  reverted.

## Verification

Run the narrow tests first, then:

```powershell
npm run typecheck
npm run lint
npm run check:i18n
npm test
npm.cmd run build
```
