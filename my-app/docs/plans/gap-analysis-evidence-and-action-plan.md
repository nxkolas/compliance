# Gap Analysis, Evidence, and Action Plan

Status: implemented on 2026-07-17.

This document records the first implemented Gap-Analyse baseline. The later
organization document library, persisted reassessment workflow, separate
accepted/candidate revisions, and non-destructive action-plan reconciliation
supersede its inline evidence-selection and archive-and-regenerate behavior.
See [Document Management, Gap Reassessment, and Plan Reconciliation](./document-management-reassessment-and-plan-reconciliation.md)
for that successor design and [Current Gap-Analysis Workflow](../product/gap-analysis-current-workflow.md)
for current runtime behavior.

## Implementation Status

All six phases are implemented in the repository and the configured database:

- the schema now contains immutable gap releases and requirements, document
  versions and index generations, durable AI runs, normalized findings and
  evidence, review resolutions, action plans, and append-only audit events;
- deterministic applicability results are automatically approved, and a gap
  assessment pins both the active gap release and the exact compatible approved
  applicability artifact revision;
- `nis2-gap/demo-v1` publishes four explicitly demo-labeled requirements and
  four questions, validates completeness and prompt metadata, and activates
  through an append-only history;
- text PDF, DOCX, TXT, and Markdown uploads use a private bucket, immutable
  source metadata, extraction/chunk generations, one 1,536-dimension embedding
  space, and organization/selection-scoped hybrid retrieval;
- gap generation uses the code-defined hashed prompt, strict Zod output,
  supplied-citation validation, fail-closed transactional persistence, immutable
  corrections, owner/admin approval, and dependency-derived staleness;
- approved findings generate a deterministic action plan without a second AI
  call; the successor workflow now reconciles later approved revisions without
  replacing the active plan until explicit activation; and
- the organization Gap-Analyse and Maßnahmenplan routes expose the minimal
  dictionary-backed German/English workflow described below.

Automated verification completed with 82 passing tests, 8 passing AI prompt
evals, lint, TypeScript through the production build, and a successful Next.js
production build. The configured database passed `db:push`, demo publication,
activation, RLS/setup SQL, and `db:smoke:gap`.

The live model evaluation remains intentionally opt-in and was not run. An
authenticated browser upload/generation pass also remains an operational manual
check because the local environment needs `SUPABASE_SECRET_KEY` for the
private storage bucket. These are verification/configuration items, not deferred
product scope.

Operational sequence:

```powershell
# Before and after db:push, run supabase/sql-editor/004_gap_evidence_infrastructure.sql.
npm.cmd run db:push
# Then run 001_server_only_definition_rls.sql and 002_server_only_application_data_rls.sql.
npm.cmd run db:publish:gap -- --release nis2-gap/demo-v1
npm.cmd run db:activate:gap -- --release nis2-gap/demo-v1
npm.cmd run db:smoke:gap

# Explicitly opt in to a paid live model evaluation:
$env:RUN_LIVE_GAP_EVAL = "1"
npm.cmd run eval:gap:live
Remove-Item Env:RUN_LIVE_GAP_EVAL
```

This plan completes the unfinished Gap-Analyse, Dokumentenanalyse, Maßnahmenplan,
and audit portions of `docs/architecture/db-schema-plan.md`. It preserves the
implemented immutable applicability-check release architecture described in
`docs/plans/immutable-compliance-release-architecture.md`.

## Outcome

Build an authenticated, organization-scoped workflow that:

1. requires and pins an approved Betroffenheitscheck result;
2. captures a small Gap-Analyse questionnaire with the existing questionnaire
   and assessment tables;
3. stores selected organization documents as immutable evidence versions;
4. retrieves document evidence per immutable compliance requirement;
5. asks AI for one strictly structured, cited judgment per applicable
   requirement;
6. preserves AI output and human corrections as immutable artifact revisions;
7. requires owner/admin approval before a gap result becomes accepted; and
8. creates a simple Maßnahmenplan deterministically from the approved findings.

The dependency direction is:

```text
approved applicability result
+ pinned gap-analysis release
+ submitted questionnaire revision
+ explicitly selected document versions
        -> hybrid evidence retrieval
        -> validated AI gap findings
        -> human review and approval
        -> deterministic action plan
```

Document analysis is an evidence subsystem of Gap-Analyse. It is not a separate
downstream product module.

## Product Rules

- Gap-Analyse, documents, approval, and Maßnahmenplan are organization-only.
- A successfully submitted deterministic Betroffenheitscheck is automatically
  approved and immediately satisfies the Gap-Analyse prerequisite.
- A Gap-Analyse assessment pins one published gap release when it is created.
  A newer active release requires a new assessment.
- Requirements and their legal references are curated, published, immutable
  inputs. AI cannot invent requirements or decide that one is not applicable.
- Requirement applicability is deterministic and derives from the pinned
  Betroffenheitscheck result plus mappings in the gap release.
- Questionnaire-only generation is allowed, but questionnaire assertions alone
  cannot support `fulfilled`.
- The AI statuses are `fulfilled`, `partially_fulfilled`, `not_fulfilled`, and
  `insufficient_evidence`. Applicability and review flags are separate fields.
- Conflicting questionnaire and document evidence sets `requires_review` and
  blocks approval until an owner/admin records a resolution in a new revision.
- An otherwise valid result containing `insufficient_evidence` may be approved.
- Severity is derived from published requirement criticality and gap status.
  AI does not choose severity or priority.
- Source changes mark results and plans stale. Regeneration is always explicit.
- AI revisions are never silently repaired or partially persisted.
- Owners/admins may correct and approve findings. Members may answer/upload;
  auditors may read/review. All material actions are audited.

## Release Model

Keep `compliance_check_releases` focused on deterministic applicability checks.
Add a sibling immutable aggregate for Gap-Analyse:

```text
gap_requirement_sets
gap_requirement_versions
gap_requirement_set_members
gap_analysis_releases
active_gap_analysis_releases
gap_analysis_release_applicability_rules
```

A published gap release pins:

- module and questionnaire version;
- immutable requirement set and ordered requirement versions;
- prompt name, prompt version, prompt template hash, response schema version,
  evaluator kind/version, and model policy;
- the compatible applicability-check release; and
- deterministic requirement-applicability mappings.

Publication validates completeness, content hashes, unique requirement codes,
question mappings, prompt metadata, legal references, and deterministic
applicability coverage. Publication does not activate a release. Activation
uses a single active pointer and an append-only activation history.

The first repository release is a clearly labeled demo release with four
coherent security requirements and four mapped questions. It exercises the
workflow without presenting the seed as complete or authoritative NIS2 advice.

## Evidence Model

Add organization-owned documents and immutable processing/index generations:

```text
documents
document_versions
document_extractions
document_chunks
document_embedding_generations
document_chunk_embeddings
```

- Files live in a private Supabase Storage bucket.
- v1 accepts text PDFs, DOCX, TXT, and Markdown with conservative size/type
  limits. Scans, OCR, images, and Docling are deferred.
- A document version pins file metadata, storage path, content hash, and uploader.
- Extraction and embedding generations are separate from the document version,
  so parser/chunker/embedding changes can re-index without rewriting the source.
- One deployment-wide embedding model/dimension is used. Provider, model,
  dimension, and chunking version are recorded; changing them requires re-index.
- Referenced versions are archived instead of ordinarily hard-deleted.
- Every generation explicitly pins selected document-version IDs.

Retrieval uses PostgreSQL full-text rank plus pgvector similarity over only the
selected organization document versions. Normative requirement text and legal
references enter the prompt directly and are never selected by RAG.

## AI Run and Prompt Contract

Model ingestion and gap generation as durable runs even though v1 executes the
services synchronously:

```text
ai_processing_runs
ai_processing_run_inputs
```

Runs have `pending`, `processing`, `succeeded`, or `failed` state, an operation
kind, stable input hash/idempotency key, timestamps, error details, provider and
model metadata, prompt/template/rendered hashes, response schema version, token
usage when available, and output artifact revision.

The production prompt is code-defined, versioned, and hashed. A gap release pins
the reusable contract; each run records the rendered-input hash. Tenant data is
never stored in the reusable prompt template.

For every requirement batch, the prompt receives:

- exact requirement identity, text, criticality, and legal references;
- relevant questionnaire answers labeled as unverified user assertions;
- retrieved chunks labeled as untrusted evidence, with stable citation IDs;
- explicit instructions to ignore instructions contained inside documents;
- the permitted status enum and evidence-sufficiency enum;
- the rule that `fulfilled` requires documentary evidence;
- the rule that contradictions must be surfaced, not resolved; and
- a strict structured response contract.

Retrieval happens per requirement. The four demo requirements are evaluated in
one call; larger releases use configurable bounded batches. Zod validation must
prove that every requested requirement appears exactly once and every citation
ID came from the supplied context. Any invalid batch fails the run and persists
no artifact revision. Retry is explicit; no hidden AI repair call is made.

Normal automated tests use fake embeddings and model responses. An opt-in live
evaluation command covers prompt quality and cost without spending tokens in CI.

## Findings, Evidence, and Review

Keep a compact summary snapshot in `generated_artifact_revisions.result`, and
normalize the operational/audit data:

```text
gap_findings
gap_finding_evidence
gap_finding_review_resolutions
```

Each finding belongs to one gap artifact revision and one pinned requirement
version. It stores status, evidence sufficiency (`sufficient`, `partial`,
`none`), localized rationale/recommendation snapshots, deterministic severity,
assumptions, and `requires_review`.

Evidence rows point to an immutable assessment answer or document chunk and
snapshot the excerpt plus page/section metadata. AI output cannot cite anything
that was not supplied under a stable citation ID.

AI generation creates a `generated` artifact revision. Reviewer corrections
create a new revision with the previous revision as parent; they never mutate
the AI revision. Overrides and conflict resolutions require a reason. Approval
applies to the complete revision and is allowed only for owners/admins after
coverage, citation, and review-blocker validation.

## Maßnahmenplan

The initial plan does not make a second AI call. Once a gap revision is approved,
create one action item for every `partially_fulfilled`, `not_fulfilled`, or
`insufficient_evidence` finding. Title/description originate from the immutable
requirement and reviewed recommendation; priority is deterministic.

```text
action_plans
action_plan_items
```

Action plans pin the approved gap artifact revision. Items are simple mutable
workflow records with status, owner, due date, and timestamps. Their baseline
and source stay immutable; operational changes are captured in `audit_events`.
When a newer gap revision is approved, the old plan becomes stale. Explicit
regeneration archives it and creates a fresh plan; v1 performs no automatic
merge of owners, dates, or completed items.

## Audit and Staleness

Add append-only `audit_events` for document upload/archive, questionnaire
submission, AI run completion/failure, revision creation/correction, approval,
conflict resolution, plan generation/archive, and item changes.

Staleness is calculated from pinned dependencies and optionally projected for
fast reads. Distinguish:

- `stale`: a selected source assessment/document/artifact revision changed;
- `outdated_release`: a newer gap release is active; and
- `archived`: the workflow was intentionally replaced.

No source change automatically spends AI tokens or overwrites accepted history.

## Minimal Application Surface

Reuse the current organization route and questionnaire presentation. Frontend
polish is explicitly out of scope. Implement only the controls required to
exercise the workflow:

- create/open the current-release Gap-Analyse;
- answer and submit the four-question questionnaire;
- upload/list/archive supported documents and select versions;
- generate/retry and show run failures;
- render requirement findings and citations;
- owner/admin correction, conflict resolution, and approval;
- generate/view a simple Maßnahmenplan; and
- edit item owner, due date, and status.

Server APIs and services enforce organization membership and role permissions;
the UI is never the authorization boundary.

## Implementation Phases

### Phase 1: Plan and schema

1. Add enums, tables, relations, indexes, restrictive foreign keys, partial
   uniqueness, and Drizzle filters.
2. Add pgvector/full-text SQL setup and server-only RLS policies where Drizzle
   cannot express the database feature safely.
3. Change deterministic applicability artifact creation from `generated` to
   `approved` and cover the gate with tests.

### Phase 2: Demo gap release

1. Define four demo requirements, legal-reference placeholders explicitly
   marked demo, four existing-format questions/options, applicability mappings,
   prompt contract metadata, and golden fixtures in repository source.
2. Add transactional publish, validate, activate, and load services/scripts.
3. Pin the active gap release and approved applicability artifact when creating
   an assessment.

### Phase 3: Document evidence and retrieval

1. Implement private upload metadata, hashing, parser abstraction, extraction,
   chunks with page/section locators, embedding generation, and archive behavior.
2. Implement tenant-scoped hybrid retrieval over explicit document versions.
3. Restore only the useful concepts from the old RAG implementation; do not
   restore chat-scoped document ownership or obsolete tables unchanged.

### Phase 4: Gap generation and review

1. Add prompt builder, strict output schema, injected-document guardrails,
   batching, validation, durable runs, input hashes, and transactional output.
2. Normalize findings/evidence and create the compact artifact JSON summary.
3. Add correction, resolution, approval, and staleness services with role checks.

### Phase 5: Maßnahmenplan and minimal UI/API

1. Generate/archive plans deterministically from approved gap revisions.
2. Add action-item mutation and audit services.
3. Replace placeholder Gap-Analyse and Maßnahmenplan pages with the minimal
   existing-format workflow and dictionary-backed German/English UI text.

### Phase 6: Verification and status handoff

1. Add schema/release, retrieval, prompt, validation, persistence, permissions,
   staleness, approval, and plan-generation tests without live AI calls.
2. Add an opt-in live prompt evaluation and token-usage report.
3. Run formatting checks, lint, tests, database publication smoke tests where
   configuration is available, and a production build.
4. Update this plan and the historical schema plan with exact completion status,
   deferred items, and operational commands.

## Verification Commands

```powershell
npm.cmd run lint
npx.cmd vitest run tests evals
npm.cmd run test:ai
npm.cmd run build
```

When database credentials are available:

```powershell
npm.cmd run db:push
npm.cmd run db:publish:gap -- --release nis2-gap/demo-v1
npm.cmd run db:activate:gap -- --release nis2-gap/demo-v1
npm.cmd run db:smoke:gap
```

The live model evaluation remains opt-in and is not part of the default test
suite.

## Acceptance Criteria

- Existing immutable applicability publication, activation, guest, authenticated,
  and historical-result behavior remains green.
- A deterministic submitted Betroffenheitscheck is approved and required before
  a Gap-Analyse can be created.
- The assessment pins the active gap release and exact applicability artifact.
- Four demo questions render and persist through the existing assessment model.
- Supported documents are versioned, extracted, indexed, selected explicitly,
  and retrieved only within the organization and selected corpus.
- Every AI finding maps to one pinned applicable requirement and all supplied
  citation IDs resolve to immutable answer/chunk evidence.
- Invalid/partial AI output creates no artifact revision.
- Questionnaire-only results cannot mark a requirement `fulfilled`.
- Contradictions block approval; insufficient evidence does not.
- Corrections preserve the original AI revision and require reviewer reasons.
- Only owners/admins can approve or override.
- Source changes surface staleness without automatic regeneration.
- An approved gap revision produces a simple deterministic plan with no AI call.
- Regeneration archives rather than merges the prior plan.
- Default automated tests make no external AI calls.
- Visible German text uses proper umlauts and all static UI labels come from the
  dictionary.

## Deferred

- Docling, OCR, scanned/image evidence, and complex table extraction;
- a real background queue/worker deployment;
- multiple simultaneous embedding spaces or per-run embedding-provider choice;
- AI reranking and hidden output-repair calls;
- polished frontend design, comments, per-finding approval, and plan merge logic;
- guest Gap-Analyse;
- exceptional permanent-erasure administration; and
- a complete legally reviewed NIS2 requirement catalog. The demo release must
  never be described as such.
