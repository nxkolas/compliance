# Guided Gap Analysis UX and Status Corrections

Status: implemented on 2026-07-23; automated verification recorded in the
delivery handoff. Environment-backed manual QA and release activation remain
deployment activities.

This plan replaces the current long, revision-oriented Gap-Analyse page with a
guided workflow, fixes correction failures, and separates an organization's
assessment status from the amount of documentary support. It preserves the
existing immutable audit model and does not require a database-schema change.

## Outcome

Deliver a Gap-Analyse workflow in which a normal user can:

1. answer the questionnaire;
2. optionally select organization documents;
3. review the exact answers and documents that will be analyzed;
4. start and monitor the analysis;
5. understand, filter, and correct the resulting gaps; and
6. confirm a result without seeing internal release or revision terminology.

The underlying assessment revisions, artifact revisions, accepted/current
pointers, source pins, optimistic locks, and audit events remain intact. They
become implementation details surfaced only through optional history or
technical-detail views.

## Confirmed Product Decisions

### Guided flow

- Use four user-facing steps:
  1. **Fragen beantworten** / **Answer questions**
  2. **Dokumente auswählen** / **Select documents**
  3. **Angaben prüfen** / **Review information**
  4. **Ihre Lücken** / **Your gaps**
- Render one active step at a time instead of one long page.
- Completed steps remain revisitable.
- An organization with an existing result lands on **Ihre Lücken**.
- **Analyse aktualisieren** returns the user to the inputs.
- First-time users see one **Analyse beginnen** action after the prerequisite is
  satisfied.
- If the applicability prerequisite is missing, show a plain explanation and a
  **Betroffenheit prüfen** action.

### Questionnaire

- **Weiter zu Dokumenten** saves the answers and advances; remove the separate
  “Fragebogen speichern” concept.
- Do not persist a new assessment revision for each radio-button click.
- Preserve in-browser changes while moving backward and forward.
- Warn before leaving the workflow with unsaved answer or document changes.
- Use these answer labels:

  | Stored meaning | German | English |
  | --- | --- | --- |
  | Fully implemented | Vollständig umgesetzt | Fully implemented |
  | Partially implemented | Teilweise umgesetzt | Partially implemented |
  | Not implemented | Nicht umgesetzt | Not implemented |
  | Unknown | Weiß ich nicht | I don't know |

### Documents and review

- Documents are optional; zero selected documents is a valid input.
- Select documents by name and automatically use the latest active,
  successfully indexed version.
- Keep the exact immutable document version pinned internally.
- Previously used documents can be deselected for the next analysis.
- Step 3 always lists every question with its answer and every selected document
  by filename, even when the questionnaire grows.
- Each summary section has an **Ändern** / **Edit** link to its source step.
- **Analyse starten** is the only primary action in the review step.
- Technical input metadata such as base revision, questionnaire revision,
  release ID, carry-over category, and requirement count is hidden from the
  default summary.

### Generation

- Keep the explicit confirmation boundary before spending AI tokens.
- While generating, remain in step 3 and show clear progress.
- Open **Ihre Lücken** automatically when generation finishes.
- On failure, preserve the inputs and offer **Analyse erneut versuchen** /
  **Try analysis again**.
- If a new analysis replaces an unconfirmed result, explain that the older
  result will move to history.

### Results

- Show a compact status summary above the results.
- Make the summary counts filters for:
  - all gaps;
  - not fulfilled;
  - partially fulfilled; and
  - not sufficiently supported.
- Order gaps by:
  1. **Nicht erfüllt** / **Not fulfilled**
  2. **Teilweise erfüllt** / **Partially fulfilled**
  3. **Nicht ausreichend belegt** / **Not sufficiently supported**
- Preserve catalogue order within each status group.
- Put fulfilled requirements in a separate section collapsed by default.
- A result card shows only the requirement title, status, plain-language
  rationale, and recommended next step by default.
- Requirement codes, citations, excerpts, assumptions, contradictions, and
  other audit data live behind **Nachweise und Details anzeigen** /
  **Show evidence and details**.

### Status and evidence semantics

- Status and documentary support are independent concepts.
- Both AI-generated and manually edited findings may be `fulfilled` without an
  organization-document citation.
- A fulfilled item without a document is valid and confirmable.
- Display **Kein Dokument hinterlegt** / **No document provided** separately
  from the status.
- Rename the user-facing `insufficient_evidence` label to
  **Nicht ausreichend belegt** / **Not sufficiently supported**.
- Keep contradiction handling: contradictory inputs require owner/admin review
  and an explanation before confirmation.

### Editing and confirmation

- Result cards are read-only until an owner/admin chooses
  **Bewertung ändern** / **Change assessment**.
- Editing is inline.
- A manual change requires an explanation:
  **Warum ändern Sie die Bewertung?** / **Why are you changing the assessment?**
- Save with **Änderung speichern** / **Save change**.
- On success, close the editor, update the visible status immediately, show
  **Bewertung gespeichert** / **Assessment saved**, and label the item
  **Manuell geändert** / **Manually changed**.
- A confirmed result remains editable without another AI run.
- Editing a confirmed result creates an updated, unconfirmed working result;
  the previous confirmed result remains authoritative until reconfirmation.
- Confirm the complete result with **Ergebnis bestätigen** /
  **Confirm result**.
- When an unconfirmed result exists, show it as the main result with a banner
  explaining that the previous confirmed result remains valid.
- Offer **Mit bisherigem Stand vergleichen** / **Compare with previous result**
  rather than rendering two full result lists at once.

### History, action plan, and permissions

- Add an optional **Verlauf** / **History** panel with plain events, actor,
  timestamp, and relevant reason.
- Hide revision IDs and numbers from the normal workflow.
- Confirming a changed analysis does not silently close or delete existing
  action-plan items.
- Show **Maßnahmenplan aktualisieren** / **Update action plan** and preserve the
  existing reconciliation decision.
- Keep current permissions:
  - members answer, select documents, and start analysis;
  - owners/admins change assessments and confirm results;
  - auditors are read-only.
- Explain disabled actions in plain language instead of only hiding them.
- Keep one shared organization workflow. Show who last changed it and when.
- Replace optimistic-lock errors with a localized message telling the user that
  another person updated the information and the latest state must be reviewed.

### Terminology and language

- Keep **Gap-Analyse** / **Gap analysis** as the navigation and page name.
- Replace normal user-facing terms:

  | Internal/current term | German UI | English UI |
  | --- | --- | --- |
  | Questionnaire source | Fragen beantworten | Answer questions |
  | Evidence preparation | Dokumente auswählen | Select documents |
  | Candidate revision | Neues Analyseergebnis | New analysis result |
  | Approved revision | Bestätigter Stand | Confirmed result |
  | Approve revision | Ergebnis bestätigen | Confirm result |
  | Save correction as revision | Änderung speichern | Save change |
  | Insufficient evidence | Nicht ausreichend belegt | Not sufficiently supported |
  | Reassessment | Analyse aktualisieren | Update analysis |
  | Retry generation explicitly | Analyse erneut versuchen | Try analysis again |

- Update German and English together.
- Apply the same plain-language direction to connected document,
  applicability-result, and action-plan screens.
- Retain “revision” only where a user explicitly opens technical audit details.

## Current Implementation Diagnosis

### Page structure

`components/gap-analysis/gap-analysis-workflow.tsx` currently renders the
questionnaire, document manager, technical confirmation, candidate result, and
accepted result in one vertical stack. The confirmation card prioritizes base
revision, questionnaire revision, release, and evidence-origin metadata instead
of the answers and documents a user wants to verify.

### Misleading correction error

`correctGapRevision` currently checks every copied finding for the rule
“fulfilled requires a document,” even when the submitted correction changes a
different finding to a less favorable status. One unrelated questionnaire-only
fulfilled finding can therefore reject an otherwise valid correction with:

> A correction cannot mark questionnaire-only evidence fulfilled

The same documentary rule is repeated by:

- `assertGapRevisionApprovable`;
- `validateGapModelResponse`;
- the gap-specific grounding prompt in `src/server/ai/grounding/gateway.ts`;
  and
- the older prompt contract in
  `src/server/gap-analysis/prompt-contract.ts`.

All of these rules must change together.

### Confirmed 500 cause

When `correctGapRevision` copies finding evidence into the new immutable
revision, it copies `assessmentAnswerId` and `documentChunkId` but omits
`legalSourceChunkId`. A copied `legal_source_chunk` row then violates
`gap_finding_evidence_source_check`, causing the transaction to fail and the API
to return 500.

Copy all source-specific foreign keys and test each evidence type.

### Document deselection mismatch

The exact-selection branch in `updateGapReassessmentEvidence` supports removal,
but initial preparation and the existing-draft path merge accepted evidence and
new selections. An empty selection is treated as “do not update,” so users
cannot reliably remove all carried evidence.

The step-2 selection must become authoritative for the next run:

- an empty array means no organization documents;
- a non-empty array is the complete desired set;
- the service resolves every selected document to its latest active indexed
  version; and
- accepted evidence not present in the set is recorded as removed.

### Raw errors and stale local state

The client currently places raw `Error.message` text in a page-level notice.
Correction controls also keep component-local status state while a server
refresh replaces the underlying immutable finding. The redesigned client must
use structured error codes, field-level errors where possible, and explicit
state reset after successful mutations.

### History

The required events already exist in `audit_events`, including questionnaire
submission, reassessment preparation/generation, result creation/correction,
and approval. A gap-specific history projection is missing. No new history
table is needed.

## Target Workflow State Model

```text
missing prerequisite
        |
        v
plain prerequisite screen -> Betroffenheit prüfen

prerequisite complete, no active assessment
        |
        v
Analyse beginnen
        |
        v
Fragen beantworten
        | Weiter zu Dokumenten (save immutable answer snapshot)
        v
Dokumente auswählen
        | Weiter zur Prüfung (persist exact optional selection)
        v
Angaben prüfen
        | Analyse starten (lock exact inputs and enqueue)
        v
generation progress
        |
        v
Ihre Lücken: new result, not confirmed
        | manual edits create complete immutable working results
        | Ergebnis bestätigen
        v
Ihre Lücken: confirmed result
        | Analyse aktualisieren or Bewertung ändern
        v
new working result while confirmed result remains authoritative
```

Use the existing accepted/current artifact pointers:

- `accepted_revision_id` remains the confirmed business result;
- `current_revision_id` remains the latest generated or manually edited result;
- a difference between the pointers means “new result, not confirmed”;
- correcting the current confirmed revision creates a new reviewed current
  revision while leaving the accepted pointer unchanged; and
- confirmation advances the accepted pointer.

## Implementation Plan

### Phase 1: Lock the corrected domain rules with tests

Add or update focused tests before changing runtime behavior:

1. Change `tests/gap-generation-validation.test.ts` to accept a fulfilled
   finding supported only by a questionnaire assertion.
2. Change `tests/gap-review-and-staleness.test.ts` to allow approval of a
   fulfilled finding with no document citation while retaining exact coverage,
   citation validity, and unresolved-contradiction checks.
3. Add service-level correction tests covering every transition:
   - fulfilled -> partially fulfilled;
   - fulfilled -> not fulfilled;
   - fulfilled -> insufficient evidence;
   - any status -> fulfilled without an organization document;
   - unchanged status with an edited explanation;
   - clearing a contradiction with and without a resolution reason.
4. Add evidence-copy regression cases for:
   - questionnaire answers;
   - organization document chunks;
   - legal-source chunks; and
   - a finding with all three source types.
5. Assert that a failed correction rolls back the complete immutable revision
   transaction and does not move `current_revision_id`.

Likely files:

- `tests/gap-generation-validation.test.ts`
- `tests/gap-review-and-staleness.test.ts`
- new `tests/gap-review-service.test.ts`
- test database/repository fixtures already used by server-service tests

### Phase 2: Fix correction and approval behavior

Update `src/server/gap-analysis/review-service.ts`:

1. Remove the rule that `fulfilled` requires a `document_chunk`.
2. Preserve citation integrity checks independently of status.
3. Copy `legalSourceChunkId` alongside `assessmentAnswerId` and
   `documentChunkId`.
4. Keep correction reasons required.
5. Keep resolution reasons required when clearing `requiresReview`.
6. Preserve all untouched findings, evidence, sources, model metadata, and
   parent linkage in each complete immutable corrected revision.
7. Continue deriving severity deterministically from the selected status.
8. Allow correction of a confirmed result only when it is still the artifact's
   current revision; this already protects against editing stale history.
9. Return stable API error codes for stale-current, missing reason,
   unresolved contradiction, and persistence failure.

Do not change `src/db/schema.ts`.

### Phase 3: Separate status from evidence in generation

Update the AI contract consistently:

1. Remove the documentary-evidence rejection from
   `validateGapModelResponse`.
2. Change the gap grounding instruction so questionnaire assertions can support
   a compliance status while `evidenceSufficiency` independently describes
   supporting evidence.
3. Retain these hard requirements:
   - exact requirement coverage;
   - only supplied citations;
   - legal grounding for each finding;
   - no invented organization evidence;
   - contradictions are surfaced; and
   - contradictions set `requiresReview=true`.
4. Centralize the gap-specific grounding instruction so
   `prompt-contract.ts` and `grounding/gateway.ts` cannot drift.
5. Bump the prompt/version contract and its tests.
6. Publish and activate a new immutable gap release containing the updated
   prompt contract and questionnaire labels. This is a content rollout, not a
   schema migration.
7. Preserve the existing stable requirement identities so result comparison
   and action-plan reconciliation continue to work.

Likely files:

- `src/server/gap-analysis/generation-schema.ts`
- `src/server/gap-analysis/prompt-contract.ts`
- `src/server/gap-analysis/prompt-builder.ts`
- `src/server/ai/grounding/gateway.ts`
- `src/server/gap-analysis/releases/<next-version>/release.ts`
- `src/server/gap-analysis/publishing/compile-release.ts`
- `tests/gap-generation-validation.test.ts`
- `tests/gap-prompt-builder.test.ts`
- `tests/gap-release-compiler.test.ts`
- relevant AI evals under `evals/`

Rollout note: existing accepted results remain valid and visible. Starting an
analysis under the newly active release creates/opens the release-compatible
assessment through the existing assessment service and leaves the previous
accepted result authoritative until the new result is confirmed.

### Phase 4: Make document selection exact and optional

Refactor reassessment preparation so both create and update paths use one
selection rule:

1. Treat `selectedDocumentVersionIds` as the complete desired set.
2. Accept `[]`.
3. Resolve selected documents to current active indexed versions on the server.
4. Reject stale, archived, foreign-organization, or unindexed versions with
   structured error codes.
5. Remove accepted documents omitted by the user.
6. Preserve `approved_carryover`, `version_replacement`, and
   `explicit_addition` internally for audit/history, but do not expose those
   categories in the normal review summary.
7. Keep optimistic locking for a shared open draft.
8. Ensure preparing an existing draft with zero documents actually clears its
   document rows.

Likely files:

- `src/server/gap-analysis/reassessment-selection.ts`
- `src/server/gap-analysis/reassessment-service.ts`
- `src/contracts/gap-analysis/generation.ts`
- `components/documents/organization-document-manager.tsx`
- `tests/gap-reassessment-selection.test.ts`
- new or existing reassessment service tests

### Phase 5: Extend the read model for a task-oriented UI

Keep database rows out of the component by adding presentation-ready fields to
the gap page DTO:

- default active step;
- prerequisite state and destination;
- questions with user-facing answer labels;
- saved answer summary;
- selected documents with document title, filename, and processing eligibility;
- gap counts by status;
- `hasOrganizationDocument` per finding;
- `manuallyChanged` per finding or revision provenance;
- accepted-versus-current comparison metadata;
- plan-update availability;
- last workflow change actor and timestamp;
- localized history events; and
- structured concurrency/error context.

Add a bounded gap history query over existing `audit_events`. Batch unique actor
lookups and use a safe localized fallback if an auth display name/email cannot
be resolved. Do not expose raw user UUIDs in the normal interface.

Keep technical IDs in the DTO only where mutations need them; do not render
them by default.

Likely files:

- `src/server/gap-analysis/page-reader.ts`
- `src/server/gap-analysis/postgres-page-data.ts`
- `src/server/gap-analysis/workflow-reader.ts`
- `src/server/audit/read-service.ts` or a focused
  `src/server/gap-analysis/history-reader.ts`
- `src/contracts/gap-analysis/generation.ts`
- `tests/gap-workflow-state.test.ts`
- `tests/gap-workflow-permissions.test.ts`
- page-reader query/performance tests

Performance constraint: preserve the batched accepted/candidate finding read.
Do not reintroduce per-finding evidence or actor queries.

### Phase 6: Build the guided workflow shell

Split `gap-analysis-workflow.tsx` into focused components instead of growing the
existing monolith:

- `gap-analysis-stepper.tsx`
- `gap-questionnaire-step.tsx`
- `gap-document-step.tsx`
- `gap-review-step.tsx`
- `gap-generation-progress.tsx`
- `gap-results-step.tsx`
- `gap-history.tsx`

The exact filenames may follow local component conventions, but each step
should own one user task.

Use a validated URL query value such as
`?step=questions|documents|review|gaps` for navigation. This provides:

- browser back/forward behavior;
- a stable return target after `router.refresh()`;
- direct **Ändern** links;
- a result-first default for existing analyses; and
- no new persisted workflow-state column.

Rules:

1. Derive the allowed/default step from server workflow state.
2. Redirect or fall back safely if a URL asks for an unavailable step.
3. Keep answer and document edits locally until the step's continue action.
4. Reset local state from the new server snapshot after a successful save.
5. Install a navigation/unload warning only while local values differ from the
   server snapshot.
6. Ensure keyboard focus moves to the new step heading.
7. Use an ordered-list/`aria-current="step"` stepper and accessible fieldsets.
8. Keep the layout usable on narrow screens.

### Phase 7: Implement the review and generation experience

Replace the current `ConfirmationCard` with a user summary:

- render question text plus selected answer;
- render selected document title and filename;
- render **Keine Dokumente ausgewählt** when empty;
- link each section back to its editing step;
- keep technical release/revision/evidence-origin data in a collapsed
  technical-details section;
- use **Analyse starten** as the sole primary action;
- retain exact-input locking behind the button;
- show cancellable progress if cancellation remains supported;
- change retry text to **Analyse erneut versuchen**; and
- retain inputs and the review summary after failure.

If an unconfirmed result already exists, show the replacement warning before
enqueueing another generation. The old result remains queryable through
history.

Likely files:

- `components/gap-analysis/*`
- `src/client/gap-analysis.ts`
- `src/client/job-polling.ts`
- `app/tool/organizations/[organizationId]/gap-analysis/page.tsx`
- job/generation contract tests

### Phase 8: Redesign results, correction, and comparison

Build the results step around user intent:

1. Calculate status counts once from the displayed current result.
2. Render clickable, keyboard-accessible filter controls.
3. Sort gaps by the confirmed status order and then catalogue position.
4. Keep fulfilled requirements in a collapsed section.
5. Put evidence/audit content in a details disclosure.
6. Derive document support from `document_chunk` evidence only; legal citations
   remain legal grounding and do not claim that the organization uploaded a
   document.
7. Show status and document support separately.
8. Allow inline editing only for owners/admins.
9. Preserve entered status, reason, and resolution reason when a request fails.
10. After success, update from the returned/read server snapshot, reset local
    editor state, close the editor, and announce success through an
    `aria-live` region or the app's toast mechanism.
11. Allow editing the accepted card only when there is no newer current result.
12. When a newer result exists, edit that result and keep the accepted result
    available through comparison.
13. Disable overall confirmation only for actual blockers such as unresolved
    contradictions, incomplete requirement coverage, stale-current conflicts,
    or insufficient permissions—not missing documents.
14. Implement an on-demand comparison keyed by stable requirement identity and
    show status changes without rendering duplicate full cards.

Likely files:

- `components/gap-analysis/*`
- `src/server/gap-analysis/workflow-state.ts`
- `src/server/gap-analysis/review-service.ts`
- `src/client/gap-analysis.ts`
- result component and service tests

### Phase 9: Replace raw errors with structured UX

Give expected API failures stable codes and translate them at the UI boundary:

| Condition | UI behavior |
| --- | --- |
| Missing required answer | Focus the question and show an inline message |
| Document is not ready | Mark that document and keep the selection |
| Shared draft changed | Refresh latest data and ask the user to review it |
| Result is no longer current | Explain that a newer result exists |
| Missing correction reason | Inline message beside the explanation field |
| Unresolved contradiction | Inline message on the affected result |
| Unexpected persistence failure | Keep values and show a generic retry message |

Never render raw database, stack, `ApiError.message`, or “500” text. Continue to
log the detailed server error with request/correlation context.

Likely files:

- `src/server/api/errors.ts`
- affected gap-analysis routes
- `src/client/gap-analysis.ts`
- `components/gap-analysis/*`
- route/contract tests

### Phase 10: Complete wording and connected-screen cleanup

Restructure the gap-analysis dictionary instead of retaining technical keys
whose values happen to be friendly. Add matching German and English keys for:

- steps and navigation;
- questionnaire answers;
- review summary;
- generation progress/retry;
- status/support labels;
- edit/confirm actions;
- comparison;
- history;
- prerequisite and permission explanations;
- concurrency and validation messages; and
- success announcements.

Update connected screens:

- document usage labels:
  - “used in candidate revision” -> “used in new analysis result”;
  - “used in approved revision” -> “used in confirmed result”;
- action-plan history and update wording;
- applicability result cards and metrics where “revision” is the only visible
  explanation; and
- stale-result wording such as “sources changed after this revision.”

Do not rename database tables, enum values, TypeScript domain fields, route
segments, audit event types, or internal engineering documentation merely for
cosmetic consistency.

Primary file:

- `lib/i18n.ts`

Connected components:

- `components/documents/organization-document-manager.tsx`
- `components/action-plans/action-plan-workflow.tsx`
- `components/applicability-check/applicability-result-card.tsx`
- other direct consumers found by searching dictionary revision labels

### Phase 11: Documentation, release, and verification

Update:

- `docs/product/gap-analysis-current-workflow.md`
- `docs/product/product-structure.md`
- relevant manual QA/runbook sections
- release publication/activation instructions for the new prompt/questionnaire
  content

Run:

```text
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run build
```

Then perform the manual QA matrix below in both German and English.

## Suggested Commit Sequence

Keep changes reviewable and the application green after each commit:

1. `test: cover gap correction transitions and evidence copying`
2. `fix: preserve every evidence source when correcting gaps`
3. `feat: separate gap status from documentary support`
4. `feat: publish the updated gap prompt and questionnaire release`
5. `fix: make reassessment document selection exact and optional`
6. `feat: add task-oriented gap read model and history`
7. `feat: add guided gap-analysis input steps`
8. `feat: add answer and document review step`
9. `feat: redesign gap results and inline assessment editing`
10. `feat: add result comparison and action-plan update handoff`
11. `fix: localize gap validation and concurrency errors`
12. `copy: replace revision-oriented workflow terminology`
13. `docs: update the current gap-analysis workflow and QA guide`

If a commit needs both a contract change and its direct consumer to compile,
keep those pieces together rather than leaving an intentionally broken
intermediate commit.

## Automated Test Matrix

### Domain and service tests

- Questionnaire-only generated finding may be fulfilled.
- Fulfilled finding with `evidenceSufficiency=none` is valid.
- Every status transition creates one complete immutable child revision.
- Unchanged findings and all evidence types are copied exactly.
- Legal-source evidence includes `legalSourceChunkId`.
- `current_revision_id` advances only after the correction transaction commits.
- `accepted_revision_id` does not advance on correction.
- Confirmation advances `accepted_revision_id`.
- Unresolved contradictions still block confirmation.
- Missing documentary evidence does not block confirmation.
- Action-plan generation excludes confirmed fulfilled findings.
- Existing plan items are not silently closed on gap confirmation.

### Reassessment tests

- Zero selected documents creates/updates an open draft with zero document rows.
- A carried document can be removed.
- Removing all carried documents works.
- A selected older version resolves to or is rejected in favor of the current
  indexed version according to the API contract.
- Archived, unindexed, and cross-organization documents are rejected.
- Optimistic lock conflicts do not overwrite another user's selection.
- Reopening the page shows the persisted exact selection.

### Read-model and UI tests

- New users see the correct prerequisite/start state.
- Existing users land on **Ihre Lücken**.
- Step URLs cannot bypass required prior state.
- **Weiter zu Dokumenten** saves once and advances.
- Step 3 renders all answers and selected filenames.
- Empty document selection is clearly shown and allowed.
- Generation progress advances to results on completion.
- Failed generation retains inputs and enables retry.
- Gap counts, filtering, ordering, and fulfilled collapse are correct.
- Status and document support render independently.
- Manual editing requires a reason and preserves values on failure.
- A confirmed result can create a new unconfirmed corrected result.
- Comparison aligns findings by stable requirement identity.
- Owner/admin/member/auditor controls match current capabilities.
- German and English dictionaries have matching keys.
- No normal workflow snapshot contains “Revision,” “Kandidatenrevision,” or
  their English equivalents.

## Manual QA

Run at minimum:

1. Missing applicability prerequisite.
2. First analysis with all four questionnaire answers and no documents.
3. First analysis with one indexed document.
4. Back/forward navigation and unsaved-change warning.
5. Review summary with every answer and selected filename.
6. Generation success, failure, cancellation, and retry.
7. AI-generated fulfilled result without an organization document.
8. Manual transitions between every status, including fulfilled without a
   document.
9. Correction of a result containing legal, questionnaire, and document
   citations; verify no 500.
10. Contradiction resolution with and without the required explanation.
11. Confirmation and action-plan update handoff.
12. Editing an already confirmed result without another AI run.
13. Replacing an unconfirmed result.
14. Deselecting one and then all previously used documents.
15. Two contributors editing the shared draft from stale browser sessions.
16. Owner, admin, member, and auditor permissions.
17. German and English on desktop and narrow mobile widths.
18. Keyboard-only navigation, focus movement, disclosures, filters, and live
   save announcements.

## Rollout and Compatibility

- No database-schema migration is planned.
- Publish/activate a new immutable gap content release for changed questionnaire
  labels and prompt semantics.
- Do not rewrite historical assessment answers or artifact revisions.
- Existing confirmed results and action plans remain authoritative.
- Existing open drafts created under the old release should either finish under
  their pinned release before activation or be explicitly superseded when the
  organization starts the new analysis; do not silently reinterpret their
  inputs.
- Monitor correction endpoints for 4xx/5xx rates after rollout.
- Monitor generation failures caused by the updated prompt/schema contract.
- Retain rollback by reactivating the previous published release; schema
  rollback is unnecessary.

## Definition of Done

The work is complete when:

- the four-step guided flow is the normal Gap-Analyse experience;
- review shows answers and selected documents instead of revision metadata;
- documents are optional and previously carried documents are removable;
- generated and manually edited findings may be fulfilled without uploaded
  documents;
- status and documentary support are visibly separate;
- every correction transition succeeds and legal citations no longer cause
  500 responses;
- owners/admins can edit confirmed results and confirm the updated result;
- the previous confirmed result remains authoritative until confirmation;
- action-plan changes remain explicitly reviewed;
- raw technical errors and revision-oriented language are absent from normal
  workflows in both languages;
- history and technical details remain available without dominating the page;
- automated tests, AI evals, build, and manual QA pass; and
- current product documentation matches the shipped behavior.
