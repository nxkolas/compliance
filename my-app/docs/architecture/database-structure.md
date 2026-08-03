# Database structure

Status: current simplified schema as of 2 August 2026.

`src/db/schema.ts` is the source of truth. The application owns executable
questionnaires, rules, requirement metadata, mappings, prompts, and localized
copy. PostgreSQL stores customer state, immutable snapshots, direct lineage,
AI provenance, evidence, durable operations, legal-source history, and audit.

## Domain model

- Organizations: `organizations`, minimal `user_profiles`, existence-based
  `organization_memberships`, and pending-only `organization_invitations`.
- Submissions: one stable `assessments` row per organization/kind, immutable
  `assessment_revisions`, and localized `assessment_answers`. Submitted guest
  checks live temporarily in `guest_applicability_checks` until claim or expiry.
- Generated analysis: one `analysis_outputs` identity per organization/kind and
  immutable `analysis_output_revisions`. Each revision directly pins its
  assessment; Gap also pins its source applicability revision and selected
  immutable document versions.
- Gap work: one unfinished `gap_analysis_cycles` row, selected versions in
  `gap_analysis_cycle_documents`, normalized `gap_findings` and `gap_items`,
  and exact citation links to `ai_processing_run_context`. Finding links record
  evidence relationship (`supporting` or `conflicting`) separately from
  resolution disposition (`admitted` or `rejected`).
- Documents: `documents` is the stable identity, `document_versions` owns one
  indexing lifecycle, and `document_chunks` stores text, search data, and the
  vector directly.
- AI: `ai_processing_runs` stores the actual provider/model, a per-operation
  idempotency key, attempt/token usage, prompt/build identity, validated input
  and output, claim validation, diagnostics, and lifecycle. A validated run
  remains `processing` until its business result publishes atomically.
  `ai_processing_run_context` is the canonical admitted evidence record.
- Downstream products: one `action_plans` row per organization with immutable
  generated items and status-only mutation; immutable `reports` use direct
  applicability, Gap, optional plan, document, job, and PDF lineage.
  A pending report has no input hash. The successful render attempt hashes the
  exact in-memory snapshot, including current item statuses, and commits that
  hash with all PDF metadata in one fenced transaction.
- Operations: `background_jobs`, `upload_sessions`, and `idempotency_records`
  hold small validated result locators inline; rate-limit windows are durable.
- Legal evidence: corpus families point to immutable current snapshots.
  Snapshots pin exact successful source-version/rendition/processing members;
  source versions, renditions, processing generations, chunks, embeddings, and
  reviewed stable-provision bindings remain independently versioned. Operator
  provisioning creates that lineage before snapshot activation.
- Audit: organization and platform audit streams are append-only.

## Lifecycle rules

Completed assessment/output revisions, findings/items, generated Action Plan
content, document versions, reports, corpus snapshots, and audit rows are never
updated. Stable parents alone carry mutable current pointers. A contradiction
decision creates a new Gap revision: questionnaire-authoritative decisions mark
conflicting document contexts rejected; document-authoritative decisions run a
one-finding regeneration against those exact excerpts.

Job-linked AI-run creation and Action Plan/report publication lock the parent
job and require the executing worker to own its current, unexpired lease. A
candidate produced after lease turnover is discarded rather than published.

Organizations are archived, not customer-deleted. Membership deletion removes
access, invitations are deleted when accepted/revoked/expired, and at least one
Owner must remain. Each organization can create one Action Plan ever.

## Security and rollout

Both chunk search vectors are stored generated columns declared by Drizzle;
their GIN indexes are also Drizzle-owned. Every public application table is
declared with RLS enabled. Browser roles have
no policies; application access uses authenticated, capability-checked,
organization-scoped server services. Every disposable schema change must use
the guarded plan/apply workflow, which includes server-only verification and a
final zero-drift explanation.

This disposable pre-production cutover uses the canonical guarded schema
workflow without a data migration. The only operator SQL creates the `vector`
extension before push and the two append-only audit triggers after push. See
the [disposable schema runbook](../database/drizzle-workflow.md).
