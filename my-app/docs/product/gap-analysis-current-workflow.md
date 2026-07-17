# Current Gap-Analysis Workflow

Status: current repository implementation as of 2026-07-17, including the
organization document library, persisted reassessment drafts, separate accepted
and candidate results, and action-plan reconciliation.

This is the operational engineering and QA guide for the authenticated,
organization-only Gap-Analyse. It describes current behavior, not the earlier
implementation sequence recorded in the plan documents.

## Scope and preconditions

The workflow requires:

- an authenticated user with an active organization membership;
- a published and active `nis2-gap` release;
- a completed, automatically approved Betroffenheitscheck artifact from the
  exact compatible applicability release;
- a configured private `organization-evidence` storage bucket for document
  uploads; and
- configured OpenAI generation and embedding providers for live document and
  gap-generation requests.

The current `nis2-gap/demo-v1` release contains four demo requirements and four
required questions. It is not a complete, legally reviewed NIS2 catalog.

## State model

```text
accepted Gap revision A + active plan A
        |
        | upload documents / save questionnaire / prepare evidence
        v
shared open reassessment draft
        |
        | explicit generate (locks exact inputs and calls AI)
        v
candidate revision B; accepted revision A remains authoritative
        |
        | owner/admin review and approval
        v
accepted revision B; active plan A remains active and editable
        |
        | prepare and complete plan reconciliation
        v
draft plan B ready
        |
        | owner/admin activates atomically
        v
active plan B + read-only historical plan A
```

`generated_artifacts.current_revision_id` identifies the latest working
revision. `accepted_revision_id` identifies the approved result that the product
currently treats as authoritative. A candidate therefore does not temporarily
hide or replace the last approved result.

## Roles

| Capability | Owner/Admin | Member | Auditor |
| --- | --- | --- | --- |
| Read documents and workflow state | Yes | Yes | Yes |
| Upload/version/archive documents | Yes | Yes | No |
| Start assessment and save questionnaire | Yes | Yes | No |
| Prepare/edit/generate/retry reassessment | Yes | Yes | No |
| Correct and approve a candidate | Yes | No | No |
| Edit active action-plan operational fields | Yes | Yes | No |
| Create the first plan | Yes | No | No |
| Decide and activate reconciliation | Yes | No | No |

Every server route repeats the authorization check. Hidden UI controls are not
the authorization boundary.

## 1. Complete the Betroffenheitscheck

Manual steps:

1. Select the organization.
2. Open **Betroffenheitscheck**.
3. Complete every visible required question.
4. Click **Betroffenheitscheck berechnen**.

The server evaluates the pinned applicability rules deterministically, creates
immutable answer and result revisions, and stores the result directly with
status `approved`. This step does not call AI.

The possible outcomes are `essential_entity`, `important_entity`,
`not_directly_in_scope`, and `clarification_required`. The demo gap release maps
requirements only to the essential/important outcomes. Either other outcome
still satisfies the approved-artifact prerequisite, but selects zero applicable
demo requirements and therefore produces an empty result without a gap model
call.

## 2. Start the Gap-Analyse

Manual steps:

1. Open **Gap-Analyse**.
2. Click **Gap-Analyse starten**.

The server loads the active published gap release, finds the approved
Betroffenheitscheck result from its exact compatible applicability release, and
creates one active organization assessment pinned to both sources. Repeating
the start action returns the existing assessment instead of duplicating it.

If the prerequisite is missing, the request fails with an explicit error. The
page does not silently start from an incompatible or newer applicability result.

## 3. Save the gap questionnaire

Each current demo question offers:

- **Umgesetzt und dokumentiert**;
- **Teilweise umgesetzt**;
- **Nicht umgesetzt**; or
- **Unbekannt**.

Select one answer for every question and click **Fragebogen speichern**. The
server validates every required question and option, creates a new immutable
`submitted` assessment revision, supersedes the previous questionnaire
revision, and moves the assessment's source pointer to the new revision.

Changing a radio button without saving changes only browser state. Saving a new
questionnaire revision does not call AI and does not change the accepted gap
result or active plan. A later reassessment pins the latest saved questionnaire
revision.

## 4. Manage organization documents

The full document library is available under the organization's **Dokumente**
route. The Gap-Analyse page uses a compact view of the same module for evidence
selection; lifecycle logic is not duplicated.

### New document

1. Enter a document title.
2. Select a supported file.
3. Click **Dokument hochladen**.
4. Wait for the synchronous request and confirm the current version is marked
   **Indexiert**.

### New version

1. Open a document's version details in the full library.
2. Select a supported replacement file.
3. Click **Neue Version hochladen**.

The new immutable version receives the next version number and becomes the
document's current version. Previous versions remain available for historical
citations and usage projections.

### Supported processing

Text PDFs, DOCX, TXT, and Markdown up to 10 MB are supported. Processing is
synchronous:

1. validate title, type, size, and non-empty content;
2. store the original in the private `organization-evidence` bucket;
3. persist immutable metadata, storage path, and SHA-256 hash;
4. extract text through `pdf-parse`, `mammoth`, or strict UTF-8 decoding;
5. split by headings and into overlapping chunks;
6. create `text-embedding-3-small` embeddings;
7. validate the 1,536-dimension vectors and store them; and
8. append audit events and mark processing success or failure.

The source binary is not sent to the gap-generation model. The embedding
provider receives the extracted chunk text. Scanned/image-only PDFs and OCR are
not supported.

Archiving removes a document from new reassessment choices but does not delete
its source, versions, citations, or historical usage. The library derives these
usage labels:

- `not_assessed`;
- `used_in_open_draft`;
- `used_in_candidate_revision`;
- `used_in_approved_revision`; and
- `supports_active_plan`.

Uploading or versioning a document does not automatically call AI, change an
accepted result, or replace an active action plan.

## 5. Prepare the shared reassessment

Evidence selection is now a persisted organization workflow rather than
client-only state.

1. In **Dokumente** or the compact Gap-Analyse document section, select indexed
   current document versions to add.
2. Click **Neubewertung vorbereiten**. If an open draft already exists, the
   button updates that shared draft.
3. The application navigates to Gap-Analyse and shows the complete confirmation
   summary.

Preparation:

- creates at most one open draft for the active assessment;
- pins the latest saved questionnaire revision and current gap release;
- starts with evidence from the accepted revision;
- replaces a previously accepted version with the active indexed current
  version of the same document;
- merges explicitly selected additions;
- records carry-over, replacement, and addition origin;
- persists the selection across sessions for all authorized members; and
- performs no model or embedding call.

The confirmation card shows the base accepted revision, questionnaire revision,
release, requirement count, carried/replaced/added/removed evidence, and final
selected version list. Draft edits use `lock_version`; a stale browser update is
rejected instead of overwriting another member's change.

Current limitation: active evidence already used by the accepted revision is
automatically carried forward. The present UI/service does not provide an
explicit removal operation for that active carried evidence; archiving the
document removes it from a later selection.

## 6. Explicitly generate a candidate

Review the complete confirmation summary, then click **Gap-Analyse generieren**.
This is the token-spending boundary.

The server transactionally verifies the draft and its optimistic lock, then
changes it from `open` to `locked`. After locking, the questionnaire and selected
document-version inputs cannot be edited. Generation reevaluates every
applicable requirement in the pinned release.

If generation fails, the draft becomes `failed` and retains the locked inputs.
Click **Generierung ausdrücklich wiederholen** to create an explicit retry with
a new nonce. There is no automatic retry or hidden model-output repair call.

### Deterministic work before the model call

The server:

1. validates organization scope, assessment, questionnaire, gap release, and
   pinned approved applicability result;
2. chooses requirements from deterministic applicability mappings;
3. validates every selected immutable document version;
4. hashes the release, applicability result, questionnaire, evidence versions,
   and retry nonce into the durable run input;
5. records the AI run and all pinned inputs;
6. embeds each localized requirement as a retrieval query;
7. searches only selected versions with a hybrid full-text/vector score; and
8. supplies up to six document chunks plus the mapped questionnaire answer per
   requirement using stable `DOC:` and `Q:` citation IDs.

### Model contract

The current demo fits all four requirements in one `gpt-5-mini` structured call.
For every requirement the model receives the curated title/text, criticality,
legal metadata, questionnaire answer as an unverified assertion, retrieved
document excerpts as untrusted evidence, citation IDs, and the strict output
schema.

It must return exactly one finding per requirement with:

- `status`: `fulfilled`, `partially_fulfilled`, `not_fulfilled`, or
  `insufficient_evidence`;
- `evidenceSufficiency`: `sufficient`, `partial`, or `none`;
- German and English rationale and recommendation;
- assumptions, supplied citation IDs, contradictions, and `requiresReview`.

The model does not decide applicability, severity, priority, approval, or
action-plan items. `fulfilled` requires at least one supplied document citation.
Any unexpected requirement, invalid citation, missing finding, unsupported
status, or contradiction without `requiresReview=true` fails the complete run.
Partial artifact revisions are not stored.

On success, the server derives severity deterministically, persists the durable
run, immutable candidate revision, normalized findings/evidence, and audit
events, then marks the draft `generated`. The earlier accepted revision remains
visible and authoritative.

## 7. Review and approve the candidate

The Gap-Analyse page displays the candidate and accepted result separately.
Each finding shows the localized requirement, status, rationale,
recommendation, review warning, and cited excerpts.

Only owners/admins can correct a candidate. A correction requires a reason and
creates a complete new immutable `reviewed` revision; it never mutates the AI
revision. Clearing `requiresReview` also requires a contradiction-resolution
reason. A questionnaire-only finding cannot be corrected to `fulfilled`.

When all review blockers are resolved, an owner/admin clicks
**Vollständige Revision genehmigen**. Approval revalidates requirement coverage,
citations, review blockers, and documentary support, then moves the artifact's
accepted pointer to that revision. `insufficient_evidence` is allowed in an
approved revision.

Approval does not replace the active action plan. If the accepted revision is
newer than the active plan's source, the Maßnahmenplan page shows that an update
is available.

## 8. Create and maintain the Maßnahmenplan

If no plan exists, an owner/admin opens **Maßnahmenplan** and clicks
**Maßnahmenplan erstellen**. The server creates one open task for each approved
finding that is partially fulfilled, not fulfilled, or has insufficient
evidence. Fulfilled findings create no task. This is deterministic and makes no
AI call.

Members, admins, and owners can edit the active plan's operational fields:

- status: `open`, `in_progress`, `done`, or `cancelled`;
- responsible user ID, which must be an active member of the organization; and
- due date.

The current UI accepts a raw user UUID rather than offering a member picker.
Every update is audited.

## 9. Reconcile a newer accepted result

When a newer accepted gap revision exists, the active plan remains visible and
editable. An owner/admin clicks **Planabgleich vorbereiten** to create a complete
draft successor plan and persisted item-by-item reconciliation.

The deterministic comparison uses stable requirement identity:

| Change | Default | Human decision |
| --- | --- | --- |
| Exact requirement still has a gap; item open/in progress | Carry operational fields | No |
| New requirement has a gap | Create open follow-up | No |
| New finding is fulfilled | Propose closing old item | Yes |
| Completed item still has a gap | Reopen or create follow-up | Yes |
| Cancelled item still has a gap | Create follow-up | Yes |
| Requirement version changed | Carry/close proposal | Yes |
| Requirement removed | Keep legacy/close/cancel | Yes |

Required decisions need an owner/admin reason. The target plan remains
`draft_reconciliation` and does not displace the active plan until every
required decision is complete.

When the reconciliation is ready, click **Abgeglichenen Plan aktivieren**. The
server verifies that neither the accepted gap revision nor active plan changed
since preparation, supersedes the source plan, activates the target plan, and
marks the reconciliation applied in one transaction. A concurrency mismatch
rejects activation and requires a fresh reconciliation.

Superseded plans and their items remain visible as read-only history. Item
predecessor links retain lineage, while carried status, owner, due date, and
completion history are not silently discarded.

## Staleness and automatic behavior

The application can report source or release staleness, but it never responds
by automatically calling AI or rewriting history.

- Saving a questionnaire creates a newer source revision.
- Archiving evidence or changing its current version can make a result's source
  snapshot stale.
- A changed applicability result or active release is reported explicitly.
- Upload/indexing, draft preparation, candidate approval, and reconciliation
  preparation do not themselves spend a generation call.
- Only explicit generation/retry invokes the gap model.
- Only explicit reconciliation activation changes the active plan.

## Manual QA happy path

1. Sign in as an organization owner/admin.
2. Complete and submit the Betroffenheitscheck.
3. Start Gap-Analyse and save all four demo answers.
4. Open **Dokumente**, upload a supported text document, and verify **Indexiert**.
5. Upload a second version and verify version history/current-version behavior.
6. Select evidence and prepare the reassessment.
7. Confirm the summary and generate the candidate.
8. Verify the accepted result remains visible while the candidate is pending.
9. Resolve all review blockers and approve the complete candidate.
10. Create the first Maßnahmenplan, then populate status, owner, and due date.
11. Save a changed questionnaire or prepare newer evidence, generate, review,
    and approve another candidate.
12. Verify the existing plan is still editable, prepare the reconciliation,
    resolve required decisions, and activate it.
13. Verify carried operational fields and read-only predecessor history.

Also test member/auditor permissions, questionnaire-only generation, zero
applicable requirements, failed generation and explicit retry, optimistic draft
conflicts, archived documents, unresolved reconciliation decisions, and stale
plan/revision activation conflicts.

## Current limitations

- The demo requirement catalog is intentionally small and not legally complete.
- There is no OCR, scanned-document support, background queue, AI reranking,
  automatic retry, or model-output repair call.
- Upload/indexing and generation are synchronous requests.
- Active accepted evidence is automatically carried into reassessment and has
  no explicit removal control in the current UI/service.
- The findings UI does not expose every persisted model field.
- The action-plan owner control requires a raw user UUID.
- Corrections and approvals create whole immutable revisions; there is no
  per-finding approval.
- Reconciliation is organization-only and has no notification/comment workflow.
- There is no guest Gap-Analyse flow.

## Implementation references

- [Gap-analysis UI](../../components/gap-analysis/gap-analysis-workflow.tsx)
- [Document library UI](../../components/documents/organization-document-manager.tsx)
- [Action-plan UI](../../components/action-plans/action-plan-workflow.tsx)
- [Workflow reader](../../src/server/gap-analysis/workflow-reader.ts)
- [Document service](../../src/server/documents/service.ts)
- [Reassessment service](../../src/server/gap-analysis/reassessment-service.ts)
- [Generation service](../../src/server/gap-analysis/generation-service.ts)
- [Review and approval](../../src/server/gap-analysis/review-service.ts)
- [Action-plan service](../../src/server/action-plans/service.ts)
- [Reconciliation service](../../src/server/action-plans/reconciliation-service.ts)
- [Database schema](../../src/db/schema.ts)
