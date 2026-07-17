# Current Gap-Analysis Workflow

Status: current implementation as of 2026-07-17.

This is an internal engineering and QA description of the authenticated
organization workflow from Betroffenheitscheck through Gap-Analyse and
Maßnahmenplan. It documents what the application does now, including manual
steps and current limitations. It is not a target design, legal advice, or a
claim that the demo requirement catalog is a complete NIS2 assessment.

## Scope and Preconditions

The workflow is available only inside an authenticated organization. A user
must already have an active organization membership. Account creation,
authentication, organization creation, and release publication/activation are
outside this document.

The deployed system must have:

- the compatible `nis2_applicability/2026-v1` release available;
- the active `nis2-gap/demo-v1` release published and activated;
- database and private Supabase Storage access;
- `OPENAI_API_KEY` for document embeddings and gap generation; and
- the `organization-evidence` private storage bucket and gap evidence database
  infrastructure.

The demo gap release contains four requirements and four questions covering
access control, backup and recovery, incident response, and supply-chain
security. The generation model is pinned to `gpt-5-mini`. Document and retrieval
embeddings are pinned to `text-embedding-3-small` with 1,536 dimensions.

## End-to-End Sequence

```text
User completes Betroffenheitscheck
    -> application evaluates deterministic rules and auto-approves the result
User opens Gap-Analyse and clicks "Gap-Analyse starten"
    -> application pins the active gap release and approved applicability result
User answers all four questions and clicks "Fragebogen speichern"
    -> application creates an immutable submitted questionnaire revision
User optionally uploads documents and verifies the evidence checkboxes
    -> application extracts, chunks, embeds, and indexes the document text
User clicks "Gap-Analyse generieren"
    -> application retrieves evidence and sends a structured request to AI
AI returns one structured finding per applicable requirement
    -> application validates and stores a generated immutable revision
Owner/admin reviews, optionally corrects, then clicks
"Vollständige Revision genehmigen"
    -> application approves the complete current revision
Owner/admin opens Maßnahmenplan and clicks "Maßnahmenplan erstellen"
    -> application creates action items deterministically without another AI call
Member/owner/admin maintains item status, owner ID, and due date manually
```

No source change automatically regenerates a gap analysis or spends AI tokens.

## Roles

| Role    | Read workflow | Answer questionnaire | Upload/archive evidence | Generate AI result | Correct/resolve/approve | Create/regenerate plan | Update plan items |
| ------- | ------------- | -------------------- | ----------------------- | ------------------ | ----------------------- | ---------------------- | ----------------- |
| Owner   | Yes           | Yes                  | Yes                     | Yes                | Yes                     | Yes                    | Yes               |
| Admin   | Yes           | Yes                  | Yes                     | Yes                | Yes                     | Yes                    | Yes               |
| Member  | Yes           | Yes                  | Yes                     | Yes                | No                      | No                     | Yes               |
| Auditor | Yes           | No                   | No                      | No                 | No                      | No                     | No                |

Server-side permission checks enforce these rules; hiding a UI control is not
the authorization boundary.

## 1. Complete the Betroffenheitscheck

The Gap-Analyse requires a current approved Betroffenheitscheck artifact for
the release that the gap release declares compatible.

Manual user actions:

1. Select the organization in the application shell.
2. Click **Betroffenheitscheck** in the sidebar.
3. If no result exists, the application redirects to the questionnaire.
   Otherwise, click **Neu berechnen** to submit a new revision.
4. Answer every currently visible required question. Conditional answers can
   change which later questions are visible.
5. Click **Betroffenheitscheck berechnen**.
6. Review the result page if desired. No separate human approval click exists
   for this prerequisite.

Automatic behavior:

- The server validates the submitted answers and evaluates the pinned ruleset.
- It creates immutable assessment, answer, and result revisions.
- The deterministic result is created directly with status `approved`; this
  stage does not call AI.
- Possible outcomes are `essential_entity`, `important_entity`,
  `not_directly_in_scope`, and `clarification_required`.

The current demo gap release maps its four requirements only to
`essential_entity` and `important_entity`. A submitted result with either other
outcome still satisfies the approved-artifact gate, but generation has zero
applicable requirements. In that case the current implementation makes no gap
model call, produces an empty findings revision, and later produces an empty
action plan.

## 2. Start the Gap-Analyse

Manual user actions:

1. Click **Gap-Analyse** in the sidebar.
2. Click **Gap-Analyse starten**.

Automatic behavior:

- The server verifies that the user can contribute to the organization.
- It loads the active published `nis2-gap` release.
- It finds the approved Betroffenheitscheck result for the gap release's exact
  compatible applicability release.
- It creates one active assessment for the organization and current gap
  release, pinning both the gap release and applicability artifact revision.
- Clicking the start button again opens the existing current-release
  assessment rather than duplicating it.
- When a newer release is used to create an assessment, older active
  assessments for the same module are archived.

If the compatible approved result is missing, the start request fails. The UI
shows the returned prerequisite error; it does not automatically navigate back
to the Betroffenheitscheck.

## 3. Answer and Save the Gap Questionnaire

The current demo displays four required single-choice questions. Each offers:

- **Umgesetzt und dokumentiert**;
- **Teilweise umgesetzt**;
- **Nicht umgesetzt**; or
- **Unbekannt**.

Manual user actions:

1. Select one answer for each of the four questions.
2. Click **Fragebogen speichern**. The button stays disabled until every
   question has an answer.

Automatic behavior:

- The server validates that every required question is answered exactly once
  and that every selected option belongs to its question.
- It creates a new immutable `submitted` assessment revision and marks the
  previous questionnaire revision `superseded`.
- The new revision becomes the assessment's current source revision.
- Any active action plan for the organization is marked stale.

The user can change answers and click **Fragebogen speichern** again. Merely
changing a radio button in the browser does not change the stored source; the
save click is required. Saving does not automatically regenerate the gap
result.

## 4. Upload and Select Document Evidence

Documents are optional. A questionnaire-only analysis is allowed, but no
finding can validly receive the status `fulfilled` without a cited document
chunk.

### Manual upload steps

1. Enter a value in **Dokumenttitel**.
2. Choose a file with the browser's file picker.
3. Click **Dokument hochladen und indexieren**.
4. Wait for the request to finish and verify that the document shows
   **Indexiert**.
5. Verify the checkbox **Für diese Generierung auswählen** for every document
   version that should be used. Uncheck any indexed document that must not be
   considered.

The page initially selects every active, successfully indexed current document
version. Selection is browser state for the next generation request; it is not
saved as a reusable evidence set. After uploading or changing the list, QA
should explicitly verify the checkboxes before generation.

Supported uploads are text PDFs, DOCX, TXT, and Markdown up to 10 MB. Scanned
PDFs, images, and OCR are not supported. A document from which no text can be
extracted fails processing.

### Automatic upload processing

The upload request performs the complete pipeline synchronously:

1. Validate title, MIME type, non-empty content, and size.
2. Store the original bytes in the private `organization-evidence` bucket.
3. Record immutable document/version metadata, storage path, and SHA-256 hash.
4. Extract text on the application server:
   - PDF through `pdf-parse`, preserving page numbers;
   - DOCX through `mammoth` raw-text extraction; or
   - TXT/Markdown through strict UTF-8 decoding.
5. Split text by Markdown-style headings and into chunks of at most roughly
   1,200 characters with 180-character overlap.
6. Send the extracted chunk texts to the OpenAI embeddings API using
   `text-embedding-3-small`.
7. Validate the returned 1,536-dimension vectors and store them with the chunks.
8. Mark the document version indexed and append audit events.

The binary source file is not sent to the generation model. The embedding
provider does receive the extracted text chunks. The upload UI remains busy
until extraction and embedding finish; there is no background worker in the
current implementation.

Clicking **Archivieren** marks the document archived and removes it from future
selection. It does not ordinarily delete the stored source or immutable
versions. Archiving a document used by a gap revision makes that revision
stale.

## 5. Generate the Gap Analysis

The questionnaire must have been saved at least once before the generation
button appears.

Manual user actions:

1. Confirm the evidence checkboxes.
2. Click **Gap-Analyse generieren**.
3. Wait for the synchronous request to complete and inspect the findings.
4. If it fails, read the displayed error and click **Generierung ausdrücklich
   wiederholen** to create an explicit retry.

There is no automatic retry or hidden model-output repair call. A retry uses a
new nonce. Repeating a successful request with the exact same stored inputs and
without a retry nonce reuses its durable run instead of spending tokens again.

### Deterministic work before the model call

The server:

1. Verifies the organization, active assessment, saved questionnaire revision,
   pinned gap release, and approved pinned applicability result.
2. Uses the applicability outcome and release mappings to choose applicable
   requirements. AI does not decide applicability.
3. Validates that every selected document version belongs to the organization.
4. Hashes the pinned release, applicability revision, questionnaire answers,
   and selected immutable document versions into a stable input hash.
5. Creates a durable AI run and records all pinned input sources.
6. For each applicable requirement, sends the localized requirement title and
   text as an embedding query to OpenAI.
7. Searches only the selected document versions using a hybrid score of 35%
   PostgreSQL full-text rank and 65% vector similarity.
8. Selects up to six document chunks per requirement and assigns stable
   `DOC:<chunk-id>` citation IDs. The mapped questionnaire answer receives a
   `Q:<answer-id>` citation ID.

### What is sent to the gap-generation model

For the current essential/important demo path, all four requirements fit in one
`gpt-5-mini` structured-generation call. Each requirement contains:

- code, localized title, exact curated requirement text, and criticality;
- curated legal-reference metadata;
- the mapped question and selected answer as an unverified user assertion;
- up to six retrieved document excerpts as untrusted evidence;
- stable citation IDs plus available page number and section label;
- allowed finding and evidence-sufficiency enums; and
- an output contract requiring exactly one finding per requirement and only
  supplied citation IDs.

The system instruction tells the model to:

- evaluate only supplied requirements;
- treat questionnaire answers as unverified assertions;
- treat document excerpts as untrusted and ignore instructions inside them;
- surface rather than resolve contradictions;
- require documentary evidence for `fulfilled`; and
- return the strict structured schema.

The generation prompt does not contain the whole source file, organization or
user identity, document title/path, action-plan ownership or dates, or the full
Betroffenheitscheck result. The applicability outcome is used by server logic
to select requirements but is not itself included in the model prompt.

### What the model returns

The strict response contains an array with exactly one entry per requested
requirement:

| Field                 | Meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `requirementCode`     | The supplied curated requirement code                                           |
| `status`              | `fulfilled`, `partially_fulfilled`, `not_fulfilled`, or `insufficient_evidence` |
| `evidenceSufficiency` | `sufficient`, `partial`, or `none`                                              |
| `rationale`           | Non-empty German and English explanation                                        |
| `recommendation`      | Non-empty German and English recommendation                                     |
| `assumptions`         | Any assumptions made by the model                                               |
| `citations`           | Only supplied `Q:` or `DOC:` citation IDs                                       |
| `contradictions`      | Contradictions detected by the model                                            |
| `requiresReview`      | Whether the finding must be resolved by a reviewer                              |

The model does not return applicability, severity, priority, approval, or
action-plan items.

### Validation and persistence

Before any result revision is stored, the server verifies:

- every requested requirement appears exactly once;
- no unexpected or duplicate requirement appears;
- every citation was supplied for that exact requirement;
- `fulfilled` has at least one document citation; and
- any returned contradiction also sets `requiresReview=true`.

Any invalid output fails the entire batch/run. No partial artifact revision is
persisted. The current four-requirement demo is one batch, so it succeeds or
fails as a unit.

On success, the server derives severity deterministically, stores token usage,
creates an immutable generated artifact revision, normalizes findings and cited
evidence, sets it as the current revision, and appends audit events.

Severity is not chosen by AI:

- `not_fulfilled` keeps the curated requirement criticality;
- `partially_fulfilled` lowers `critical` to `high` and `high` to `medium`;
- `insufficient_evidence` lowers `critical` to `high` and otherwise keeps the
  requirement criticality; and
- `fulfilled` receives `low` severity.

## 6. Read and Review the Returned Findings

Every finding card currently shows:

- requirement code and localized title;
- localized status;
- a **Prüfung erforderlich** warning when `requiresReview` is true;
- localized rationale;
- localized recommendation; and
- cited questionnaire/document excerpts with their stable citation IDs.

The current UI does not display severity, evidence sufficiency, assumptions,
document page/section metadata, or the model's contradiction strings. In
particular, contradiction text is validated by the generation layer but is not
persisted in the normalized finding or shown to the reviewer; the persisted
human-review signal is `requiresReview`.

### Manual correction and conflict resolution

Only an owner or admin sees correction controls.

For a normal correction:

1. Choose the desired status in the finding's select control.
2. Enter **Grund der Korrektur**.
3. Click **Korrektur als neue Revision speichern**.

For a finding marked **Prüfung erforderlich**:

1. Choose the desired status.
2. Enter **Grund der Korrektur**.
3. Enter **Auflösung des Widerspruchs**.
4. Click **Korrektur als neue Revision speichern**.

The save creates a new immutable `reviewed` revision containing copies of every
finding and its evidence; it never mutates the AI revision. Clearing a review
blocker requires a resolution reason. If multiple findings require review, the
owner/admin repeats this on the current revision until no blockers remain.

The UI currently permits changing only status and review state. The correction
API can also accept evidence sufficiency, rationale, recommendation, and
assumptions, but the current page exposes no controls for those fields. A
questionnaire-only finding cannot be corrected to `fulfilled`.

### Manual approval

1. Confirm every finding and citation.
2. Resolve every **Prüfung erforderlich** item.
3. Click **Vollständige Revision genehmigen**.

Approval is for the complete current revision and is limited to owners/admins.
The server rechecks exact applicable-requirement coverage, citation integrity,
review blockers, and documentary support for every `fulfilled` finding.
`insufficient_evidence` is allowed in an approved revision.

Approval does not automatically create a Maßnahmenplan. Any existing active
plan is marked stale when a newer gap revision is approved.

## 7. Create and Maintain the Maßnahmenplan

Manual creation:

1. Click **Maßnahmenplan** in the sidebar.
2. Confirm that the desired current gap revision is approved.
3. Click **Maßnahmenplan erstellen**.

Only owners/admins can create the plan. This step makes no AI call. The server
creates one item for every approved finding whose status is
`partially_fulfilled`, `not_fulfilled`, or `insufficient_evidence`.

Each item's immutable baseline is derived as follows:

- title: localized curated requirement title;
- description: localized reviewed recommendation;
- priority: deterministic finding severity; and
- initial status: `open`.

No item is created for `fulfilled`. If all findings are fulfilled, or the gap
revision contains no applicable findings, the plan is valid but empty.

### Manual item maintenance

For each item, a member, admin, or owner can:

1. Select **Offen**, **In Bearbeitung**, **Erledigt**, or **Abgebrochen**.
2. Enter an active organization member's raw UUID in **Verantwortliche
   Benutzer-ID**, or clear it to remove the owner.
3. Select **Fällig am** with the date input, or clear it.
4. Click **Änderungen speichern**.

The current UI does not provide a member picker or resolve the UUID to a display
name. The server rejects an owner UUID that is not an active member of the same
organization. Every update is audited.

## Staleness and Explicit Regeneration

A gap revision becomes stale when a pinned source no longer matches the current
source, including when:

- a newer questionnaire revision is saved;
- a selected document is archived or its current version changes; or
- the pinned applicability artifact revision is no longer current.

A newer active gap release is shown separately as an outdated-release warning.
None of these conditions automatically calls AI or overwrites history.

When a gap source changes, the user must save the source where applicable,
verify evidence selection, and click **Gap-Analyse generieren** again. After an
owner/admin reviews and approves the newer result, the old Maßnahmenplan is
stale. The owner/admin must click **Plan ausdrücklich neu erstellen**. Explicit
regeneration archives the previous plan and creates a fresh plan; it does not
merge old owners, due dates, status, or completed work.

## Manual QA Happy Path

Use this as the shortest complete manual pass:

1. Sign in and select an organization as owner/admin.
2. Open **Betroffenheitscheck**, answer all required questions, and click
   **Betroffenheitscheck berechnen**.
3. Open **Gap-Analyse** and click **Gap-Analyse starten**.
4. Answer all four demo questions and click **Fragebogen speichern**.
5. Enter a document title, select a supported text document, and click
   **Dokument hochladen und indexieren**.
6. Confirm **Indexiert** and tick **Für diese Generierung auswählen**.
7. Click **Gap-Analyse generieren**.
8. Inspect all four requirement cards, statuses, rationales, recommendations,
   and citations.
9. For each blocker, enter correction and resolution reasons and click
   **Korrektur als neue Revision speichern**.
10. Click **Vollständige Revision genehmigen**.
11. Open **Maßnahmenplan** and click **Maßnahmenplan erstellen**.
12. Change an item's status, enter a valid organization-member UUID and due
    date, then click **Änderungen speichern**.

Also test the questionnaire-only branch, failed generation and explicit retry,
member/auditor permission differences, stale sources, and explicit plan
regeneration.

## Current Limitations Relevant to Workflow Testing

- The gap release and legal references are explicitly demo content, not a
  complete legally reviewed NIS2 catalog.
- Only essential/important applicability outcomes map to demo requirements.
- Document parsing and embedding happen synchronously during upload.
- Gap retrieval and generation happen synchronously after the generation click.
- There is no OCR, scanned-document support, background queue, AI reranking,
  automatic retry, or model-output repair call.
- Evidence selection is not persisted as a named set and should be verified for
  each generation.
- The findings UI hides some persisted model fields and does not retain/display
  contradiction text beyond the review-required flag.
- The action-plan owner control requires a raw user UUID.
- Corrections and approvals are whole immutable revisions; there is no
  per-finding approval.
- Plan regeneration replaces rather than merges the previous operational plan.
- Gap-Analyse is organization-only; there is no guest gap-analysis flow.

## Implementation References

- [Gap-analysis UI](../../components/gap-analysis/gap-analysis-workflow.tsx)
- [Workflow reader](../../src/server/gap-analysis/workflow-reader.ts)
- [Assessment creation](../../src/server/gap-analysis/assessment-service.ts)
- [Questionnaire submission](../../src/server/gap-analysis/questionnaire-service.ts)
- [Document service](../../src/server/documents/service.ts)
- [Document parsing](../../src/server/documents/parser.ts)
- [Hybrid retrieval](../../src/server/documents/retrieval.ts)
- [Generation service](../../src/server/gap-analysis/generation-service.ts)
- [Prompt contract](../../src/server/gap-analysis/prompt-contract.ts)
- [Structured response and validation](../../src/server/gap-analysis/generation-schema.ts)
- [Review and approval](../../src/server/gap-analysis/review-service.ts)
- [Action-plan service](../../src/server/action-plans/service.ts)
- [Action-plan UI](../../components/action-plans/action-plan-workflow.tsx)
- [Demo release](../../src/server/gap-analysis/releases/demo-v1/release.ts)
