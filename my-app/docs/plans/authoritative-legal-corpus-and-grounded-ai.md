# Authoritative Legal Corpus and Grounded AI

Status: proposed implementation plan; product and architecture decisions confirmed
on 2026-07-22.

## Outcome

Build one controlled source boundary for every production AI feature:

1. Platform Administrators curate primary law, official guidance, and reviewed
   secondary material in a private, versioned legal corpus.
2. Legal-source bytes, derived text, citation anchors, chunks, and embeddings
   remain immutable and reproducible.
3. Compliance and Gap-Analyse releases pin exact corpus-family releases instead
   of reading whatever is newest.
4. AI receives only server-selected legal excerpts, selected Organization
   Evidence, deterministic workflow data, and explicit source identifiers.
5. Every material legal or organization-specific claim must resolve to a
   supplied citation; unsupported output abstains or fails closed.
6. Every model disclosure and resulting claim remains attributable to an exact
   provider, prompt, retrieval query, corpus release, evidence version, and
   chunk.

The model may synthesize, compare, and recommend. Its pretrained knowledge is
never treated as evidence, and it receives no browsing or autonomous source-
discovery tools.

## Confirmed boundaries

- Legal sources are centrally curated and shared; Organization Evidence remains
  private to one organization.
- Corpus families are scoped by framework and jurisdiction. A workflow release
  may compose and pin several exact family releases.
- Authority tiers are primary authority, official guidance, and curated
  secondary material.
- A single Platform Administrator may curate, review, publish, and activate,
  but each action is separately audited.
- Direct upload and administrator-supplied URL import are supported. Autonomous
  crawling is not.
- Legal processing is asynchronous in a dedicated trusted Node worker.
- Legal and organization retrieval are separate channels with independent
  filtering, quotas, and citation rules.
- Published or referenced content is never hard-deleted.
- External models may receive only the minimum retrieved excerpts under an
  approved-provider policy.
- Gap generation and other long-running model operations migrate to durable
  jobs and polling.

These decisions are recorded in docs/adr/0001 through docs/adr/0033 and the
canonical vocabulary is in CONTEXT.md.

## Existing architecture to preserve

The implementation extends rather than replaces:

- legal_instruments, legal_instrument_versions, and legal_provisions for the
  deterministic legal model;
- compliance_check_releases and gap_analysis_releases for immutable workflow
  publication and activation;
- documents, document_versions, extraction/chunk/embedding generations, and
  the private organization-evidence bucket;
- ai_processing_runs and ai_processing_run_inputs for durable model provenance;
- strict Gap-Analyse response validation and fail-closed persistence;
- generated artifact accepted/current revision separation; and
- append-only organization audit history.

The existing legal-instrument tables remain the normalized legal identity used
by deterministic applicability rules. Corpus sources may reference an
instrument version or provision, but guidance, standards, and commentary must
not be forced into the legal-instrument model.

## Target dependency flow

    administrator-selected source
      -> immutable source version and language rendition
      -> durable parse/OCR/chunk/embed job
      -> reviewed processing generation
      -> published corpus-family release
      -> pinned by compliance or gap release
      -> Grounding Gateway retrieval policy
         -> legal channel
         -> organization-evidence channel
      -> source-labelled prompt
      -> structured model output
      -> deterministic citation and claim validation
      -> immutable AI run, context disclosure, and artifact revision

No mutable active-corpus pointer may be consulted inside a historical or
in-progress assessment. Runtime follows the corpus releases pinned by the
workflow release.

## Data model

Names below are the intended table responsibilities. Exact Drizzle names may be
adjusted only to fit established repository naming conventions.

### Platform administration and common jobs

Add:

- platform_administrators: Supabase Auth user ID, active state, creator, and
  lifecycle timestamps. It is server-only and independent of organization
  membership.
- background_jobs: kind, scope, status, priority, payload hash, attempts,
  maximum attempts, available time, lease owner/expiry, progress, safe error,
  result reference, cancellation state, initiator, and timestamps.
- idempotency_records: actor/scope, operation, key, request fingerprint,
  response status/body reference, expiry, and completion state.
- upload_sessions: bucket, immutable proposed object path, expected media type
  and size, optional expected hash, state, scope, initiator, expiry, completion,
  and resulting resource.
- platform_audit_events: actor, event type, entity type/ID, safe metadata, and
  timestamp. Keep this separate from audit_events because the latter currently
  requires an organization.

Job claims use a transaction with skip-locked semantics, a finite lease, and a
heartbeat. An expired lease makes work claimable again. Handlers must be
idempotent because delivery is at least once.

### Corpus identities and versions

Add:

- legal_corpus_families: stable code, framework, jurisdiction, title, and
  lifecycle state.
- legal_sources: stable source identity, family, source kind, Authority Tier,
  canonical publisher, optional legal instrument/provision relationship, and
  withdrawal state.
- legal_source_versions: immutable edition identity, official identifier,
  upstream publication/retrieval metadata, legal effective interval, content
  hash, review/publication state, supersession relationship, and withdrawal
  reason.
- legal_source_renditions: immutable language-specific file identity,
  translation status, authoritative-rendition relationship, storage bucket/
  path, MIME type, byte size, content hash, and uploader/import provenance.
- legal_source_processing_generations: rendition, parser/OCR/chunker/embedding
  configuration, state, hashes, quality metrics, reviewer, and timestamps.
- legal_source_chunks: generation, stable order, text, text hash, page, section,
  provision, bounding/structural metadata where available, token count, and
  full-text search vector.
- legal_source_chunk_embeddings: generation, chunk, provider/model/dimensions,
  and vector.

Constraints:

- effectiveTo cannot precede effectiveFrom;
- authoritative-language links cannot cross source versions;
- a machine-assisted or reviewed-internal rendition must link to its
  authoritative rendition;
- a reviewed processing generation must be complete and have reliable anchors;
- published versions, generations, and chunks use restrictive foreign keys;
- one exact file hash cannot be inserted twice as a new rendition without an
  explicit duplicate acknowledgement;
- withdrawal changes availability for future release assembly only.

Store original files in the private legal-corpus bucket. Store normalized
extraction artifacts in the database when reasonably sized; large structured
parser artifacts may use immutable private object paths with hashes in the
database.

### Corpus publication

Add:

- legal_corpus_releases: immutable release identity, one corpus family,
  semantic label, content hash, status, publisher, publication timestamp, and
  evaluation state.
- legal_corpus_release_members: release, ordered source version, language
  rendition, and approved processing generation.
- active_legal_corpus_releases: one mutable authoring/default pointer per family.
- legal_corpus_release_activations: append-only activation history, including
  evaluation result or emergency override reason.
- compliance_check_release_corpus_releases: exact family releases pinned by a
  compliance release.
- gap_analysis_release_corpus_releases: exact family releases pinned by a gap
  release.

Publishing validates uniqueness, hashes, review status, family consistency,
effective dates, translation provenance, anchors, embedding compatibility, and
all restrictive references. Publishing never activates.

Existing repository-defined compliance and gap publishers must be extended to
require the expected corpus families and pin their exact release IDs. A release
that has no required corpus family is incomplete and cannot activate once the
cutover flag is enabled.

### Controlled URL monitoring

Add:

- legal_source_monitors: exact administrator-supplied URL, schedule, expected
  source, conditional request metadata, active state, and last check.
- legal_source_monitor_checks: response status, final URL, headers/hash,
  detected change, safe error, and timestamp.
- legal_source_change_alerts: old/new hash, candidate-version relationship,
  resolution state, resolver, reason, and timestamps.

A changed URL creates an alert or draft version. It never updates a published
version or activates a release.

### AI provider policy and disclosure provenance

Add or extend:

- organization_ai_provider_policies: optional allowed provider modes, external
  disclosure permission, retention classification, and version.
- ai_processing_runs: allow operations not tied to an assessment, add job ID,
  policy version, corpus-release-set hash, cancellation state, and complete
  token/cost metadata. Preserve existing run IDs and historical semantics.
- ai_processing_run_inputs: add legal corpus release/source/generation input
  kinds without weakening existing source hashes.
- ai_processing_run_context: one row per prompt-local citation with channel,
  citation ID, query hash, retrieval rank/score, source/chunk reference,
  immutable excerpt hash/snapshot, disclosure flag, and ordering.
- ai_processing_run_claims: validated material claims, cited context IDs,
  validation result, and safe failure reason when the output contract benefits
  from claim-level persistence.

Prefer typed nullable foreign keys with database check constraints over an
unconstrained polymorphic source ID. If a single context table becomes
unwieldy, use legal and organization context child tables behind one service
interface.

## Grounding Gateway

Create src/server/ai/grounding/ as the only production model-call boundary.

Suggested modules:

- policy.ts: resolves feature policy, pinned corpus families, as-of date,
  allowed evidence, provider restrictions, quotas, and minimum citations.
- legal-retrieval.ts: retrieves only from pinned legal processing generations.
- organization-retrieval.ts: wraps and strengthens current selected-version
  retrieval.
- context-builder.ts: assigns stable prompt-local IDs and preserves channel
  separation.
- provider-policy.ts: chooses an allowed provider and minimizes disclosed text.
- prompt-runner.ts: calls the provider without browsing/search tools.
- validation.ts: verifies structured output, allowed source IDs, claim support,
  tier/translation rules, conflicts, and abstention.
- provenance.ts: stores the exact input sources, retrieval results, disclosure,
  provider/model, prompt hashes, usage, and result linkage.
- types.ts: narrow feature policy and result interfaces.

The public server-side interface should be deep and feature-oriented:

    runGroundedOperation({
      operation,
      actor,
      organizationId,
      workflowReleaseId,
      asOfDate,
      organizationEvidenceVersionIds,
      queryUnits,
      outputContract,
      idempotencyKey
    })

Callers do not choose raw tables, arbitrary corpus releases, citation IDs, or
unvalidated provider configuration.

### Retrieval rules

Legal retrieval:

- resolve corpus releases only from the pinned compliance/gap release;
- filter by framework, jurisdiction, as-of date, language, translation status,
  and the exact published release membership; a later withdrawal is surfaced
  but never changes retrieval for an already-pinned workflow;
- run hybrid full-text/vector retrieval inside each required family;
- allocate channel and Authority Tier quotas before ranking;
- retain conflicting authorities in context and mark them for review;
- never substitute a newer processing generation;
- prefer authoritative-language text for claim support while permitting linked
  renditions for discovery and explanation.

Organization retrieval:

- authorize the organization and explicit immutable document versions;
- retrieve only succeeded generations for the pinned embedding configuration;
- treat questionnaire answers as assertions, not documentary proof;
- never let organization evidence substantiate what the law requires;
- preserve the current rule that fulfilled requires documentary evidence.

Start with deterministic weighted hybrid retrieval and measured per-channel
limits. Reranking is deferred until evaluations demonstrate a concrete need.

### Citation and output rules

Use channel-specific IDs, for example LEGAL:<chunk-id>, DOC:<chunk-id>, and
Q:<answer-id>. The model sees only assigned IDs.

Validation must prove:

- every requested requirement/query unit appears exactly once where required;
- every returned citation was supplied for that unit;
- every material legal claim has a valid legal-channel citation;
- every organization-implementation claim has organization evidence or is
  clearly labelled an assertion/assumption;
- secondary or non-official translations are not the sole support for a
  binding claim;
- conflicts set review-required state and are not silently resolved;
- missing support produces the feature's explicit insufficient-information
  result;
- partial or invalid batches persist no business artifact.

Citation views resolve the immutable excerpt, title, authority tier,
jurisdiction, language/translation status, legal-effect interval, corpus
release, exact anchor, and authorized original-file link.

## Worker architecture

Add a separately deployable Node entry point under src/worker/ with scripts for
local execution and one-shot processing.

Worker handlers:

- legal-source-import: verify an exact URL, download safely with size/type/time
  limits, hash, store, and finalize a rendition;
- legal-source-process: parse, route scans/layout-heavy files to an isolated
  Docling/OCR adapter, normalize structure, and compute quality metrics;
- legal-source-embed: chunk and embed using recorded configuration;
- legal-source-monitor: perform conditional checks and create alerts;
- grounding-evaluation: run activation fixtures and persist metrics;
- gap-generation: execute the locked draft through the Grounding Gateway;
- pdf-report: owned by the API completion plan but uses the same job runtime;
- cleanup: expire upload/idempotency records and remove only eligible,
  unreferenced draft objects.

The Node worker may call a separately isolated Docling service/container; do
not put Python/OCR dependencies inside the Next.js runtime. Timeouts, maximum
pages, maximum extracted text, decompression limits, MIME sniffing, malware
scanning integration points, and URL egress protections are mandatory.

## Administrative services and application surface

Implement server services before UI polish:

- corpus family create/list/update;
- source create/list/read/update metadata/withdraw;
- upload-session create/complete;
- exact-URL import and monitor management;
- version/rendition list/read;
- processing enqueue/status/retry/cancel;
- extraction preview and citation-anchor inspection;
- explicit version review;
- release draft/create/member editing;
- publish/evaluate/activate/withdraw;
- change-alert list/resolve;
- controlled original download;
- platform audit reads.

The internal endpoint and typed-client shapes are specified in
internal-api-and-service-completion.md. No browser receives Supabase service
credentials or direct table access.

## Gap-Analyse migration

1. Add corpus pins to the repository demo gap release and publisher.
2. Replace direct retrieveDocumentEvidence plus direct model creation in
   generation-service.ts with a Gap-Analyse Grounding Gateway policy.
3. Retrieve legal context per requirement separately from selected Organization
   Evidence.
4. Extend SuppliedCitation and gap finding evidence persistence for legal
   chunks without weakening existing questionnaire/document rules.
5. Lock the reassessment draft and enqueue a gap-generation job transactionally.
6. Return the existing run/candidate when an idempotency key is replayed.
7. Let the worker persist success/failure and update the draft at safe
   transaction boundaries.
8. Keep accepted results and active plans unchanged until existing explicit
   approval/reconciliation steps.
9. Remove or quarantine lib/ai/rag.ts stubs once no live code references them.

The deterministic Betroffenheitscheck remains AI-free. Legal corpus pins may
support citations and authored release provenance, but applicability evaluation
must continue using compiled deterministic rules.

## Evaluation and activation gates

Create repository fixtures per corpus family:

- direct provision lookup;
- cross-language lookup;
- effective-date boundary;
- repealed-source exclusion;
- primary/guidance/secondary conflict;
- organization evidence contradicting questionnaire assertions;
- prompt injection inside a source;
- no matching source and mandatory abstention;
- invalid/unknown citation ID;
- secondary-only and unofficial-translation-only legal claims;
- tenant-crossing retrieval attempt.

Record retrieval recall/precision-at-k, citation validity, claim support,
abstention correctness, conflict detection, latency, and token/cost bounds.
Corpus activation runs deterministic integrity checks plus the required
fixtures. An emergency override stores the failed metrics, actor, reason, and
activation history.

Default tests use fake embedding/model providers. Live provider evaluations
remain explicit and cost-gated.

## Implementation phases

### Phase 0: Protect the baseline

1. Add tests proving current gap generation, approval, staleness, document
   retrieval, and action-plan behavior.
2. Add feature flags for corpus-pinned grounding and worker-backed generation.
3. Document required environment configuration without committing secrets.

### Phase 1: Common durable primitives

1. Add Platform Administrator registry/bootstrap script.
2. Add background jobs, idempotency records, upload sessions, and platform
   audit events.
3. Implement leases, heartbeats, retries, cancellation, cleanup, and common job
   status service.
4. Apply server-only RLS/grant SQL and verification queries.

### Phase 2: Corpus storage and immutable model

1. Create the legal-corpus private bucket and signed upload/fetch policies.
2. Add corpus family/source/version/rendition/processing/chunk/embedding tables.
3. Add legal-instrument/provision reference seams and temporal/translation
   constraints.
4. Implement controlled upload completion and URL-import creation.

### Phase 3: Processing worker

1. Extract the current parser/chunker/embedding abstractions from organization-
   specific persistence.
2. Implement the legal processing pipeline and idempotent handlers.
3. Add Docling/OCR adapter isolation and anchor-quality checks.
4. Add processing preview, review, retry, cancellation, and operational metrics.

### Phase 4: Publication and monitoring

1. Add family release assembly, validation, content hashing, publication,
   evaluation, activation, and withdrawal.
2. Add URL monitors, checks, candidate versions, and alerts.
3. Add compliance/gap release joins and completeness validation.
4. Seed a small reviewed NIS2 EU/DE corpus fixture without claiming legal
   completeness.

### Phase 5: Two-channel retrieval

1. Implement corpus-pinned legal hybrid retrieval with temporal/tier/language
   filters.
2. adapt Organization Evidence retrieval to the common channel interface.
3. Add per-channel quotas, stable citation IDs, and inspectable source views.
4. Benchmark indexes and ensure tenant/family filters occur in SQL.

### Phase 6: Grounding Gateway and provenance

1. Implement policy resolution, provider policy, context building, prompt
   execution, validation, and provenance.
2. Extend AI run/source/context persistence.
3. Add unsupported-claim refusal and conflict rules.
4. Add static enforcement or dependency tests preventing direct production
   provider calls outside approved adapters.

### Phase 7: Asynchronous Gap-Analyse cutover

1. Pin corpus family releases in gap publication.
2. Move generation behind the Gateway and worker job.
3. Update route, client polling, UI state, retries, cancellation, and audit.
4. Backfill historical run provenance where possible; mark unknown fields
   explicitly rather than inventing them.

### Phase 8: Activation, rollout, and removal

1. Run unit, integration, authorization, worker, retrieval, and AI evaluations.
2. Publish and evaluate corpus releases before enabling pinned grounding.
3. Enable one organization/environment first and compare results/cost.
4. Enable by default, then remove the legacy direct generation path.
5. Update database structure, security runbook, product workflow, AI docs, and
   operational recovery instructions.

## Migration and rollback

- All initial schema changes are additive.
- Existing Organization Evidence remains valid and readable.
- Backfill new generation references from current succeeded extraction and
  embedding rows; never rewrite historical hashes.
- Create corpus releases before requiring corpus pins on newly published gap
  releases.
- Rollback changes the feature flag or active release pointer; it never deletes
  corpus versions, jobs, AI runs, or historical artifacts.
- A failed worker deployment leaves durable jobs retryable after the previous
  worker version is restored.
- Do not enable the cutover until both the web deployment and worker understand
  the new job/run states.

## Verification

Required automated checks:

- schema constraints and restrictive deletion;
- storage path/bucket scope and signed-link authorization;
- URL-import egress, size, redirect, and hash behavior;
- job lease expiry, duplicate delivery, retry, and cancellation;
- source review/publication/activation state machine;
- temporal, jurisdiction, tier, and translation retrieval filters;
- cross-tenant and cross-family isolation;
- provider-policy fail-closed behavior;
- exact context disclosure and citation resolution;
- unsupported-claim, conflict, and prompt-injection behavior;
- Gap-Analyse idempotency and accepted-result preservation;
- RLS/grant verification and append-only audit triggers.

Run at minimum:

    npm.cmd run lint
    npx.cmd vitest run tests evals
    npm.cmd run test:ai
    npm.cmd run build

Add worker typecheck/test and corpus publish/evaluate/smoke scripts to
package.json. Database-backed smoke tests must verify the private bucket,
server-only grants, publication, pinned retrieval, job execution, citation
inspection, and rollback pointer behavior.

## Acceptance criteria

- No production AI call can bypass the Grounding Gateway.
- No model has a browsing/search tool or autonomous corpus-discovery path.
- Every legal retrieval is constrained to workflow-pinned corpus releases.
- Every Organization Evidence retrieval is constrained to the authenticated
  organization and explicit immutable versions.
- Legal and organization evidence cannot displace or masquerade as each other.
- Every material persisted claim is cited, validated, or explicitly marked
  insufficient/unsupported.
- A citation resolves to exact immutable text and legal provenance.
- Published/referenced source history survives withdrawal and reprocessing.
- Non-official translations and secondary sources cannot independently present
  a binding claim.
- External disclosure follows the effective provider policy and records exact
  disclosed chunks.
- Processing/generation requests are durable, idempotent, observable,
  cancellable as agreed, and safe under duplicate delivery.
- Corpus activation is evaluation-gated with only an explicit audited override.
- Historical accepted artifacts and active plans are never silently changed.

## Deferred

- autonomous crawling or autonomous legal-source selection;
- automatic publication/activation after upstream changes;
- AI-determined applicability, severity, priority, or approval;
- unrestricted whole-document disclosure to model providers;
- unmeasured neural reranking or hidden model-output repair;
- general-purpose AI chat until its product workflow is designed;
- mandatory four-eyes corpus publication; and
- permanent erasure of published or referenced source history.

## Related documents

- ../architecture/database-structure.md
- ../database/supabase-security-runbook.md
- ../product/gap-analysis-current-workflow.md
- ./immutable-compliance-release-architecture.md
- ./document-management-reassessment-and-plan-reconciliation.md
- ./internal-api-and-service-completion.md
- ../../CONTEXT.md
