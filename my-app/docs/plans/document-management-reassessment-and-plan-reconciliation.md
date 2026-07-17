# Document Management, Gap Reassessment, and Plan Reconciliation

Status: product decisions confirmed and application implementation completed on
2026-07-17. Ordinary schema rollout uses `src/db/schema.ts` and the existing
`db:push` workflow; resetting the configured database is an explicit operator step.

This is the historical design and implementation plan. For the deployed user
sequence and known runtime limitations, use
[Current Gap-Analysis Workflow](../product/gap-analysis-current-workflow.md).

## Outcome

Create an organization-wide document-management workflow and a non-destructive
reassessment lifecycle that:

1. keeps document administration out of the main Gap-Analyse page;
2. lets users upload new documents and versions from a shared document library;
3. shows whether each immutable document version is unassessed, used by a
   reassessment draft, used by an approved Gap-Analyse, or indirectly supports
   the active Maßnahmenplan;
4. persists one shared reassessment draft per organization and active gap
   assessment;
5. requires explicit confirmation before AI generation;
6. preserves the accepted Gap-Analyse and active Maßnahmenplan while a new
   candidate is generated and reviewed;
7. reconciles a newly approved gap result with existing operational plan data;
8. never silently discards owners, due dates, statuses, completed work, or
   historical evidence; and
9. activates a reconciled plan atomically only after every required human
   decision is complete.

This plan extends the implemented evidence and action-plan foundation described
in [Gap Analysis, Evidence, and Action Plan](./gap-analysis-evidence-and-action-plan.md).
The current runtime behavior is documented in
[Current Gap-Analysis Workflow](../product/gap-analysis-current-workflow.md).

## Confirmed Product Decisions

- Documents belong to an organization-wide library, not exclusively to one
  Gap-Analyse page.
- The Gap-Analyse page retains a compact document picker and upload entry point
  backed by the same document module as the library.
- Uploading a document or version does not automatically stale an approved gap
  result, change a Maßnahmenplan, or spend AI tokens.
- New evidence is labeled as available but not yet assessed.
- A user prepares a reassessment from the document library; this action does
  not immediately call AI.
- The reassessment starts with the previously approved evidence set, replaces
  superseded versions with current versions, and adds the newly selected
  versions. The complete evidence set is shown for confirmation.
- The reassessment uses the latest saved questionnaire revision and reevaluates
  every applicable requirement in the pinned release.
- Prepared evidence selection persists across sessions and is visible to
  authorized organization members.
- Only one shared reassessment draft may be open for the active gap assessment.
- Starting generation locks the exact questionnaire and document-version
  inputs. Later evidence creates the next draft rather than mutating a generated
  result.
- The accepted gap revision and active Maßnahmenplan remain authoritative and
  editable while a candidate gap revision is generated, reviewed, or awaiting
  approval.
- Owners/admins approve candidate gap revisions. Approval makes a plan update
  available but does not immediately replace the active plan.
- Plan reconciliation is a complete persisted draft. The old plan remains
  active until every required decision is complete and an owner/admin activates
  the new plan.
- Exact requirement versions carry plan data automatically. A changed version
  with the same stable requirement identity requires confirmation.
- A newly fulfilled finding proposes closure; it never closes an item
  automatically.
- A completed item whose gap remains is marked as effectiveness not confirmed;
  an owner/admin chooses whether to reopen it or create a follow-up.
- New gaps create proposed open items. Removed requirements remain visible as
  legacy measures until explicitly closed or cancelled.
- Members, admins, and owners may prepare and generate reassessments. Only
  owners/admins may approve gap results, decide reconciliation conflicts, and
  activate a reconciled plan. Auditors remain read-only.

## Historical Baseline Replaced By This Implementation

### Documents

The current Gap-Analyse page loads every organization document, renders upload,
archive, and evidence-selection controls inline, and keeps the selected version
IDs only in client state. The document upload module always creates a new
document with version number 1 even though the schema already supports multiple
versions and a current-version pointer.

Consequences:

- users cannot manage evidence independently of Gap-Analyse;
- a current document cannot receive a new version through the application;
- evidence selection is lost across navigation and sessions;
- selection is not a shared organization workflow; and
- the page does not distinguish approved use, candidate use, and plan use.

### Accepted and Working Gap Revisions

`generated_artifacts.current_revision_id` currently points to the newest
generated, reviewed, or approved gap revision. Generating a candidate therefore
replaces the read pointer even while the previous approved revision remains the
accepted business result. `getCurrentApprovedGapRevision` only checks the
current pointer, so it stops returning the previous approved revision while a
candidate is awaiting approval.

The new workflow must represent or reliably derive both:

- the latest working/candidate revision; and
- the currently accepted approved revision.

### Maßnahmenplan Replacement

The current generation module archives the existing plan and creates a new
baseline. It does not carry item owners, due dates, statuses, or completed work.
Approval of a new gap revision marks the active plan stale immediately.

The new workflow must preserve the active plan during reassessment and replace
direct regeneration with explicit reconciliation.

## Product State Model

```text
approved gap revision A
+ active plan A
        |
        | upload documents or new versions
        v
new evidence available (approved snapshot unchanged)
        |
        | prepare shared reassessment draft
        v
open draft -> locked for generation -> candidate gap revision B
                                      -> failed run / explicit retry
        |
        | owner/admin review and approval
        v
approved gap revision B + plan update available
+ active plan A remains editable
        |
        | prepare and decide complete reconciliation
        v
draft plan B ready for activation
        |
        | owner/admin activates atomically
        v
active plan B + historical read-only plan A
```

Document usage labels are separate projections of these states:

- `not_assessed`;
- `used_in_open_draft`;
- `used_in_candidate_revision`;
- `used_in_approved_revision`; and
- `supports_active_plan`.

They should be derived from pinned sources and workflow state rather than stored
as mutable flags on documents.

## Module Design and Seams

Keep route handlers and page components shallow. Put lifecycle invariants behind
four deep modules whose interfaces are also their primary test surfaces.

### 1. Organization Document Library Module

Interface responsibilities:

- list organization documents, immutable versions, processing state, and
  derived usage labels;
- create a new document and first version;
- add a version to an existing active document;
- archive a document; and
- return version choices suitable for reassessment preparation.

Implementation responsibilities hidden behind the interface:

- organization permissions;
- safe version-number allocation and current-version updates;
- private storage paths and cleanup;
- extraction, chunking, embeddings, and processing failures;
- immutable hashes and source metadata;
- usage projection joins; and
- audit events.

Reuse the current parser, chunker, embedding, and storage implementations as
internal seams. Do not expose storage or embedding configuration to page
callers.

### 2. Gap Reassessment Module

Interface responsibilities:

- get or prepare the one open reassessment draft;
- update its selected evidence versions while it is open;
- return a confirmation summary of base revision, questionnaire revision,
  release, changed evidence, and requirement count;
- lock the draft and start generation; and
- explicitly retry a failed locked input.

Implementation responsibilities hidden behind the interface:

- seed selection from the accepted revision;
- replace superseded selected versions with current versions;
- merge explicit additions and removals;
- validate organization ownership and successful indexing;
- enforce one-open-draft and optimistic concurrency invariants;
- pin the latest saved questionnaire revision;
- lock inputs before the remote AI call;
- invoke the existing retrieval/generation implementation; and
- link the draft, AI run, and generated candidate revision.

The external AI provider remains a true-external adapter at an internal seam.
Tests use the existing fake model and embedding adapters through the
reassessment module's interface.

### 3. Gap Analysis Read Model

Provide one interface that returns the complete workflow state needed by the
Gap-Analyse and document pages:

- accepted approved revision;
- working candidate revision and run state;
- open or locked reassessment draft;
- selected and changed evidence;
- document usage projections;
- review blockers;
- plan-update availability; and
- source/release staleness.

This replaces page-specific joins and prevents different screens from assigning
different meanings to “current,” “approved,” or “included.”

### 4. Action Plan Reconciliation Module

Interface responsibilities:

- prepare or open the reconciliation draft for a newly approved gap revision;
- return deterministic item matches and required decisions;
- record one owner/admin decision with a reason where required;
- report whether the reconciliation is ready; and
- atomically activate the reconciled plan.

Implementation responsibilities hidden behind the interface:

- match findings through stable requirement identity and exact versions;
- carry operational fields without overwriting the immutable new baseline;
- classify unchanged, new, fulfilled, still-open, changed-version, and removed
  requirements;
- enforce the confirmed decision matrix;
- create predecessor/successor item lineage;
- validate complete decisions;
- switch the active plan transactionally; and
- preserve history and audit events.

Keep the deterministic comparison pure and in-process. Test it directly through
the reconciliation module's interface with table-driven scenarios. Database
persistence is local-substitutable and should be verified through the module
with the repository's database test adapter rather than mocked query-by-query.

## Implemented Schema Shape

Names are provisional, but the responsibilities and invariants are required.

### Stable Requirements

Add a stable requirement identity above immutable versions:

```text
gap_requirements
  id
  code unique
  created_at

gap_requirement_versions
  requirement_id -> gap_requirements.id
  version_label
  ...existing immutable content...
```

Change uniqueness from `(code, version_label)` to
`(requirement_id, version_label)`. Keep the code snapshot where useful for
exports, but matching must use the stable foreign key. Publication must prevent
code reuse for unrelated requirements.

### Accepted Gap Revision Pointer

Add `accepted_revision_id` to `generated_artifacts`, referencing an approved
revision belonging to the same artifact. Keep `current_revision_id` as the
working/latest pointer.

Invariants:

- candidate generation changes only `current_revision_id`;
- approval transactionally sets `accepted_revision_id` to the approved current
  revision;
- an accepted revision must have status `approved`; and
- readers of the authoritative result and active-plan source use the accepted
  pointer, not the working pointer.

This could be derived by querying revision history, but an explicit accepted
pointer gives the product concept one enforced source of truth and avoids
ambiguous “latest approved” races.

### Reassessment Drafts

```text
gap_reassessment_drafts
  id
  organization_id
  assessment_id
  gap_analysis_release_id
  base_accepted_gap_revision_id nullable
  assessment_revision_id
  status: open | locked | generated | failed | cancelled
  lock_version
  ai_processing_run_id nullable
  output_gap_revision_id nullable
  created_by
  created_at
  updated_at
  locked_at nullable
  completed_at nullable

gap_reassessment_draft_documents
  draft_id
  document_version_id
  selection_origin: approved_carryover | version_replacement | explicit_addition
  selected_by
  selected_at
```

Required constraints:

- at most one draft with `status=open` per active assessment; locked, failed,
  generated, and cancelled history may coexist with the next open draft;
- unique document version per draft;
- every selected version belongs to the draft organization;
- only successfully indexed, non-archived current versions may be newly added;
- locked/generated inputs cannot be edited;
- the output revision and AI run must use the same pinned assessment and
  evidence sources; and
- all state transitions are audited.

Use optimistic concurrency through `lock_version` or an equivalent compare-and-
swap value so two members cannot silently overwrite each other's selection.
Lock again transactionally before generation.

### Action Plan Revisions

Extend `action_plans` so every plan row is an explicit revision:

```text
action_plans
  revision_number
  predecessor_plan_id nullable
  status adds draft_reconciliation and superseded
  activated_by nullable
  activated_at nullable
```

Retain exactly one `active` plan per organization. A draft reconciliation must
not displace it. Activation transactionally changes the previous plan to
`superseded` and the draft to `active`.

Do not use `stale` to mean “unusable.” Derive `update_available` when the
accepted gap revision is newer than the active plan's source. Existing stale
source warnings may remain separate for archived or superseded evidence.

### Reconciliation and Item Lineage

```text
action_plan_reconciliations
  id
  organization_id
  source_plan_id
  target_plan_id
  source_gap_revision_id
  target_gap_revision_id
  status: draft | ready | applied | cancelled
  created_by
  created_at
  applied_by nullable
  applied_at nullable

action_plan_item_reconciliations
  id
  reconciliation_id
  stable_requirement_id
  previous_item_id nullable
  target_item_id nullable
  previous_finding_id nullable
  target_finding_id nullable
  change_kind
  proposed_decision
  decided_decision nullable
  reason nullable
  decided_by nullable
  decided_at nullable

action_plan_items
  predecessor_item_id nullable
```

Suggested `change_kind` values:

- `unchanged_gap`;
- `new_gap`;
- `proposed_closure`;
- `effectiveness_not_confirmed`;
- `requirement_version_changed`; and
- `requirement_removed`.

Suggested decisions:

- `carry_over`;
- `close`;
- `reopen`;
- `create_follow_up`;
- `keep_legacy`; and
- `cancel`.

The reconciliation row is the durable record of the proposal and human choice.
Audit events remain the append-only activity history; do not hide business state
only inside audit JSON.

## Reconciliation Rules

| Old item / new finding                                             | Default proposal                         | Human decision required         | Operational fields                  |
| ------------------------------------------------------------------ | ---------------------------------------- | ------------------------------- | ----------------------------------- |
| Same exact requirement version; gap remains; item open/in progress | Carry over                               | No                              | Preserve status, owner, due date    |
| Same exact version; new finding is fulfilled                       | Close                                    | Yes                             | Preserve until closure confirmed    |
| Item done; new finding still open                                  | Effectiveness not confirmed              | Yes: reopen or follow-up        | Preserve completion history         |
| Item cancelled; new finding still open                             | New follow-up                            | Yes                             | Do not silently revive cancellation |
| Same stable requirement; version changed                           | Carry over with changed-baseline warning | Yes                             | Preserve only after confirmation    |
| New stable requirement with open finding                           | Create new item                          | No unless policy later requires | New open item, no owner/date        |
| Requirement removed from release                                   | Keep legacy                              | Yes: keep, close, or cancel     | Preserve complete old item          |
| New finding fulfilled and no previous item                         | No item                                  | No                              | None                                |

The new plan baseline always uses the newly approved finding and requirement for
title, recommendation, priority, and `source_finding_id`. Carried operational
fields are status, owner, and due date. Historical baseline text is preserved on
the predecessor item, not copied over the new baseline.

## Application Surfaces

### Document Management Page

Add:

```text
/tool/organizations/[organizationId]/documents
```

Minimum controls:

- list/search active and archived documents;
- expand immutable version history and processing state;
- upload a new document;
- upload a new version of an existing document;
- archive a document;
- show derived approved/candidate/plan usage labels;
- multiselect eligible versions;
- prepare/open the shared reassessment draft; and
- navigate to Gap-Analyse confirmation without calling AI.

Use one shared document uploader, version list, usage badge, and evidence picker
module from both the document and Gap-Analyse pages. The route decides layout;
it must not reimplement workflow rules.

### Gap-Analyse Page

Present explicit stages:

1. questionnaire source;
2. evidence preparation;
3. confirmation and generation;
4. candidate findings and review; and
5. accepted result.

Show accepted and candidate states separately. The accepted result remains
visible while the candidate is reviewed. Before generation, show:

- base approved revision;
- latest saved questionnaire revision;
- carried, replaced, added, and removed evidence;
- complete selected version set;
- number of applicable requirements to reassess; and
- an explicit token-spending generation button.

### Maßnahmenplan Page

Keep the active plan fully editable while an update is available. Add:

- an update-available banner linked to the newly approved gap revision;
- reconciliation summary and item change groups;
- evidence/finding context for proposed closure and effectiveness conflicts;
- decision and reason controls for owners/admins;
- readiness validation; and
- one explicit activation control.

After activation, show the predecessor plan as read-only history.

## Server Routes

Exact HTTP shapes may follow existing conventions, but route handlers must call
the deep module interfaces rather than coordinate lifecycle rules themselves.

Expected route families:

```text
GET/POST  /api/organizations/[organizationId]/documents
POST      /api/organizations/[organizationId]/documents/[documentId]/versions
POST      /api/organizations/[organizationId]/documents/[documentId]/archive

GET/POST  /api/organizations/[organizationId]/gap-analysis/reassessment
PATCH     /api/organizations/[organizationId]/gap-analysis/reassessment/evidence
POST      /api/organizations/[organizationId]/gap-analysis/reassessment/generate
POST      /api/organizations/[organizationId]/gap-analysis/reassessment/retry

GET/POST  /api/organizations/[organizationId]/action-plan/reconciliation
PATCH     /api/organizations/[organizationId]/action-plan/reconciliation/items/[itemId]
POST      /api/organizations/[organizationId]/action-plan/reconciliation/activate
```

Generation should accept the reassessment draft ID, not an arbitrary client-only
array as the authoritative input. The server reads and locks the persisted
selection, then passes exact version IDs to retrieval/generation.

## Permissions

| Capability                           | Owner/Admin | Member | Auditor |
| ------------------------------------ | ----------- | ------ | ------- |
| Read documents, versions, usage      | Yes         | Yes    | Yes     |
| Upload document/version              | Yes         | Yes    | No      |
| Archive document                     | Yes         | Yes    | No      |
| Prepare/edit open reassessment draft | Yes         | Yes    | No      |
| Generate/retry reassessment          | Yes         | Yes    | No      |
| Review evidence and candidate result | Yes         | Yes    | Yes     |
| Correct/approve candidate result     | Yes         | No     | No      |
| Edit active plan items               | Yes         | Yes    | No      |
| Decide reconciliation conflicts      | Yes         | No     | No      |
| Activate reconciled plan             | Yes         | No     | No      |

Continue enforcing permissions in server modules and restrictive database
policies. The UI is not an authorization boundary.

## Concurrency and Failure Rules

- Use a partial unique index or equivalent invariant for one open draft per
  active assessment.
- Evidence updates use optimistic concurrency and return a conflict rather than
  silently dropping another member's selection.
- Generation transactionally locks the draft before the remote call.
- A generation failure preserves the locked input and durable failed run;
  explicit retry uses the same inputs and a new retry nonce.
- Changing evidence after a failed locked generation creates the next draft;
  it does not rewrite the failed run.
- Adding a document version allocates the next version and updates
  `documents.current_version_id` transactionally.
- Plan activation locks the source active plan and target reconciliation,
  revalidates readiness, and switches active status in one transaction.
- If the active plan or accepted gap revision changed since reconciliation was
  prepared, activation fails with a conflict and must be recomputed.
- No upload, indexing completion, candidate generation, or approval silently
  spends another AI call beyond the explicitly requested generation/retry.

## Database Rollout

Existing application data is disposable for this implementation. Do not create
feature-specific migration or backfill SQL. `src/db/schema.ts` is the sole source
of truth for ordinary tables, columns, enums, foreign keys, checks, indexes, and
RLS enablement introduced by this feature.

1. An operator explicitly authorizes and runs the guarded database clear.
2. Apply the final Drizzle schema with `npm.cmd run db:push`.
3. Keep the pre-existing Supabase SQL scripts `001` through `004` unchanged and
   run them only through their existing documented operational sequence.
4. Republish and activate the required releases and seed/demo content.
5. Run consistency, RLS, permission, and workflow smoke checks before enabling
   the new routes and UI.

The accepted-revision ownership and approval invariants are enforced by the
transactional server approval boundary and focused verification. This feature
does not add custom SQL triggers or a Drizzle migration journal.

## Implementation Phases

### Phase 1: Schema and invariants

1. Add stable requirements and link requirement versions in the final schema.
2. Add the accepted gap-revision pointer and migrate authoritative readers.
3. Add reassessment draft and draft-document tables with state constraints.
4. Add plan revision, reconciliation, decision, and item-lineage schema.
5. Add indexes, RLS enablement, Drizzle relations, schema checks, and audit
   event types.

Do not change the UI until current approved-result and active-plan reads are
green through the new interfaces.

### Phase 2: Document library module

1. Refactor current document creation/indexing behind the document-library
   interface.
2. Add safe version upload and current-version changes.
3. Add the usage projection for approved, candidate, draft, and plan states.
4. Add organization document routes and page.
5. Replace the large inline Gap-Analyse document block with shared compact
   controls only after parity tests pass.

### Phase 3: Reassessment module

1. Implement open-draft creation seeded from accepted evidence.
2. Implement replacement of superseded versions and explicit add/remove rules.
3. Add optimistic evidence updates and confirmation summaries.
4. Change generation to consume and lock a draft.
5. Preserve accepted and candidate revisions simultaneously in the read model.
6. Add explicit failed-input retry and next-draft behavior.

### Phase 4: Reconciliation module

1. Implement the pure stable-requirement comparison and decision matrix.
2. Prepare draft plans without changing the active plan.
3. Copy allowed operational values and create predecessor item links.
4. Persist proposed and decided reconciliation records.
5. Implement readiness checks and atomic activation.
6. Replace direct archive-and-regenerate behavior after regression coverage is
   green.

### Phase 5: Workflow UI

1. Add document usage labels, multiselect, and reassessment preparation.
2. Present accepted and candidate gap states separately.
3. Add confirmation details and explicit generation language.
4. Add plan update, reconciliation decisions, and activation UI.
5. Add read-only historical plan navigation.
6. Put every user-facing label in the dictionary with proper German umlauts.

### Phase 6: Schema verification and rollout

1. After explicit operator approval, clear and recreate the configured database
   through the existing guarded `db:clear` and `db:push` workflow.
2. Test recreated active plans with populated owner, due date, and status fields.
3. Run end-to-end permission and concurrency scenarios.
4. Confirm default tests make no external AI calls.
5. Run an opt-in live document/reassessment pass only when explicitly enabled.
6. Update the current-workflow documentation after deployment.

## Test Strategy

### Deterministic module tests

- evidence carry-forward, version replacement, explicit addition/removal, and
  complete-set confirmation;
- one-open-draft invariant and optimistic update conflicts;
- locked-input immutability and failed retry behavior;
- accepted revision remains authoritative during candidate generation/review;
- all applicable requirements are reevaluated;
- document usage projections for every state;
- reconciliation matrix for open, in-progress, done, cancelled, fulfilled,
  still-open, new, changed-version, and removed requirements;
- operational field carry-over and immutable baseline replacement;
- readiness requires every conflict decision; and
- activation switches plans atomically and preserves predecessor history.

### Database integration tests

- organization scope and role permissions for every new table/module interface;
- foreign keys prevent cross-organization document/draft/reconciliation links;
- stable requirement and revision uniqueness;
- one active plan and one open draft under concurrent requests;
- add-version number allocation under concurrency;
- accepted/current pointer invariants;
- activation rollback on conflicts; and
- fresh-schema action plans preserve every carried item value during reconciliation.

### Route and UI tests

- document library upload/version/archive and usage states;
- shared document controls behave consistently on both pages;
- document-page preparation does not call AI;
- generation requires final confirmation;
- accepted result and active plan remain visible/editable during reassessment;
- member, owner/admin, and auditor controls match server permissions;
- reconciliation cannot activate with unresolved decisions; and
- historical plan is read-only after activation.

### Regression verification

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd vitest run tests evals
npm.cmd run test:ai
npm.cmd run build
```

Database reset and schema push remain explicit operator steps. When authorized,
also run gap release publication/activation, the pre-existing Supabase setup,
and database smoke tests using the existing operational sequence.

## Acceptance Criteria

- A general organization document page supports new documents, immutable
  versions, archive behavior, processing state, and derived usage labels.
- The Gap-Analyse page uses the same document module without duplicating
  lifecycle logic.
- New evidence never automatically changes an approved result or active plan.
- Multiselect creates or updates one persisted shared reassessment draft without
  calling AI.
- The draft starts from approved evidence, replaces superseded versions, and
  shows the full final selection before generation.
- Generation locks exact inputs and reevaluates every applicable requirement.
- Accepted and candidate gap revisions are simultaneously available and cannot
  be confused by readers.
- The active plan remains editable until a complete reconciled successor is
  explicitly activated.
- No populated owner, due date, status, or completion history is silently lost.
- Proposed closure and effectiveness conflicts require owner/admin decisions.
- Changed requirement versions require confirmed carry-over; new and removed
  requirements follow the agreed rules.
- Reconciliation activates atomically and retains the predecessor plan and item
  lineage as read-only history.
- Default automated tests use fake AI adapters and spend no external tokens.
- All material upload, draft, generation, approval, reconciliation, and
  activation actions are audited.

## Deferred

- OCR, scanned PDFs, image evidence, and complex table extraction;
- AI classification of documents or automatic requirement assignment;
- partial per-requirement reassessment or mixed-date approved artifacts;
- automatic AI calls triggered by upload or indexing;
- automatic closure, reopening, or plan activation without human confirmation;
- multiple competing open reassessment drafts for one assessment;
- permanent document erasure administration;
- comments, notifications, and task-assignment workflows beyond existing owner
  and due-date fields; and
- a complete legally reviewed NIS2 requirement catalog.

## Implementation References

- [Current document module](../../src/server/documents/service.ts)
- [Current gap generation module](../../src/server/gap-analysis/generation-service.ts)
- [Current gap read model](../../src/server/gap-analysis/workflow-reader.ts)
- [Current staleness calculation](../../src/server/gap-analysis/staleness.ts)
- [Current review and approval module](../../src/server/gap-analysis/review-service.ts)
- [Current action-plan module](../../src/server/action-plans/service.ts)
- [Current database schema](../../src/db/schema.ts)
- [Current Gap-Analyse UI](../../components/gap-analysis/gap-analysis-workflow.tsx)
- [Current Maßnahmenplan UI](../../components/action-plans/action-plan-workflow.tsx)
