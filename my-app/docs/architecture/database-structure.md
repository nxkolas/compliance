# Database structure

Status: current schema overview as of 2026-07-24.

`src/db/schema.ts` is the source of truth for ordinary application tables,
columns, enums, relations, constraints, and indexes. Apply it with
`npm.cmd run db:push`. Supabase-only extensions, search infrastructure, storage,
privilege, RLS, audit-trigger, and retention operations live under
`supabase/sql-editor/` and are documented in the
[Supabase security runbook](../database/supabase-security-runbook.md).

## Ownership and authorization

`organizations` is the tenant boundary. `organization_memberships` assigns the
roles `owner`, `admin`, `member`, and `auditor`; invitations are separate
records. Organization-owned workflow tables carry an organization ID directly
or are constrained through organization-scoped foreign keys.

Browser roles have no supported direct table-access path. Next.js pages and API
routes authenticate the user and enforce organization permissions in server
services. RLS and revoked browser grants are defense in depth and must be
verified after every schema rollout.

## Immutable compliance releases

The deterministic NIS2 checker uses four layers:

1. Stable identities: frameworks, facts, sectors, entity types, legal
   instruments, and content items.
2. Immutable versions: content revisions/translations, legal-instrument
   versions/provisions, scope-model entity versions, threshold sets,
   jurisdiction profiles, questionnaire versions, and compiled rule sets.
3. Aggregate releases: `compliance_check_releases` pins one exact questionnaire,
   EU model, threshold set, evaluator/rule artifact, fact-version set,
   content-revision set, and national-profile mapping.
   `active_compliance_check_releases` is the only mutable activation pointer;
   activation history is append-only.
4. Runtime records: assessments and guest sessions pin an aggregate release.
   Answers and fact choices use relational option joins. Generated artifact
   revisions store language-neutral evidence, while `nis2_result_projections`
   carries searchable NIS2-specific fields.

Published versions are never updated by the publisher. A wording change creates
a content revision; an evaluator-semantic change creates a new evaluator
identifier/version and aggregate release.

The German profile has its own relational catalog. It covers the BSIG Annex
statutory categories, supported out-of-Annex identities, legal provenance,
typed threshold policies, jurisdiction rules, and effective-state declarations.

## Gap-analysis releases and requirements

The AI-assisted Gap-Analyse is a sibling of the deterministic applicability
workflow, not another interpretation of its rules.

- `gap_requirements` provides stable identities used to reconcile findings and
  action-plan items over time.
- `gap_requirement_versions` stores immutable localized requirement content,
  legal metadata, criticality, and prompt-facing text.
- Requirement-set versions pin exact requirement versions.
- `gap_analysis_releases` pins the questionnaire, requirement set, prompt
  metadata, model configuration, and compatible applicability release.
- Active-release pointers and activation history use the same publish-then-
  activate separation as the applicability checker.

An organization Gap assessment pins both its gap release and the exact approved
applicability artifact revision used as the prerequisite. AI never decides
applicability.

## Assessments and generated artifacts

`assessments` is the stable workflow record. `assessment_revisions` and their
answer rows are immutable submitted sources. New answers create a new revision
instead of mutating the previous one.

`generated_artifacts` is the stable result identity. It has two intentionally
different pointers:

- `current_revision_id`: newest generated, reviewed, or approved working
  revision; and
- `accepted_revision_id`: currently authoritative approved business result.

This separation lets a candidate Gap-Analyse coexist with the accepted result.
Corrections create another complete revision; approval updates the accepted
pointer transactionally. `artifact_revision_sources` pins the questionnaire,
applicability result, release, and immutable document versions used by a result.

## Organization document evidence

Documents are organization-wide evidence, not children of one Gap assessment.

- `documents` is the stable identity and holds the current-version pointer.
- `document_versions` stores immutable file metadata, storage path, content
  hash, MIME type, size, and version number.
- `document_extractions` records extraction attempts and extracted text state.
- `document_chunks` stores citeable text segments and a maintained PostgreSQL
  search vector.
- `document_embedding_generations` records the embedding model/dimension and
  processing status.
- `document_chunk_embeddings` stores 1,536-dimension pgvector values.

The private source file is stored in the Supabase bucket
`organization-evidence`. `004_gap_evidence_infrastructure.sql` owns the vector
extension, chunk search-vector trigger, HNSW index, private bucket, and
append-only audit trigger.

Archiving is non-destructive. Historical document versions referenced by an
artifact or plan remain available for reproducibility.

## Reassessment drafts

`gap_reassessment_drafts` persists the shared organization workflow for one
assessment. It pins the base accepted result, latest saved questionnaire
revision, gap release, AI run, and output candidate. Its states are `open`,
`locked`, `generated`, `failed`, and `cancelled`.

`gap_reassessment_draft_documents` pins the exact selected document versions
and records whether each was carried from accepted evidence, replaced by a
current version, or explicitly added. A partial unique index permits at most one
open draft per assessment. `lock_version` provides optimistic concurrency, and
generation locks the input before the external model call.

Preparing or editing a draft does not call AI. Failed locked input is retried
explicitly; a generated candidate is never mutated by later uploads.

## AI runs, findings, and review

`ai_processing_runs` and `ai_processing_run_inputs` make each model call durable
and pin its input hash, prompt/model metadata, and source records. The generation
service retrieves evidence only from the selected immutable document versions.

`gap_findings` normalizes one result per applicable requirement.
`gap_finding_evidence` stores exact question or document citations, and
`gap_finding_review_resolutions` records human resolution history. Invalid or
incomplete structured output fails closed before a result revision is stored.
Review corrections copy the complete result into a new immutable revision.

## Action plans

`action_plans` stores the one fixed plan produced atomically from the approved
Gap revision.
`action_plan_items` stores the immutable baseline derived from a finding plus
mutable operational fields such as status, responsible user, and due date.
The current lifecycle creates at most one fixed action plan per organization.
There is no refresh, replacement, or reconciliation workflow.

## Audit history

`audit_events` records material publication, activation, document, generation,
review, input-draft, and action-plan actions. The
Supabase `004` script installs a trigger that rejects update or delete attempts,
making this activity stream append-only at the database boundary.

## Authoring and deployment

Reviewed applicability release sources live under
`src/server/compliance/nis2/releases/`; Gap-Analyse releases live under
`src/server/gap-analysis/releases/`. Publication validates content and writes an
immutable release. Publishing never activates.

For a disposable development database, follow the security runbook and then
publish both workflows as needed:

```powershell
$env:DB_CLEAR_CONFIRM='clear-app-tables'
npm.cmd run db:clear
# Run SQL Editor 004 once before db:push.
npm.cmd run db:push
# Run SQL Editor 004 again, followed by 001, 002, and 003.
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
npm.cmd run db:publish:gap -- --release nis2-gap/demo-v1
npm.cmd run db:activate:gap -- --release nis2-gap/demo-v1
Remove-Item Env:DB_CLEAR_CONFIRM
```

Run this destructive sequence only after confirming that the configured
database is the intended disposable target. Rollback changes active release or
active plan pointers; it does not rewrite historical records.

## Compliance runtime reads

`src/server/compliance/runtime-release/` is the only applicability release-
loading seam. Its PostgreSQL assembler loads independent release sections
concurrently and assembles immutable locale-specific lookup bundles in memory.

App Router code caches only successful immutable bundles. The mutable active-
release pointer, authorization, organization facts, assessments, results, guest
sessions, documents, drafts, and plans remain outside that cache. Standalone
publisher, activator, smoke, and diagnostic scripts use the direct reader and
must not invoke Next cache APIs.

The read-only runtime benchmark is:

```powershell
npm.cmd run db:benchmark:compliance -- --organization-id <uuid> --user-id <uuid> --samples 3 --assert
```

Applicability submission preparation happens before the write transaction.
Within the transaction, answer and fact persistence is set-based; revision,
artifact, projection, provenance, pointer, and guest-claim changes remain
atomic.
