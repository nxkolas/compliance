# Database structure

Status: current schema overview as of 2026-07-24.

`src/db/schema.ts` is the source of truth for ordinary application tables,
columns, enums, relations, constraints, indexes, and RLS enablement. Every
Drizzle table enables RLS and declares no browser policy, so browser access is
default-deny. Apply it with `npm.cmd run db:push`. Supabase-only extensions,
search infrastructure, storage, audit-trigger, and retention operations live
under `supabase/sql-editor/` and are documented in the
[Supabase security runbook](../database/supabase-security-runbook.md).

## Ownership and authorization

`organizations` is the tenant boundary. `organization_memberships` assigns the
roles `owner`, `admin`, `member`, and `auditor`; invitations are separate
records. Organization-owned workflow tables carry an organization ID directly
or are constrained through organization-scoped foreign keys.

Browser roles have no supported direct table-access path. Next.js pages and API
routes authenticate the user and enforce organization permissions in server
services. Default-deny RLS must be verified after every schema rollout.

## Immutable compliance releases

The deterministic NIS2 checker uses four layers:

1. Stable identities: frameworks, facts, sectors, entity types, legal
   instruments, and content items.
2. Immutable versions: content revisions/translations, legal-instrument
   versions/provisions, scope-model entity versions, threshold sets,
   jurisdiction profiles, framework versions, questionnaire versions, and
   compiled rule sets. Framework versions pin localized framework name and
   description revisions; modules pin their localized name revision; and
   questionnaire versions pin their localized title revision.
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
- `gap_requirement_versions` stores immutable structural requirement data,
  criticality, and required revision pins for the localized title and
  prompt-facing requirement text. Those pins resolve through
  `content_revisions` and `content_translations`.
- `gap_requirement_question_mappings` assigns each release question to one
  requirement category. `gap_question_legal_provisions` preserves each
  question's exact versioned legal provisions. Runtime requirement references
  are the ordered, deduplicated relational union; no legal-reference JSON copy
  remains.
- Requirement-set versions pin both their localized title revision and exact
  requirement versions.
- `gap_analysis_releases` pins the questionnaire, requirement set, prompt
  metadata, response contract, evaluator, and compatible applicability
  release. Provider authorization is organization policy; the selected
  provider/model is recorded on the AI run rather than duplicated on a release.
- Active-release pointers and activation history use the same publish-then-
  activate separation as the applicability checker.

An organization Gap assessment pins both its gap release and the exact approved
applicability artifact revision used as the prerequisite. AI never decides
applicability.

## Assessments and generated artifacts

`assessments` is the stable workflow record. `assessment_revisions` and their
answer rows are immutable submitted sources. New answers create a new revision
instead of mutating the previous one.

`gap_questionnaire_drafts` and `gap_questionnaire_draft_answers` are the shared
mutable projection used before submission. Every acknowledged autosave
increments the draft version; stale writes fail their precondition. Submission
copies one exact draft version into immutable assessment answers and writes one
immutable `assessment_requirement_evaluations` row per supported guided
category.
Those deterministic statuses stay server-side until generation.

Answers and organization facts use typed scalar columns plus relational option
tables. Database checks enforce the representation allowed by each answer/fact
type, and composite foreign keys prove that every selected option belongs to
the same question or fact definition. JSON is retained only for genuinely
structured values.

`generated_artifacts` is the stable result identity. It has two intentionally
different pointers:

- `current_revision_id`: newest generated, reviewed, or approved working
  revision; and
- `accepted_revision_id`: currently authoritative approved business result.

This separation lets a candidate Gap-Analyse coexist with the accepted result.
Corrections create another complete revision; approval updates the accepted
pointer transactionally. Lineage is typed: artifact, assessment, and document
sources live in `artifact_revision_artifact_sources`,
`artifact_revision_assessment_sources`, and
`artifact_revision_document_sources`. Composite ownership foreign keys reject
cross-organization and cross-parent references.

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

`ai_processing_runs` and the typed
`ai_processing_run_{artifact,assessment,document}_inputs` tables make each model
call durable and pin its input hash, prompt/model metadata, and source records.
Legal inputs remain explicit in `ai_processing_run_legal_inputs`.
`legal_source_chunk_provisions` records reviewed exact-anchor bindings from
operative legal provisions to the official corpus chunks that contain them;
one instrument chunk may represent several mapped subparagraphs without
duplicating the underlying source or embedding.
`ai_processing_run_context` records the versioned retrieval policy, allowlisted
lexical/semantic/combined scores, mapped-provision role, and compact diagnostic
snapshot for every admitted context row. The generation service retrieves
evidence only from selected immutable document versions and admits no
organization chunk below the pinned relevance floor.

`gap_findings` is the sole authority for one result per applicable requirement.
It stores the server-owned guidance mode and hashed guidance basis, structured
objective/deliverables/acceptance criteria/suggested evidence, and the exact AI
run that authored the current guidance. Database checks pair status with
guidance mode and prohibit execution guidance on fulfilled findings.
`gap_finding_evidence` stores exact question or document citations, and
`gap_finding_review_resolutions` records human resolution history. Invalid or
incomplete structured output fails closed before a result revision is stored.
The revision JSON is metadata-only (`gap_revision_metadata_v1`); it cannot
contain a duplicate `findings` array. Material review corrections regenerate
the target finding first, then copy normalized rows and evidence into a new
immutable revision atomically. Unchanged findings preserve their guidance-run
lineage.

## Action plans

`action_plans` stores the one fixed plan produced atomically from the approved
Gap revision.
`action_plan_items` stores immutable measure type, source recommendation,
objective, deliverables, acceptance criteria, and suggested-evidence snapshots
derived from a finding. Only status, responsible user, due date, and separate
execution notes are mutable.
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

For ordinary schema changes, follow the current
[Drizzle schema-change workflow](../database/drizzle-workflow.md): verify the
target, preview and review the DDL, apply it, verify RLS, and require a second
zero-drift preview. Drizzle owns tables, constraints, indexes (including both
HNSW indexes), and RLS enablement. Operator SQL owns extensions, scheduled
jobs, and audited triggers.

```powershell
npm.cmd run db:push -- --explain
npm.cmd run db:push
npm.cmd run db:verify:server-only
npm.cmd run db:push -- --explain
```

Database clearing, reseeding, the former two-pass constraint procedure,
`--strict`, and `--force` are not part of ordinary schema operations.

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

## Persistence module boundaries

Production routes, pages, and worker orchestration call the public module
entries under `src/server/*/index.ts`. They do not import `src/db/schema.ts` or
another module's private persistence files. Production relational reads use
explicit column projections; schema-management, verification, and benchmark
operator commands are the intentionally narrow exceptions. The static
`persistence-architecture` test enforces these boundaries.

Module-level performance gates are:

```powershell
npm.cmd run db:benchmark:compliance -- --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npx.cmd tsx scripts/benchmark-gap-workflow.ts --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npx.cmd tsx scripts/benchmark-corpus-document-runtime.ts --organization-id <uuid> --user-id <uuid> --samples 3 --assert
npm.cmd run db:benchmark:indexes
```
