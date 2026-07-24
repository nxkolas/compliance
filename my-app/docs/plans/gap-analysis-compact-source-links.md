# Compact Source Links for Gap-Analysis Results

Status: planned; product decisions confirmed on 2026-07-24. This plan changes
the customer-facing Gap-Analysis result cards without changing the persisted
audit model.

## Outcome

Replace the current **Nachweise und Details anzeigen** / **Show evidence and
details** disclosure with a compact, always-visible source footer inspired by
ChatGPT source links.

Each result card continues to show the requirement title, status,
plain-language rationale, and recommendation. Its footer shows only
presentation-safe source chips:

- organization documents open the exact cited document version through an
  authorized, short-lived link;
- legal sources open their official upstream URL;
- questionnaire support appears as a non-clickable **Ihre Angabe** /
  **Your information** chip; and
- findings without citations explicitly show **Keine Quellen verknüpft** /
  **No sources linked**.

Full excerpts, raw citation IDs, requirement codes, assumptions, and
contradiction details remain available to server-side generation, review, and
audit logic, but are neither rendered nor included in the customer-facing
result projection.

## Confirmed Product Decisions

- Remove the current evidence/details disclosure from Gap-Analysis result
  cards.
- Do not replace it with another technical-details control.
- Keep rationale and recommendation visible as they are today.
- Add an always-visible source footer separated from the result content by a
  subtle divider.
- Label the footer **Quellen** / **Sources**.
- Represent organization documents, legal sources, and questionnaire answers
  as distinct source kinds with small icons and short labels.
- Make document and legal-source chips clickable.
- Render questionnaire citations as a non-clickable **Ihre Angabe** /
  **Your information** chip.
- Deduplicate citations by their underlying source:
  - one chip per exact organization document version;
  - one chip per legal source version; and
  - one combined questionnaire chip per finding.
- Show at most three chips initially. If more sources exist, show a **+N**
  control that reveals the remaining chips without navigating away.
- Use the organization document title and legal-source title as the visible
  chip labels.
- Include known page or section information in accessible supporting text and
  the tooltip, but never include the source excerpt in a tooltip.
- When a PDF page is known, open that page with a `#page=<number>` fragment.
- If one deduplicated source contains citations to multiple pages, show the
  sorted page list in supporting text and open the first cited page.
- Open sources in a new tab.
- Organization document links must resolve the exact immutable version cited
  by the analysis, including when the document has since received a new version
  or has been archived.
- Use private storage and short-lived signed access for organization
  documents. Do not expose storage buckets or object paths.
- Use the legal source version's official `upstreamUrl`.
- If a legal source has no valid official HTTP(S) URL, keep its chip visible
  but disabled and explain that the source is currently unavailable.
- If a finding has no sources, keep the footer and render the explicit empty
  state rather than omitting the footer.
- Retain all audit-only values in the database and server-side domain model.
  Remove them from the browser-facing result DTO instead of merely hiding them
  with CSS or a collapsed control.
- Limit the first rollout to Gap-Analysis result cards, but implement the
  source footer as a reusable component.

## Current Baseline

`components/gap-analysis/gap-results-step.tsx` currently renders a native
`<details>` element for every finding. It contains:

- the requirement code;
- every full evidence excerpt and raw citation ID;
- assumptions; and
- contradiction details.

The page reader loads `gap_finding_evidence` rows and
`getGapAnalysisWorkflow` spreads the raw workflow into the value passed to the
client. As a result, hiding the disclosure alone would leave excerpts,
citation IDs, assumptions, and revision diagnostics in the browser payload.

The database already records the immutable lineage required by the new UI:

```text
document citation
gap_finding_evidence.document_chunk_id
  -> document_chunks.extraction_id
  -> document_extractions.document_version_id
  -> document_versions.document_id
  -> documents

legal citation
gap_finding_evidence.legal_source_chunk_id
  -> legal_source_chunks.generation_id
  -> legal_source_processing_generations.rendition_id
  -> legal_source_renditions.source_version_id
  -> legal_source_versions.source_id
  -> legal_sources
```

The organization document module also already provides
`createDocumentSourceAccess` and the authenticated
`document-versions/[versionId]/source-access` route. The current signed URL is
created with a forced-download disposition and no Gap result UI consumes it.
The implementation should extend this path for inline browser access instead
of creating a parallel storage-access mechanism.

No database-schema migration is required.

## Target Read Model

Introduce an explicit customer-facing source projection rather than passing
`gapFindingEvidence` rows into client components.

A source item should have a discriminated shape equivalent to:

```ts
type GapFindingSource =
  | {
      kind: "document";
      key: string;
      label: string;
      href: string;
      available: true;
      pageNumbers: number[];
      sectionLabels: string[];
    }
  | {
      kind: "legal";
      key: string;
      label: string;
      href: string | null;
      available: boolean;
      pageNumbers: number[];
      sectionLabels: string[];
    }
  | {
      kind: "assessment";
      key: "assessment";
      label: string;
      href: null;
      available: true;
      pageNumbers: [];
      sectionLabels: [];
    };
```

The exact exported type may follow local naming conventions, but the boundary
must have these properties:

- `key` is stable only for rendering and deduplication; do not expose raw
  citation IDs;
- `href` is generated server-side and contains no storage coordinates;
- document links refer to the cited `documentVersionId`, never the document's
  current-version pointer;
- only sanitized `http:` and `https:` legal URLs are emitted;
- page numbers are positive, unique, and sorted;
- section labels are trimmed, unique, bounded strings; and
- excerpts, content hashes, storage paths, model citation IDs, and database
  rows are absent.

The customer-facing finding projection should whitelist only values needed by
the UI and its mutations:

- finding ID;
- status;
- rationale;
- recommendation;
- `requiresReview`;
- localized requirement title and catalogue position;
- `hasOrganizationDocument`;
- `manuallyChanged`;
- a boolean questionnaire-disagreement indicator; and
- the compact `sources` array.

Do not return the following inside the result-card projection:

- `finding.assumptions`;
- `requirement.code`;
- raw `evidence`;
- raw contradiction strings;
- raw questionnaire-disagreement strings;
- `citationId`;
- `excerpt`;
- `assessmentAnswerId`;
- `documentChunkId`; or
- `legalSourceChunkId`.

`getGapAnalysisWorkflow` currently spreads the raw workflow, including raw
finding arrays and full revision `result` JSON. Refactor the return construction
so it explicitly omits:

- the raw current, accepted, and candidate finding arrays after server-side
  comparison has been calculated; and
- full revision-result metadata that the guided UI does not consume.

Expose only the small revision identity/language state required by existing
client actions. Add a regression test that serializes the returned workflow and
proves the audit-only fields and sentinel values do not occur in it.

The historical revision API should return the same safe finding projection if
it remains customer-accessible. Do not leave a second route through which the
removed details are still returned to a normal organization user.

## Implementation Plan

### Phase 1: Lock the safe projection with tests

Add failing tests before changing the reader:

1. Build a finding containing questionnaire, document, and legal citations,
   plus unique sentinel strings in its excerpt, assumptions, contradiction
   diagnostics, requirement code, and citation ID.
2. Assert that the workflow returns three presentation-safe source kinds.
3. Assert that `JSON.stringify(workflow)` contains none of the audit-only
   sentinel strings or raw identifiers.
4. Assert that current, accepted, and candidate raw finding arrays do not leak
   through the workflow spread.
5. Exercise the historical revision GET projection as well as the main
   workflow projection.

Likely files:

- `tests/gap-workflow-localization.test.ts`
- a new `tests/gap-finding-source-projection.test.ts`
- route-contract tests for the historical revision endpoint

### Phase 2: Resolve citation lineage in one bounded read

Extend the Gap page data layer to resolve source metadata in batches:

1. Preserve the existing accepted/candidate batch read.
2. Join or batch-load the document lineage from each cited document chunk to
   its exact document version and document title.
3. Join or batch-load the legal lineage from each cited legal chunk to its
   rendition, source version, and legal-source title.
4. Read the legal rendition MIME type so PDF page linking can be decided
   without guessing from the URL.
5. Use `gap_finding_evidence.page_number` and `section_label` as the persisted
   citation location, with the chunk location only as a defensive fallback.
6. Do not add one query per finding or per citation.
7. Keep raw evidence available only inside server-side processing long enough
   to derive support state and source summaries.

Likely files:

- `src/server/gap-analysis/postgres-page-data.ts`
- `src/server/gap-analysis/workflow-reader.ts`
- a new focused
  `src/server/gap-analysis/finding-source-projection.ts`

The projection module should own:

- source grouping and deterministic ordering;
- page and section normalization;
- legal URL validation;
- server-generated document source-access paths; and
- conversion from internal evidence lineage to the safe DTO.

Deduplication rules:

1. Coalesce all assessment-answer citations into one assessment chip.
2. Group document citations by exact document-version ID.
3. Group legal citations by legal-source-version ID.
4. Preserve first-source appearance across source kinds where a reliable
   citation order exists; otherwise use a documented deterministic order
   (`document`, `legal`, `assessment`, then label/key) so server and client
   rendering cannot drift.
5. Within a grouped source, sort unique page numbers numerically and unique
   section labels lexically.

### Phase 3: Make exact document versions browser-openable

Reuse `createDocumentSourceAccess` and its existing organization authorization:

1. Add an inline/preview access mode that omits Supabase's forced-download
   option. Keep the existing download behavior available for any current or
   future download consumer.
2. Add a normal same-origin GET link or redirect behavior to the existing
   `source-access` route so the UI can render a real anchor with
   `target="_blank"` instead of relying on an asynchronous popup.
3. Authorize every request against the route organization and the document
   version's actual organization.
4. Permit access to an archived document/version when it is the immutable
   version cited by an analysis and the requester still has organization read
   access.
5. Return or redirect only to a short-lived signed URL.
6. Apply `Cache-Control: no-store`.
7. Append a validated PDF `#page=N` fragment only when the version MIME type is
   `application/pdf` and a positive cited page is available.
8. Keep filenames safe for any download disposition.
9. Return the existing stable source-access error codes on lookup or signing
   failure; never expose storage-provider errors.

Likely files:

- `src/server/documents/service.ts`
- `app/api/organizations/[organizationId]/document-versions/[versionId]/source-access/route.ts`
- `src/contracts/documents/index.ts`
- document route/service tests

Security tests must cover:

- a member of the owning organization;
- an auditor/read-only member;
- a user without organization membership;
- a version belonging to another organization;
- an archived exact version;
- signed-link failure;
- inline PDF access with a page fragment; and
- absence of bucket and storage-path values from the Gap workflow response.

### Phase 4: Build the reusable compact source footer

Add a focused client component, for example:

```text
components/gap-analysis/gap-finding-sources.tsx
```

It should:

1. Render a subtle top divider and localized **Quellen** / **Sources** label.
2. Render compact chips in a wrapping flex row suitable for narrow screens.
3. Use a file icon for organization documents, an external-link or landmark
   icon for legal sources, and a user/input icon for questionnaire support.
4. Show the source title as visible text; do not use icon-only links.
5. Truncate long labels visually while retaining the complete accessible name
   and tooltip.
6. Put page/section information in the accessible label and tooltip.
7. Render document and available legal sources as real links opening a new tab
   with `rel="noopener noreferrer"`.
8. Render assessment sources and unavailable legal sources as non-link chips.
9. Give unavailable sources an explicit localized description rather than
   relying on color or a disabled cursor alone.
10. Show only the first three chips initially.
11. Render **+N** as a button with `aria-expanded`; activating it reveals all
    remaining sources inline.
12. Preserve keyboard focus and provide a localized accessible label for the
    expansion control.
13. Render **Keine Quellen verknüpft** / **No sources linked** when the source
    array is empty.

Use the existing tooltip primitives in `components/ui/tooltip.tsx`. Tooltips
are supplementary only; every action and unavailable state must remain
understandable with keyboard navigation, touch, or a screen reader.

Keep expansion as local presentation state. It does not belong in the URL or
database.

### Phase 5: Replace the result-card details disclosure

Update `components/gap-analysis/gap-results-step.tsx`:

1. Delete the complete `<details>` block headed by
   `labels.showDetails`.
2. Stop reading requirement code, evidence excerpts, raw citation IDs,
   assumptions, and contradiction strings.
3. Preserve the visible rationale and recommendation summaries.
4. Preserve contradiction workflow behavior through the existing
   `requiresReview`, review blockers, correction reason, and resolution-reason
   controls; removing technical contradiction prose must not weaken server-side
   confirmation rules.
5. Replace the current questionnaire-disagreement array check with the
   presentation-safe boolean.
6. Render the reusable source footer at the bottom of every finding card,
   outside the correction editor.
7. Ensure clicking or expanding a source does not trigger card editing,
   filtering, or form submission.

Keep the existing **Dokument hinterlegt** / **Document provided** support badge.
It answers whether organization evidence exists; the source footer answers
where all support came from. Legal citations must not set the document-support
badge.

### Phase 6: Update copy and documentation

Replace obsolete dictionary keys and add matching German/English copy for:

- `sources`;
- `yourInformation`;
- `noSources`;
- `sourceUnavailable`;
- page and section descriptions;
- showing additional sources; and
- any screen-reader-only expansion text.

Remove result-card uses of:

- `showDetails`;
- `requirementCode`;
- `citations`;
- `noCitations`;
- `assumptions`; and
- `contradictions`.

Do not delete a dictionary key until repository-wide search confirms it has no
other consumer.

Update the current product documentation so it no longer claims technical
audit details are available from the normal result card:

- `lib/i18n/messages/modules.ts`
- `docs/product/gap-analysis-current-workflow.md`
- `docs/product/product-structure.md` if it describes the browser read model

## Automated Test Matrix

### Projection and domain tests

- Questionnaire-only evidence produces one assessment source.
- Multiple questionnaire citations still produce one assessment source.
- Multiple chunks from one exact document version produce one document source.
- Two versions of the same document produce two sources.
- A newer current document version does not replace the cited version in the
  source link.
- An archived cited version remains linkable.
- Multiple chunks from one legal source version produce one legal source.
- Two legal source versions remain distinct.
- Page numbers and section labels are unique, normalized, and deterministic.
- A legal HTTP(S) URL is available.
- A missing, malformed, `javascript:`, `data:`, or other non-HTTP(S) URL
  produces an unavailable legal source.
- No raw excerpt, citation ID, requirement code, assumption, contradiction,
  storage path, content hash, or full revision-result metadata appears in the
  serialized customer workflow or historical revision response.
- `hasOrganizationDocument` remains true only for `document_chunk` evidence.
- Server-side review and confirmation still receive the full persisted audit
  evidence and contradiction state.

### Component tests

- The old evidence/details disclosure is absent.
- Rationale and recommendation remain visible.
- The source footer is always present.
- The explicit no-source message renders for an empty array.
- Document, legal, and assessment icons/labels render correctly.
- Available links open in a new tab with safe `rel` values.
- Unavailable sources are not links and have an accessible explanation.
- Three sources render initially; **+N** reports the correct remaining count.
- Expanding reveals every source and updates `aria-expanded`.
- Long labels wrap or truncate without breaking the card.
- Page/section information is accessible without exposing excerpts.
- German and English copy have matching keys and render correctly.

Likely files:

- a new `tests/gap-finding-sources-ui.test.tsx`
- `tests/generated-output-language-ui.test.tsx`
- `tests/gap-workflow-localization.test.ts`
- i18n parity tests

### Route and security tests

- The source-access route requires authentication.
- Cross-organization version access is rejected.
- The exact archived version is accepted for an authorized organization
  reader.
- Inline mode does not force a download disposition.
- Download mode remains backward compatible.
- Signing failures return the stable safe error.
- Responses are not cached.

## Manual QA

Perform the following in both German and English:

1. A finding with no citations.
2. A finding supported only by questionnaire information.
3. A finding with one PDF organization document and a known page.
4. A finding with a DOCX organization document.
5. A finding citing an older version after a newer version is uploaded.
6. A finding citing a version after its document is archived.
7. A legal source with an official URL and page.
8. A legal source without a usable official URL.
9. A finding with all three source kinds.
10. A finding with more than three deduplicated sources.
11. Several citations to different pages of the same source.
12. Long German and English source titles on desktop and narrow mobile widths.
13. Keyboard-only traversal, new-tab opening, tooltip access, and **+N**
    expansion.
14. Screen-reader names for every link, non-link chip, unavailable source, and
    expansion control.
15. Confirm and correct a finding to verify that removing technical text did
    not change review blockers or audit persistence.
16. Inspect the rendered/RSC and revision API payloads to confirm removed
    excerpts and diagnostics are not delivered to the browser.

## Suggested Commit Sequence

1. `test: lock safe gap source projections`
2. `feat: project compact gap finding sources`
3. `feat: open exact document sources securely`
4. `feat: add compact gap source chips`
5. `refactor: remove gap evidence details from client payload`
6. `copy: localize compact gap source links`
7. `docs: document compact gap result sources`

Keep the projection contract and its immediate consumer in the same commit if
separating them would leave TypeScript intentionally broken.

## Verification

Run from `compliance/my-app`:

```text
npm run lint
npm run typecheck
npm test
npm run check:i18n
npm run build
```

No database push, content-release publication, or corpus reprocessing is
expected for this change.

## Definition of Done

The work is complete when:

- every Gap-Analysis finding card has a compact, always-visible source footer;
- full evidence excerpts and technical details no longer render;
- removed audit-only details are absent from customer-facing workflow and
  historical revision payloads;
- organization source chips open the exact cited immutable version through
  authorized short-lived access, even after replacement or archival;
- official legal-source URLs open safely and unavailable sources remain
  explicit;
- questionnaire citations appear as non-clickable **Ihre Angabe** /
  **Your information** chips;
- citations are deduplicated and the first three/**+N** behavior works;
- known PDF pages and source locations are represented accessibly;
- findings with no sources show an explicit empty state;
- review, correction, confirmation, and audit behavior remain unchanged;
- German and English UI and documentation match the implemented behavior; and
- automated verification and the manual QA matrix pass.
