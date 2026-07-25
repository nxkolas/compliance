# Document Management Design Baseline

Status: aligned with the single Gap-Analysis lifecycle on 2026-07-23.

## Product boundary

The Documents page is a generic organization document hub. It supports:

- upload of PDF, DOCX, TXT, and Markdown files;
- title and filename search;
- extraction and indexing status;
- immutable version history and new-version upload;
- archive controls and archived-document visibility.

The page does not display or control Gap-Analysis or action-plan relationships.
It has no evidence-selection checkboxes, analysis-draft actions, result usage
badges, or action-plan usage badges.

## Gap-Analysis use

Before the organization's single Gap Analysis is generated, the dedicated
**Select documents** step may read eligible current versions from the library.
Selection is optional and is stored in the first-generation input draft.

Successful generation pins exact `document_version` sources to the generated
Gap revision. The separate **Inputs used** view resolves those sources
directly. Uploading a newer version or archiving a pinned document does not
rewrite or erase the snapshot.

The generic hub avoids the usage-union query because its UI does not consume
relationship labels. Internal source records remain available for audit and
the frozen input snapshot.

## Security and storage

Files remain private in the `organization-evidence` bucket. Server-authorized
upload sessions validate ownership, size, MIME type, storage path, and content
hash before creating an immutable version. Extraction, chunking, and embedding
state is stored separately from the original version.

Organization access and document-write capabilities are enforced at the server
boundary. Archival does not delete immutable versions or cited evidence.

See [Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md).
