# Document Management: Product Baseline for UI Design

Status: confirmed product baseline for redesign. This document describes the
information and product meaning that the document-management experience must
communicate. It does not describe the current UI or prescribe layouts,
components, icons, labels, or interaction patterns.

## Purpose

The document-management page is the organization's shared evidence library. It
must help a user understand:

- which organizational documents exist;
- which file version is the latest;
- which older versions still matter;
- whether a version has been used for compliance work;
- whether newer evidence has not yet reached the approved compliance state; and
- how documents can contribute to a new Gap-Analyse or reassessment.

The page is both a place to manage documents and an entry point for using those
documents as evidence. Uploading or selecting a document is not itself a
compliance assessment.

## Scope and design freedom

This baseline defines:

- the relationship between documents, Gap-Analyse, and Maßnahmenplan;
- the meaning of document and version states;
- the information users must be able to understand; and
- the capabilities the document-management experience must support.

The UI designer decides how this information is organized and represented.
Nothing in this document requires a particular table, card, badge, icon,
dialog, filter, navigation pattern, or wording.

This baseline intentionally excludes:

- the structure and visual behavior of the current UI;
- technical document-processing concepts;
- a detailed redesign of the Gap-Analyse workflow; and
- direct navigation from a document to a particular Gap-Analyse or
  Maßnahmenplan record.

## Core domain model

### Document

A document is the stable library identity of one real-world organizational
source, such as an information-security policy.

Its title is editable organizational metadata. Renaming a document does not
create a new version and does not change its compliance relationships.

### Document version

A version is one immutable uploaded file belonging to a document. Changed file
content creates a new version of the same document when it still represents the
same real-world source.

A materially different source is a new document, not a new version.

Uploading a new version:

- extends the existing version history;
- makes the new upload the latest version available for future work;
- preserves all older versions;
- does not replace evidence used by an existing Gap-Analyse; and
- does not change the active Maßnahmenplan.

“Latest version” must not be treated as synonymous with “version currently used
for compliance.” Those can be different versions.

### Immutable compliance snapshots

A Gap-Analyse uses an exact set of document versions. Once an analysis has been
generated, its evidence snapshot does not change.

The approved Gap-Analyse is the authoritative assessment result. Uploading a
file, creating a new version, or selecting evidence does not retroactively
change it.

The active Maßnahmenplan is based on an approved Gap-Analyse. It therefore
inherits support from the exact document versions used by that Gap-Analyse.
Documents are not assigned directly to measures.

```text
organization document
        |
        v
exact document version
        |
        v
approved Gap-Analyse and its findings
        |
        v
active Maßnahmenplan
```

The active Maßnahmenplan can temporarily lag behind the latest approved
Gap-Analyse while a plan update is still pending. The version supporting the
plan can therefore differ from the version used by the current approved
Gap-Analyse.

## Status model

The design must not collapse all document information into one ambiguous
overall status. Two independent dimensions matter.

### 1. Document lifecycle

- **Active:** available for document management and future assessment work.
- **Archived:** unavailable for future assessment selection, but retained with
  its complete history and existing compliance relationships.

An archived document can be restored. Restoration keeps the same document
identity and version history. It does not create a new document or alter an
approved result.

### 2. Compliance relationship

Compliance relationships apply to exact versions, not vaguely to the document
as a whole.

- **Not yet assessed:** the version is available in the library, but has not
  been used in compliance work.
- **Selected for reassessment:** the version is part of evidence being prepared
  for future Gap-Analyse work. Selection does not make it authoritative.
- **Used in the current approved Gap-Analyse:** the authoritative assessment
  relies on this exact version.
- **Supports the active Maßnahmenplan:** the plan is based on a Gap-Analyse
  that relied on this exact version.

A version may have more than one relationship at the same time. In particular,
the version used by the approved Gap-Analyse may also support the active
Maßnahmenplan.

“Not yet assessed” is the default when no more specific workflow relationship
exists. A version selected for reassessment is still not authoritative, but its
selection is the more informative relationship to communicate.

The document as a whole may summarize the relationships of its versions, but
the version history is the source of precise meaning.

### Important derived condition: newer evidence is not yet assessed

The design must make it understandable when:

- an older version is used by the approved Gap-Analyse or active
  Maßnahmenplan; and
- a newer version has been uploaded but has not yet reached that approved
  compliance state.

This condition is more important than simply identifying the highest version
number. It tells the user that the library contains newer organizational
evidence while the authoritative compliance result still reflects older
evidence.

### Provisional working-state distinction

The future Gap-Analyse workflow may distinguish between:

- evidence selected while an assessment is still being prepared; and
- evidence already used to generate a new assessment that is awaiting review
  or approval.

That distinction can be useful because the first evidence set may still change
while the second is already fixed. However, the Gap-Analyse workflow is likely
to change, so this is a provisional design consideration rather than a stable
requirement for document management.

The durable rule is that unapproved work must not be presented as part of the
current approved Gap-Analyse.

## Information the page must communicate

The designer may choose the level and location at which information appears,
but a user must be able to understand the following.

### For each document

- its organizational title;
- whether it is active or archived;
- which version is the latest;
- a concise summary of its compliance relationships;
- whether an older version still supports the approved compliance state; and
- whether newer evidence exists that has not yet reached that state.

### For each version

At minimum:

- version number;
- original file name;
- upload date;
- uploader; and
- its applicable compliance relationships.

The design does not need to expose file hashes, storage locations, extraction
details, search data, model names, or other processing metadata.

## Capabilities in scope

The document-management experience must support:

- uploading one or multiple new documents;
- adding a new version to an existing document;
- editing a document's organizational title;
- viewing a document's version history;
- archiving an active document;
- accessing and restoring archived documents;
- selecting documents as evidence for Gap-Analyse work; and
- initiating a new Gap-Analyse or reassessment using selected documents and
  existing assessment work.

The exact Gap-Analyse handoff is subject to redesign. Its stable product
boundary is:

- evidence can be added while new assessment work is being prepared;
- an already generated or approved evidence snapshot is never modified; and
- adding later evidence starts or contributes to new assessment work.

## Upload behavior

The upload experience should be described in user terms only:

1. the user selects one or more files;
2. the files are uploaded;
3. successful uploads become available documents or versions; and
4. failed files are reported as failed upload attempts and do not remain as
   document entries.

In a batch, successful files remain successful even if another file fails.

Intermediate technical work is not a document status and must not become part
of the normal document-management language. In particular, users do not need to
know about indexing, extraction, chunks, embeddings, storage, or internal
processing generations.

## Versioning examples

### Newer version awaiting assessment

```text
Information Security Policy

Version 2
  Used in current approved Gap-Analyse
  Supports active Maßnahmenplan

Version 3
  Latest version
  Not yet assessed
```

The approved result and plan remain valid historical snapshots. Version 3 is
available for a reassessment but has not silently changed either of them.

### Approved Gap-Analyse is newer than the active plan

```text
Information Security Policy

Version 2
  Supports active Maßnahmenplan

Version 3
  Latest version
  Used in current approved Gap-Analyse
```

This state is valid while the Maßnahmenplan has not yet been updated from the
new approved Gap-Analyse.

### Evidence selected for future work

```text
Information Security Policy

Version 2
  Used in current approved Gap-Analyse
  Supports active Maßnahmenplan

Version 3
  Latest version
  Selected for reassessment
```

Selection communicates intent. It does not imply that the new version has
already affected the authoritative assessment or plan.

## Lifecycle and retention rules

- Normal users archive rather than permanently delete documents.
- Archiving prevents future selection but does not remove version history.
- Existing Gap-Analyse evidence and Maßnahmenplan support remain intact after
  archival.
- Restoration makes the same document available again without rewriting
  history.
- Permanent erasure is an exceptional administrative or retention concern and
  is outside this design baseline.

## Permissions context

The experience may adapt available actions to organization roles:

- owners, administrators, and members may contribute documents and prepare
  assessment evidence;
- auditors are read-only; and
- approval of Gap-Analyse results and activation of updated Maßnahmenpläne are
  separate privileged actions outside document management.

Permissions affect which actions are available, not the meaning of document
statuses.

## Design acceptance questions

A proposed design satisfies this baseline when a user can answer:

1. What is the latest version of this document?
2. Is that latest version already reflected in the approved Gap-Analyse?
3. Which exact version supports the active Maßnahmenplan?
4. Is newer evidence waiting to be assessed?
5. Is a version merely selected for future work or already authoritative?
6. What happened to older versions?
7. What will and will not change if a new version is uploaded?
8. Can this document still be used for future assessment work?

The answers may be communicated visually in any suitable way. The baseline
requires clarity of meaning, not a particular UI solution.

## Related documentation

- [German version of this design baseline](./dokumentenverwaltung-design-grundlage.md)
- [Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md) describes
  the implemented operational workflow and known runtime limitations.
- [Document Management, Gap Reassessment, and Plan Reconciliation](../plans/document-management-reassessment-and-plan-reconciliation.md)
  records the underlying implementation design.
