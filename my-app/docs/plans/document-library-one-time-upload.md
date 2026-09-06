# Document Library: One-Time Upload API and UI Plan

## Status

Ready for implementation. Product decisions were confirmed on 2026-07-28.

## Objective

Replace the current version-oriented document API and card UI with a document-oriented, one-time-upload experience.

The database continues to use `documents`, `document_versions`, extraction, chunk, and embedding tables internally. The browser must not receive version history, version IDs, version numbers, storage coordinates, extraction contents, embedding configuration, or other processing internals.

## Confirmed decisions

- Make no database, migration, index, or constraint changes.
- Keep `document_versions` as an internal implementation detail.
- A newly uploaded document gets one internal current-version row.
- Do not allow replacement uploads or creation of additional versions.
- Ignore pre-existing older versions by joining through `documents.current_version_id`.
- Do not migrate or delete pre-existing multi-version data.
- Remove versioning from every browser-facing API and UI, including Gap Analysis.
- Keep document titles and files immutable after upload.
- The table date is the original document upload date (`documents.created_at`).
- Return the canonical MIME type; derive `PDF`, `DOCX`, `TXT`, or `Markdown` in the UI.
- Return exact bytes; format KB/MB in the UI.
- Search only document titles, case-insensitively, on the server.
- Provide Active, All, and Archived views; Active is the default.
- Order results by upload date descending.
- Use cursor pagination with a default page size of 25 and a maximum of 100.
- Use a Load more button in the UI.
- Persist `status` and `search` in the page URL; debounce search by approximately 300 ms.
- Show global Active, All, and Archived counts. Counts do not change with search.
- Allow duplicate titles.
- Keep active and archived documents downloadable.
- Keep archived historical sources accessible from existing results.
- Keep lifecycle status (`active | archived`) separate from indexing status (`processing | indexed | failed`).
- Show indexing status as a secondary badge, not another table column.
- Add synchronous retry indexing for failed, active documents without re-uploading.
- Require restoring an archived document before retrying its indexing.
- Keep synchronous indexing for uploads and retries in this iteration.
- Preserve the signed direct-to-private-storage upload flow.
- Preserve supported file types PDF, DOCX, TXT, and Markdown and the 10 MB limit.
- Preserve existing immutable Gap Analysis references internally, but expose only document IDs.
- Keep a flattened read-only document detail endpoint.
- Remove document renaming and the document `PATCH` endpoint.
- Make archive and restore idempotent and remove the frontend concurrency counter.
- Remove old public version routes entirely; callers receive `404`.
- Use the existing document capabilities consistently.
- Add audit events for upload, indexing, retry, archive, and restore. Do not audit downloads in this iteration.

## Current behavior and problems

### Current list/detail response

`GET /api/organizations/:organizationId/documents` currently returns a `library` containing:

- organization role and a `canContribute` flag;
- complete `documents` rows, including the optimistic-lock `version` and `currentVersionId`;
- every `document_versions` row for every document;
- filenames, storage bucket/path, hashes, uploader IDs, and version numbers;
- extraction rows, including extracted text and processing errors;
- embedding-generation rows and provider/model details;
- usage labels and version eligibility.

The detail endpoint returns the same version-oriented structure. Dedicated endpoints also list versions, return individual versions, create version upload sessions, and provide source access by version ID.

### Current UI

The document page currently:

- loads up to 100 documents into a server component;
- performs title/filename search only in browser memory;
- hides archived documents behind a checkbox;
- renders document cards;
- exposes version history and replacement-version upload;
- allows archive but not restore;
- has no download action;
- has no Active/All/Archived views or tab counts.

### Current authorization mismatch

The capability model already defines:

- `documents:read`;
- `documents:write`;
- `documents:archive`.

However, document service mutations currently call `assertCanContributeToOrganization`, which checks `plans:contribute`. The UI separately checks `documents:write`, and `documents:archive` is not enforced by the service.

### Current Gap Analysis exposure

Gap Analysis currently serializes version-oriented document-library data to the browser. Its selection contracts accept `selectedDocumentVersionIds`, generated-input DTOs expose `documentVersionId` and `versionNumber`, and citation URLs contain `/document-versions/:versionId/`.

## Target public contract

### Document DTO

Create an explicit, strict document DTO. Never form public responses by spreading Drizzle records.

```ts
type DocumentDto = {
  id: string;
  title: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string; // ISO-8601 documents.createdAt
  status: "active" | "archived";
  indexStatus: "processing" | "indexed" | "failed";
};
```

The DTO deliberately omits:

- `organizationId`;
- database lock/version counters;
- `currentVersionId`;
- internal version IDs and numbers;
- original filename;
- storage bucket and path;
- content hashes;
- uploader IDs;
- extraction IDs, extracted text, metadata, and errors;
- embedding generation IDs and configuration;
- usage labels.

The backend still uses the original filename when setting the signed download response.

### List response

```ts
type DocumentListResponse = {
  data: {
    documents: DocumentDto[];
    permissions: {
      canUpload: boolean;
      canArchive: boolean;
      canRestore: boolean;
      canRetryIndexing: boolean;
    };
    counts: {
      all: number;
      active: number;
      archived: number;
    };
  };
  meta: {
    nextCursor?: string;
  };
};
```

Do not return the role and ask the client to reconstruct permissions. Calculate the flags from the active membership and existing capabilities on the server.

### List query

```http
GET /api/organizations/:organizationId/documents
  ?status=active
  &search=policy
  &limit=25
  &cursor=...
```

Rules:

- `status`: `active | archived | all`, default `active`;
- `search`: optional, trimmed title search, maximum 200 characters;
- `limit`: default 25, maximum 100;
- `cursor`: opaque;
- order: `documents.created_at DESC, documents.id DESC`;
- use `ILIKE '%' || escapedSearch || '%'` for title matching;
- scope cursor encoding to organization, normalized status, and normalized search;
- reject a cursor used with different filters;
- counts are global for the organization and do not include the search predicate.

### Detail response

```http
GET /api/organizations/:organizationId/documents/:documentId
```

Return `{ data: { document: DocumentDto } }`. Use `404 DOCUMENT_NOT_FOUND` for a document outside the organization or a missing current internal row.

### Upload

Keep the existing three-stage flow:

1. `POST /documents/upload-sessions`
2. direct signed upload to private storage
3. `POST /document-upload-sessions/:sessionId/complete`

Changes:

- upload-session creation always has scope `document:new`;
- completion accepts only `{ title }`;
- remove optional `documentId` from upload contracts and services;
- completion returns `{ data: { document: DocumentDto } }`;
- do not return `documentVersionId`, version number, extraction ID, or embedding-generation ID;
- idempotency storage may continue to reference the internal version row, but replay must resolve it to its parent document and return the flattened DTO.

### Lifecycle and processing actions

| Method | Path | Capability | Behavior |
| --- | --- | --- | --- |
| `POST` | `/documents/:documentId/archive` | `documents:archive` | Idempotently set the document to archived and return its DTO. |
| `POST` | `/documents/:documentId/restore` | `documents:archive` | Idempotently set the document to active and return its DTO. |
| `POST` | `/documents/:documentId/retry-indexing` | `documents:write` | Synchronously retry a failed active document and return its DTO. |
| `GET` | `/documents/:documentId/download` | `documents:read` | `307` redirect to a five-minute forced-download signed URL. |
| `GET` | `/documents/:documentId/source-access?page=N` | `documents:read` | `307` redirect to a five-minute inline signed URL; preserve valid PDF page fragments. |

Archive and restore:

- do not require `If-Match`;
- return the current DTO when already in the requested state;
- write audit events only when a state transition actually occurs;
- do not change `document_versions.archived_at`;
- do not delete storage, extracted text, chunks, or embeddings.

Download and inline access:

- resolve the storage object through the document's current internal row;
- allow both active and archived documents;
- use `Cache-Control: no-store`;
- do not expose the signed URL in a normal JSON document response;
- sanitize the forced-download filename as today.

### Removed public routes

Delete these route handlers and all browser clients/tests that import them:

```text
GET  /documents/:documentId/versions
POST /documents/:documentId/version-upload-sessions
GET  /document-versions/:versionId
GET  /document-versions/:versionId/source-access
POST /document-versions/:versionId/source-access
PATCH /documents/:documentId
```

Also remove `documentsClient.uploadVersion`, the version upload form, the version history UI, and public version DTO schemas.

## Data access design

### Ignore old versions

The list/detail query must join only the current internal row:

```ts
.innerJoin(
  documentVersions,
  eq(documents.currentVersionId, documentVersions.id),
)
```

Do not join versions using `documentVersions.documentId = documents.id` in a browser-facing read path.

Use a two-phase read to keep cursor pagination stable and prevent duplicate documents if old processing generations exist:

1. Select the document page and current internal file metadata using the `currentVersionId` join, status/search/cursor predicates, and `limit + 1`.
2. Load extraction/embedding state only for those selected current-version IDs.
3. Map processing rows by the internal ID and project a strict `DocumentDto`.
4. Discard the internal IDs before returning from the service.

Run the global counts query in parallel with the page query:

```sql
select
  count(*)::int as all,
  count(*) filter (where status = 'active')::int as active,
  count(*) filter (where status = 'archived')::int as archived
from documents
where organization_id = $1;
```

No title index will be introduced in this iteration. `%search%` uses the existing table because database changes were explicitly excluded.

### Index-status projection

Derive the public status as follows:

```text
failed
  if extraction.status = failed or embedding.status = failed

indexed
  if extraction.status = succeeded and embedding.status = succeeded

processing
  otherwise (pending or processing)
```

Do not expose internal error messages in the DTO. Use stable API errors/toasts for failed actions.

### Retry-indexing behavior

Implement retry against the current internal version and existing stored object:

1. Require `documents:write`.
2. Load the organization-owned document through `currentVersionId`.
3. Reject archived documents with a stable conflict error such as `DOCUMENT_RESTORE_REQUIRED`.
4. If already indexed or processing, return the current DTO without creating duplicate work.
5. If extraction failed:
   - download and verify the existing private object;
   - reset extraction and embedding error/status fields;
   - parse and chunk again;
   - rely on the existing extraction/chunk transaction so a failed parse leaves no partial chunks.
6. If extraction succeeded and embedding failed:
   - reuse the persisted chunks;
   - reset the existing embedding generation to processing;
   - regenerate and validate embeddings;
   - upsert `(generation_id, chunk_id)` rows defensively.
7. Run synchronously and return only after success or a stable processing error.
8. Record retry-requested and retry-failed audit events; reuse `document.indexed` for success.

Refactor the current processing function into reusable extraction and embedding stages so upload and retry share one implementation.

## Authorization

Introduce document-specific authorization helpers or call the capability resolver directly:

| Operation | Capability |
| --- | --- |
| List, detail, search, counts, download, inline source access | `documents:read` |
| Create/complete upload, retry indexing | `documents:write` |
| Archive, restore | `documents:archive` |

Expected existing role behavior:

| Role | Read/download | Upload/retry | Archive/restore |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Member | Yes | Yes | No |
| Auditor | Yes | No | No |

Enforce permissions in services, not only route handlers or UI visibility.

## Gap Analysis API cleanup

Versioning must also disappear from Gap Analysis browser contracts while remaining internal to evidence snapshots.

### Selection requests

Rename browser request fields:

```ts
selectedDocumentVersionIds: string[]
```

to:

```ts
selectedDocumentIds: string[]
```

For both reassessment preparation and evidence updates:

1. Accept document IDs in Zod contracts and `src/client/gap-analysis.ts`.
2. Resolve all IDs in one tenant-scoped server query.
3. Require each selected document to be active and successfully indexed.
4. Resolve each document to `currentVersionId` inside the service/transaction.
5. Persist the internal version IDs in `gap_reassessment_draft_documents` exactly as today.
6. Reject missing, cross-tenant, archived, failed, or processing documents with stable errors.

Never trust a version ID supplied by a browser.

### Workflow projection

Create a separate browser-safe Gap Analysis document projection. Do not serialize the internal document library returned by the evidence reader.

Browser-facing selectable documents should use document IDs:

```ts
type GapSelectableDocumentDto = {
  id: string;
  title: string;
  mimeType: string;
  indexStatus: "processing" | "indexed" | "failed";
  eligibleForAnalysis: boolean;
};
```

Update:

- initial selected state to contain document IDs;
- checkbox values and callbacks to use document IDs;
- review summaries to match by document ID;
- reassessment `selected` DTOs to omit `documentVersionId`;
- workflow contracts so unknown/loose fields cannot silently preserve version data.

Keep a server-only evidence-library reader that can work with internal version rows for generation, usage, staleness, and immutable snapshots.

### Generated inputs and historical results

When reading internal snapshot version IDs:

- join each version to its parent document on the server;
- return `documentId`, title, archived/unavailable state, and other non-version display metadata;
- remove `documentVersionId` and `versionNumber` from the browser DTO;
- key rendered items by `documentId`;
- remove version-number copy from the UI;
- preserve internal snapshot version IDs in database/service layers for reproducibility.

### Finding citations

Change projected document citation URLs from:

```text
/document-versions/:versionId/source-access?mode=inline
```

to:

```text
/documents/:documentId/source-access
```

The projection layer already has access to evidence rows and can join the internal version to its parent document before creating the browser-safe source link. Continue appending validated PDF page information.

Because the database will be reset and future documents have one internal row, no compatibility layer is required for historical multi-version browser URLs.

## UI design

### Page header and upload

- Keep the existing document page and page header.
- Update copy to describe one-time uploads rather than immutable versions.
- Put an `Upload document` button in the header/card toolbar when `canUpload` is true.
- Open a dialog containing:
  - required title input;
  - required file input;
  - PDF/DOCX/TXT/Markdown and 10 MB help text;
  - Upload and Cancel actions.
- Preserve signed direct upload and completion.
- Disable duplicate submission while busy.
- On indexing failure, show the localized error and refresh the list so the persisted failed row becomes visible and retryable.

### Filters and counts

- Render Active, All, and Archived tabs with global counts.
- Default to Active when the URL has no valid status.
- Persist the selected tab as `status`.
- Add a title-only search input backed by `search`.
- Debounce navigation/fetching by approximately 300 ms.
- Reset loaded rows and cursor whenever status or search changes.
- Ensure a stale response cannot overwrite newer search results.

### Table

Columns:

1. Title
2. Datatype
3. Size
4. Upload date
5. Status
6. Actions

Display rules:

- show `Indexed`, `Processing`, or `Indexing failed` beside/below the title;
- derive friendly datatype labels from the canonical MIME type;
- format exact bytes with a shared deterministic formatter;
- format `uploadedAt` through the existing locale-aware date utilities;
- render localized Active/Archived badges;
- preserve accessible table headers and action labels;
- provide a responsive stacked/card fallback or horizontal scroll on narrow screens.

### Row actions

- Download: always visible to readers.
- Archive: active documents only when `canArchive`; require confirmation.
- Restore: archived documents only when `canRestore`; no confirmation.
- Retry indexing: failed active documents only when `canRetryIndexing`; no confirmation.
- Disable the affected row action while a request is running.
- Refresh or replace the row with the action's returned DTO.
- Update tab counts after upload/archive/restore without making them search-dependent.
- Use localized success and failure messages.

### Pagination and empty states

- Render Load more only when `nextCursor` exists.
- Append results for the same status/search scope.
- Distinguish:
  - no documents in the selected view;
  - no title matches;
  - loading more;
  - request failure.

## Audit behavior

Use existing `audit_events`; no schema changes.

| Event | When |
| --- | --- |
| `document.uploaded` | Initial document/internal-row creation succeeds. |
| `document.indexed` | Initial or retried indexing succeeds. |
| `document.index_retry_requested` | A valid failed active document enters retry. |
| `document.index_retry_failed` | Retry ends in extraction or embedding failure. |
| `document.archived` | Active changes to archived. |
| `document.restored` | Archived changes to active. |

Do not emit duplicate archive/restore events for idempotent no-op calls. Keep internal version IDs in audit metadata/entity references where needed; audit storage is not a browser API.

## Primary files to change

### Document contracts and services

- `src/contracts/documents/index.ts`
- `src/contracts/common/pagination.ts` only if a reusable extension is useful
- `src/server/documents/service.ts`
- `src/server/documents/index.ts`
- `src/server/documents/retrieval.ts` to verify active/current-only retrieval remains enforced
- `src/server/auth/capabilities.ts` should not need capability-set changes
- `src/client/documents.ts`

### Document routes

- `app/api/organizations/[organizationId]/documents/route.ts`
- `app/api/organizations/[organizationId]/documents/[documentId]/route.ts`
- `app/api/organizations/[organizationId]/documents/upload-sessions/route.ts`
- `app/api/organizations/[organizationId]/document-upload-sessions/[sessionId]/complete/route.ts`
- `app/api/organizations/[organizationId]/documents/[documentId]/archive/route.ts`
- `app/api/organizations/[organizationId]/documents/[documentId]/restore/route.ts`
- add `app/api/organizations/[organizationId]/documents/[documentId]/retry-indexing/route.ts`
- add `app/api/organizations/[organizationId]/documents/[documentId]/download/route.ts`
- add `app/api/organizations/[organizationId]/documents/[documentId]/source-access/route.ts`
- remove the version route files listed under “Removed public routes”

### Document UI and localization

- `app/tool/organizations/[organizationId]/documents/page.tsx`
- `components/documents/organization-document-manager.tsx`
- optionally split the large manager into table, upload-dialog, and row-action components
- `src/i18n/messages/modules.ts` for both German and English

### Gap Analysis boundary

- `src/contracts/gap-analysis/generation.ts`
- `src/client/gap-analysis.ts`
- `src/server/gap-analysis/page-reader.ts`
- `src/server/gap-analysis/postgres-page-data.ts`
- `src/server/gap-analysis/workflow-reader.ts`
- `src/server/gap-analysis/reassessment-service.ts`
- `src/server/gap-analysis/generated-inputs-reader.ts`
- `src/server/gap-analysis/finding-source-projection.ts`
- `components/gap-analysis/gap-analysis-workflow.tsx`
- `components/gap-analysis/gap-document-step.tsx`
- `components/gap-analysis/gap-review-step.tsx`
- `components/gap-analysis/gap-inputs-used.tsx`

Update other compile-time callers found by TypeScript or repository search rather than adding compatibility aliases with version-oriented names.

## Implementation sequence

### 1. Establish strict contracts

- Define `documentDtoSchema`, status/index-status schemas, permission schema, count schema, and list-query schema.
- Make upload completion title-only.
- Define document-ID-based Gap Analysis selection contracts.
- Add contract tests before changing services.

### 2. Separate internal records from public projections

- Add a single `toDocumentDto` projection.
- Implement current-row-only list/detail queries and global counts.
- Preserve a clearly named server-only evidence reader for internal version consumers.
- Remove full Drizzle row spreading from browser responses.

### 3. Correct authorization

- Replace plan capability checks in document services.
- Add service-level read/write/archive checks.
- Test the owner/admin/member/auditor matrix.

### 4. Simplify upload

- Remove document/version replacement inputs and branches.
- Keep one internal row with `versionNumber = 1`.
- Return the flattened DTO for first completion and idempotent replay.
- Keep extraction/indexing synchronous.

### 5. Add document lifecycle/access actions

- Make archive/restore idempotent and return DTOs.
- Add restore auditing.
- Add document-level download and inline source-access redirects.
- Remove `If-Match` usage for document lifecycle actions.

### 6. Add retry indexing

- Split processing into reusable extraction/embedding stages.
- Implement failed-state branching and stored-object reuse.
- Add stable errors and audit events.
- Add the route and client method.

### 7. Remove public version APIs

- Delete version route handlers.
- Remove service exports used only by those routes.
- Remove public version contracts and browser methods.
- Keep internal version functions/types only where server workflows require them.

### 8. Convert Gap Analysis to document IDs

- Change browser request/response contracts.
- Resolve document IDs to current internal version IDs server-side.
- Replace the serialized internal library with a safe document projection.
- Remove version fields/numbers from workflow and generated-input DTOs.
- Replace citation URLs with document-level source access.

### 9. Rebuild the document UI

- Add URL-backed tabs/search and global counts.
- Add upload dialog and responsive table.
- Add formatting helpers, badges, actions, confirmation, and Load more.
- Refresh failed uploads so retry is discoverable.
- Update German and English copy.

### 10. Remove dead code and verify

- Remove unused version labels/icons/forms/client calls.
- Search browser-facing code for remaining document-version leakage.
- Run targeted tests and the full verification suite.

## Test plan

### Contract tests

- List query defaults to `status=active`, `limit=25`.
- Accepts `all`, `active`, `archived`, `search`, cursor, and valid limits.
- Rejects invalid status, overlong search, invalid limits, and malformed cursors.
- `DocumentDto` rejects version/storage/extraction/embedding fields when strict parsing is used.
- Upload completion rejects `documentId`.
- Gap Analysis contracts accept `selectedDocumentIds` and reject `selectedDocumentVersionIds`.

### Service/query tests

- List joins only `documents.currentVersionId`.
- A fixture with two internal versions returns metadata from the current row only.
- Title search is case-insensitive and does not search filename.
- Status filters and newest-first cursor pagination work together.
- Cursor scope rejects status/search reuse.
- Counts are global and unchanged by search.
- Index-status mapping covers pending, processing, succeeded, extraction failure, and embedding failure.
- Detail, download, and source access cannot cross organization boundaries.
- Archived documents remain downloadable/source-accessible.
- Active/indexed retrieval excludes archived and failed documents.

### Authorization tests

- Owners and admins can upload, retry, archive, and restore.
- Members can upload/retry but cannot archive/restore.
- Auditors can list/search/download but cannot mutate.
- All operations require an active organization membership.
- Hiding an action in the UI is not the only authorization control.

### Upload and retry tests

- New upload creates one document and one internal version row.
- No service/route accepts a parent document ID for replacement upload.
- Completion and idempotent replay return the same flattened DTO.
- Extraction failure leaves a visible failed document.
- Retry after extraction failure reparses and indexes the stored file.
- Retry after embedding failure reuses chunks and indexes successfully.
- Retry does not create another internal document version.
- Retry of archived returns restore-required.
- Retry of indexed/processing is an idempotent no-op.
- Retry failure remains retryable and records the agreed audit event.

### Lifecycle/access route tests

- Archive and restore are idempotent and do not require `If-Match`.
- No-op lifecycle requests do not duplicate audit events.
- Download and inline access return `307` with `Cache-Control: no-store`.
- Download preserves a sanitized original filename.
- Inline PDF access preserves a valid page.
- Invalid page values are ignored.
- Removed version routes no longer exist.

### Gap Analysis regression tests

- Browser submits document IDs.
- Server resolves current internal version IDs and persists them.
- Archived/failed/processing/cross-tenant document IDs are rejected.
- Workflow payloads contain document IDs and no document version IDs/numbers.
- Generated inputs retain title/archive/unavailable information without version fields.
- Finding citations use `/documents/:documentId/source-access`.
- Existing server-side generation, staleness, usage, reporting, and provenance continue to use internal immutable version IDs.

### UI tests

- Active is the default tab.
- Tabs display global counts and search does not alter them.
- Search is debounced, URL-backed, title-only, and resets pagination.
- Load more appends only within the current filter scope.
- Table shows the requested six columns and localized formatting.
- Indexing badge is distinct from lifecycle status.
- Capability flags control upload/archive/restore/retry actions.
- Archive requires confirmation; restore/retry do not.
- Archived rows still offer download.
- Failed active rows offer retry.
- Upload dialog explains accepted types and 10 MB limit.
- Failed completion refreshes the table and exposes retry.

### Verification commands

```powershell
npm run lint
npm run typecheck
npm test
npm run check:i18n
npm run verify
```

Run targeted document, route, Gap Analysis projection, and UI tests first. Run `npm run verify` after the targeted suite passes.

## Acceptance criteria

- The document table shows Title, Datatype, Size, Upload date, Status, and Actions.
- Active, All, and Archived views work with global counts.
- Active is the default view.
- Title-only server search, URL state, and cursor-based Load more work together.
- The public document list/detail/upload/action responses match the strict flat DTO.
- No browser-facing document API returns a document version ID, version number, current-version ID, storage metadata, extraction content, or embedding configuration.
- No browser request supplies a document version ID.
- Old internal versions are ignored by browser-facing document queries.
- A new upload cannot be attached to an existing document.
- Download works for active and archived documents.
- Archive/restore are idempotent and enforce `documents:archive`.
- Upload/retry enforce `documents:write`; reads/downloads enforce `documents:read`.
- Failed indexing is visible and can be retried for active documents without re-upload or a new internal version row.
- Archived documents must be restored before retry.
- Archived documents are excluded from future evidence selection/retrieval while historical analysis references remain intact.
- Gap Analysis selection and citation surfaces expose document IDs only.
- English and German document UI copy is updated.
- No database migration, constraint, or index is added.
- The full repository verification suite passes.

## Explicit non-goals

- Database cleanup or migration of old versions.
- A database constraint enforcing one version per document.
- Background indexing jobs.
- OCR for scanned PDFs.
- New file formats or a larger upload limit.
- Renaming documents.
- Replacing a document file.
- User-configurable table sorting.
- Search-dependent tab counts.
- Auditing document downloads.
- Preserving old public version URLs.
