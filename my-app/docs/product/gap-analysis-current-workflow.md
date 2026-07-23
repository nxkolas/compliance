# Current Gap-Analysis Workflow

Status: guided workflow implemented on 2026-07-23.

The organization Gap-Analyse is a four-step, shared workflow. The interface
uses task language while immutable assessment and artifact revisions remain the
audit implementation underneath.

## Prerequisite and start

The active gap release requires a confirmed applicability result from its
compatible check release. If that result is missing, the page explains the
prerequisite and links to **Betroffenheit prüfen** / **Check applicability**.

When the prerequisite exists but no active assessment exists, contributors see
one **Analyse beginnen** / **Start analysis** action. Auditors see the same
state read-only.

## 1. Fragen beantworten / Answer questions

The page renders one accessible fieldset per question. The guided-v2 answer
labels are:

| Stored value | German | English |
| --- | --- | --- |
| `implemented_documented` | Vollständig umgesetzt | Fully implemented |
| `partially_implemented` | Teilweise umgesetzt | Partially implemented |
| `not_implemented` | Nicht umgesetzt | Not implemented |
| `unknown` | Weiß ich nicht | I don't know |

**Weiter zu Dokumenten** / **Continue to documents** validates all required
answers, creates one immutable answer snapshot, and advances. Radio changes do
not call the server. Local changes survive step navigation, and leaving the
workflow with unsaved answers or document selections triggers a warning.

## 2. Dokumente auswählen / Select documents

Organization documents are optional. Selection is by document name and the
server resolves it to the latest active, successfully indexed version. The
exact immutable version is pinned for generation.

The submitted selection is authoritative:

- `[]` means no organization documents;
- a non-empty list is the complete desired set;
- accepted documents omitted from the list are recorded as removed; and
- an older selected version resolves to the document's eligible current
  version.

Archived, foreign-organization, missing, and unindexed documents are rejected
with a stable error code. A shared open draft uses optimistic locking; a stale
browser cannot overwrite another contributor's selection.

## 3. Angaben prüfen / Review information

The review always lists every question and saved answer plus every selected
document title and filename. With no documents it explicitly shows
**Keine Dokumente ausgewählt** / **No documents selected**. Each section links
back to its source step.

Internal base-result, answer-snapshot, content-version, and requirement-count
metadata is available only in the collapsed technical details. **Analyse
starten** / **Start analysis** is the sole primary action and the explicit
token-spending boundary.

During generation the page stays on step 3 and shows progress. Cancellation is
shown when the job is cancellable. Completion opens **Ihre Lücken** /
**Your gaps** automatically. Failure preserves the reviewed inputs and offers
**Analyse erneut versuchen** / **Try analysis again** without displaying the
raw worker or database error.

## 4. Ihre Lücken / Your gaps

Existing analyses land on this step. A compact status summary filters:

- all non-fulfilled gaps;
- not fulfilled;
- partially fulfilled; and
- not sufficiently supported.

Gap cards are ordered by those three statuses and then by catalogue position.
Fulfilled requirements are in a separate disclosure collapsed by default.

The default card shows the requirement title, status, plain-language rationale,
recommended next step, and document-support indicator. Requirement code,
citations, excerpts, and assumptions are in **Nachweise und Details anzeigen**
/ **Show evidence and details**.

Status and documentary support are independent. A generated or manually
changed finding may be `fulfilled` with questionnaire support and no
organization document. The card then displays **Erfüllt** / **Fulfilled** and
**Kein Dokument hinterlegt** / **No document provided** separately.

## Manual changes and confirmation

Owners and administrators can open **Bewertung ändern** / **Change
assessment** inline. A reason is always required. Clearing a contradiction also
requires a resolution explanation. Successful saves:

- create a complete immutable child result;
- copy assessment-answer, document-chunk, and legal-source evidence including
  every source-specific foreign key;
- derive severity deterministically;
- leave the previous confirmed pointer unchanged;
- close the editor and announce success; and
- mark the requirement **Manuell geändert** / **Manually changed**.

A confirmed result can be edited while it is still current. The edit creates a
new unconfirmed working result, while the previous confirmed result remains
authoritative until **Ergebnis bestätigen** / **Confirm result** succeeds.
Unresolved contradictions, incomplete coverage, stale-current conflicts, and
permissions block confirmation. Missing organization documents do not.

When both results exist, the new result is primary and a banner explains that
the previous confirmed result remains valid. **Mit bisherigem Stand
vergleichen** / **Compare with previous result** aligns status changes by
stable requirement identity without rendering a duplicate card list.

## History and action plan

The collapsed **Verlauf** / **History** projection reads existing gap audit
events, de-duplicates actor lookups, and shows localized event text, actor,
timestamp, and correction reasons. It does not expose raw user IDs.

Confirming a result does not close, delete, or replace action-plan items. When
the confirmed result is newer than the active plan, the page links to
**Maßnahmenplan aktualisieren** / **Update action plan**. The existing explicit
reconciliation decision remains required.

## Permissions

| Role | Answer/select/generate | Change/confirm | Read |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Member | Yes | No | Yes |
| Auditor | No | No | Yes |

Disabled or unavailable actions include a plain-language explanation.

## Release publication and activation

The guided content is registered as `nis2-gap/guided-v2`. It bumps the prompt
and response-schema contracts to version `2` while retaining requirement codes
and stable identities.

For a reviewed non-production environment:

```text
npm run db:publish:gap -- nis2-gap/guided-v2
npm run db:activate:gap -- nis2-gap/guided-v2
```

Production publication and activation must use the reviewed deployment
procedure. Existing confirmed results remain valid. Rollback reactivates the
previous published release; no schema rollback is needed.

## Manual QA matrix

Run in German and English, on desktop and a narrow viewport:

1. Missing applicability prerequisite.
2. First analysis with all four answer meanings and zero documents.
3. First analysis with one indexed document.
4. Browser back/forward plus unsaved-change warning.
5. Review with all answers and exact filenames.
6. Generation success, failure, cancellation, and retry.
7. Generated fulfilled result without an organization document.
8. Every manual status transition, including fulfilled without a document.
9. Correction containing legal, questionnaire, and document evidence.
10. Contradiction clearing with and without an explanation.
11. Confirmation and action-plan update handoff.
12. Editing an already confirmed current result.
13. Replacing an unconfirmed result.
14. Deselecting one and then every carried document.
15. Two contributors editing the same open draft.
16. Owner, admin, member, and auditor permissions.
17. Keyboard step navigation, focus movement, disclosures, filters, and live
    save announcements.

## Verification

Automated verification is:

```text
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run build
```

The manual matrix requires a configured database, Supabase Auth, worker, AI
provider, and published corpus releases.
