# Schema Simplification Refactor

Status: decisions complete; ready for implementation  
Database posture: pre-production and disposable  
Schema rollout: Drizzle Kit `push`; no data migration and no generated SQL migration for this refactor

## Problem statement

The current database models Complyx as a configurable compliance publishing
platform: questionnaires, rules, prompts, framework content, national profiles,
Gap requirements, approvals, activations, and several kinds of processing state
all have their own database catalogs and version lifecycles.

That is not the product the application currently provides. The deployed
application owns nearly all executable product definitions. The database is
needed to persist organization state, immutable user submissions, generated
results, exact AI provenance and citations, documents, jobs, reports, execution
progress, legal-source history, and audit events. Requiring product definitions
to be published or activated in the database creates two control planes without
adding user-visible functionality.

The refactor removes the unused control plane and replaces generic or duplicated
persistence with a smaller model aligned with actual behavior.

## Goals

- Make the deployed application the only source of executable questionnaires,
  deterministic rules, Gap requirements, mappings, labels, icons, criticality,
  and prompts.
- Preserve the immutable records required to explain exactly what a user
  submitted, what evidence and legal corpus the AI used, what the application
  generated, and who later changed mutable business state.
- Keep one clear database representation for each live workflow concept.
- Remove inactive approval, activation, publication, regeneration, monitoring,
  and lifecycle machinery.
- Keep PostgreSQL constraints for real relational integrity and keep RLS enabled
  on every public Supabase application table.
- Cut over without preserving pre-production rows.

## Non-goals

- Migrating or backfilling existing application data.
- Supporting production upgrades or rollback migrations.
- Supporting legal jurisdictions other than Germany.
- Adding a result approval workflow.
- Adding general Gap regeneration or arbitrary AI correction features.
- Adding Action Plan replacement, refresh, cancellation, deletion, assignment,
  due dates, or execution notes.
- Adding per-table optimistic-lock columns. A future concurrency policy must be
  implemented consistently at the API boundary, such as with ETags.
- Implementing the Local AI Connector itself. Its design remains a separate
  architecture concern; this refactor only persists the selected provider mode
  and actual provider/model provenance.

## Locked product behavior

### Executable product definitions

- Applicability and Gap questionnaires, options, deterministic rules, Gap
  requirements, question mappings, localized copy, icons, criticality, and AI
  prompts live in application code.
- The deployed build selects what runs. There is no database publish or
  activation step for these definitions.
- A stable definition/build hash identifies the code definition used by a
  submission or generated result.
- Old executable prompt or rule versions are not retained in the database.
  Completed historical records remain readable from their immutable snapshots;
  corrections use the current deployed definition.
- An unfinished draft created under an old definition hash must restart. An old
  completed result remains readable but is marked outdated and cannot be used to
  create a new downstream result.

### Countries and jurisdiction

- An organization's country is stored as a two-letter code and supplies only a
  questionnaire default.
- The applicability check separately asks which member state has legal
  jurisdiction; organization country does not silently decide this.
- Germany is the only supported legal jurisdiction for now.
- A non-German selection returns a clear unsupported-jurisdiction outcome and
  cannot proceed to Gap Analysis.
- German and EU applicability definitions live in application code. The generic
  database catalogs for countries, jurisdiction profiles, national entity types,
  thresholds, mappings, and their versions disappear.

### Organizations, users, and access

- An organization stores display name, optional legal name, country, selected AI
  provider mode, optional archive timestamp, and ordinary creation/update
  timestamps.
- Provider mode is exactly one of company-hosted, OpenAI, or self-hosted. There
  is no fallback list or versioned provider policy. Self-hosted endpoints and
  credentials are held by the local connector, never in the server database.
- Organizations can be archived and restored. Archived organizations remain
  readable but reject ordinary writes and AI work. Permanent erasure is an
  operator/privacy procedure, not a customer UI lifecycle.
- The application keeps multi-user organizations with Owner, Contributor, and
  Viewer roles.
- Membership existence means active access. Removing a member deletes the
  membership; a new invitation is required to return. At least one Owner must
  remain.
- Invitations are pending-only temporary records for Contributor or Viewer.
  They expire after 14 days and are physically deleted on acceptance,
  revocation, or expiry. The audit stream records what happened.
- The public user projection contains only the auth user ID, email, and display
  name.

### Applicability submissions

- Each organization has one stable applicability assessment with immutable
  submitted revisions.
- A revision snapshots definition hash, locale, submitter and time, stable
  question keys, localized question text, answer values, and localized selected
  option labels.
- There is no mutable applicability draft in the database unless the product
  explicitly needs one later.
- The public anonymous checker keeps unfinished answers in the browser. A guest
  database record is created only on submission and contains the immutable
  answer/result/build snapshot, a hashed claim token, and a 14-day expiry.
- Claiming a guest result creates the organization-owned history and then
  physically deletes the guest row. Expiry cleanup also deletes the row. There
  are no guest started/claimed/expired/deleted statuses.

### Analysis outputs and lineage

- Applicability and Gap are the only generated analysis-output kinds.
- Each organization has one stable output identity per kind and a pointer to its
  newest immutable revision. Successful, server-validated generation makes a
  revision current automatically.
- There is no candidate-versus-accepted distinction, approval state, approval
  endpoint, release reference, or activation history.
- Every output revision directly references the exact immutable assessment
  revision that supplied its questionnaire answers.
- A Gap revision directly references its exact source applicability revision.
- Many selected document versions remain relational sources. Generic
  output-to-output and output-to-assessment polymorphic source tables disappear.
- Applicability-specific common values needed for filtering or reporting may be
  stored as typed fields on the output revision. The full immutable result stays
  in validated JSON. A separate NIS2 projection table is not retained.

### Gap Analysis cycles

- An organization may repeat Gap Analysis before creating its Action Plan.
  Every successful attempt produces another immutable assessment revision and
  another immutable Gap output revision; history remains viewable.
- Only one unfinished Gap cycle exists per organization at a time.
- A cycle owns its mutable draft answers as validated JSON keyed by stable
  question key, selected immutable document versions, definition hash, locale,
  stage, actor, job, output, and timestamps.
- The stages represent answering questions, selecting optional evidence,
  generating, and generated/reviewable output. Job failure does not create a new
  cycle; retry resumes the same locked input.
- Prior answers and documents are prefilled only when the prior definition hash
  still matches the deployed definition.
- Leaving the question stage creates the immutable assessment revision used by
  generation. Selected document versions are locked while generation runs.

### Gap findings, evidence, and contradictions

- Normalized findings and atomic gaps remain the authoritative Gap business
  model; the revision JSON must not duplicate their content.
- A finding snapshots its stable requirement key and customer-facing localized
  requirement metadata instead of referencing a database requirement catalog.
- Deterministic category evaluations are stored once as immutable validated JSON
  on the assessment revision, keyed by stable requirement key.
- Exact admitted evidence remains in AI processing context. Findings and atomic
  gaps use lightweight relational links to those context rows so citations stay
  exact without copying retrieval data.
- Hidden, unused, derived, or duplicated finding metadata is removed. This
  includes duplicated statement-basis data/hashes, hidden AI assumptions, and
  values that can be deterministically computed from snapshotted inputs.
- Missing documents or weak document coverage never block the workflow because
  document upload is optional.
- Only a material direct contradiction between questionnaire and document
  evidence blocks Action Plan generation.
- The user resolves a contradiction with exactly one of two choices: trust the
  questionnaire or trust the document. There is no explanation field and no
  general approval workflow.
- Trusting the questionnaire retains the questionnaire-derived finding and
  records the conflicting document citation as rejected for that finding.
- Trusting the document keeps the original assessment snapshot as history,
  records it as overruled for the finding, and regenerates only that finding
  using the exact conflicting excerpts as authoritative.
- Either choice creates a new immutable current Gap revision with source choice,
  citation IDs, deciding user/time, and original revision/finding lineage, plus
  an audit event. A separate review-resolution table is not retained.

### Documents

- A document is an organization-wide evidence identity. It has one current
  immutable file-version pointer and one archive timestamp.
- Archiving hides the document from future evidence selection; restoring makes
  its current version selectable again. Historical references remain readable.
- A file version owns one indexing lifecycle and configuration: status, parser,
  embedding model, start/completion timestamps, and failure details.
- Chunks reference the exact file version and hold text, ordering/location
  metadata, hash, search data, and vector directly.
- Extraction, embedding-generation, and chunk-embedding helper tables are
  removed. Retrying a failed file version rebuilds only incomplete indexing
  output for that version.

### AI processing

- AI processing runs remain durable and record lifecycle, actual provider and
  model, prompt identity/hash, deployed build/definition hash, timestamps,
  token/cost diagnostics where used, and failure details.
- A run stores one exact validated input manifest JSON and one exact validated
  claim-validation JSON instead of normalized input and claim table families.
- AI processing context remains the canonical relational record of admitted
  organization and legal evidence, retrieval scores, roles, and exact chunks.
- The selected organization provider is authorization/configuration; the run's
  actual provider and model are the historical fact.

### Action Plan

- Each organization can create exactly one Action Plan ever.
- It is generated from the current Gap revision only when no material
  contradiction remains unresolved.
- Generated plan and item content is immutable. Only item status is mutable.
- Item status is exactly open, in progress, or done. Items cannot be cancelled
  or deleted and have no owner, due date, or execution-notes fields.
- Status changes are last-write-wins and append an audit event. There is no
  per-item lock/version column.
- Each action belongs to exactly one finding/category. It may cover multiple
  atomic gaps within that category, and one atomic gap may be covered by
  multiple actions. Cross-category work is represented by separate
  category-specific actions.
- A newer Gap revision can mark the one existing Action Plan outdated, but it
  cannot replace, regenerate, archive, or reconcile the plan.

### Reports

- There is currently one report product, so no report-kind catalog or kind
  column is needed.
- A report directly references one applicability revision, one Gap revision,
  an optional Action Plan, and any selected document versions.
- Reports are immutable historical exports. They store locale, input hash,
  creator, rendering job, and final PDF storage metadata.
- Report readiness and failure are derived from the background job plus the
  presence of valid PDF metadata. Report status, error, completion timestamps,
  and duplicate source-input JSON are removed.

### Jobs, uploads, idempotency, and rate limiting

- Background jobs keep durable status, attempts, leasing, heartbeat, progress,
  cancellation request, payload, errors, requester, and organization ownership.
- Job kinds are stable business operations rather than prompt/schema versions:
  Gap Analysis, Gap conflict resolution, Action Plan generation, report render,
  document indexing, legal-source processing, and maintenance cleanup.
- Definition/build hashes and resource IDs live in the payload. AI prompt
  provenance belongs to the AI processing run.
- Whether a job can be cancelled and whether the caller may cancel it are
  derived from job kind and current role in application code. Per-row
  cancellable/capability fields are removed.
- A completed job cannot be cancelled. An unfinished job from an incompatible
  deployment may safely fail and restart under current code.
- Jobs, upload sessions, and idempotency records each store their small,
  validated result/replay locator directly as JSON. Their separate result
  tables are removed.
- Replaying idempotent responses always reauthorizes the caller and reloads the
  referenced resource.
- Database-backed rate limiting and its cleanup remain.

### Legal corpus

- Legal sources remain independently versioned because exact legal text and
  citations are audit evidence, not executable product configuration.
- Keep stable corpus family identity, sources, immutable source versions,
  renditions, processing generations, chunks, embeddings, and reviewed bindings
  from stable legal provision keys to exact chunks.
- Stable provision keys are strings used by code and citation bindings; there is
  no executable legal-instrument/version/provision catalog in the database.
- An operator command validates an immutable corpus snapshot and atomically
  makes it current. There is no customer-facing corpus administration API.
- Remove corpus evaluation gates, candidate/publish/activate state machines,
  activation-history tables, platform-administrator accounts, automatic source
  URL monitoring, scheduled monitor checks, and change-alert tables.
- Platform audit events remain append-only and receive operator identity from
  deployment credentials.

### Audit and security

- Organization audit events and platform audit events remain append-only.
- Audit events may retain polymorphic entity type and identifier values because
  they describe history even after a temporary target row is deleted.
- Do not create activation-history tables when an audit event already records
  the operator action.
- RLS stays enabled on every public Supabase application table. The current
  server-only/default-deny browser policy remains in force and must be verified
  after every Drizzle push.
- API services continue authenticating users, enforcing tenant capability, and
  scoping reads and writes to organizations.

## Target schema by domain

The names below are the intended implementation vocabulary. Exact ordinary
constraints and indexes should follow the relationships and access paths, not
recreate lifecycle machinery.

| Domain behavior | Target tables | Disposition |
| --- | --- | --- |
| Organizations and users | `organizations`, `user_profiles`, `organization_memberships`, `organization_invitations` | Keep/simplify |
| Immutable submissions | `assessments`, `assessment_revisions`, `assessment_answers` | Keep/simplify |
| Anonymous submitted check | `guest_applicability_checks` | Keep/simplify |
| Current and historical applicability/Gap outputs | `analysis_outputs`, `analysis_output_revisions`, `analysis_output_document_sources` | Replace generic artifact model |
| Resumable Gap work | `gap_analysis_cycles`, `gap_analysis_cycle_documents` | Replace both draft subsystems |
| Normalized Gap result | `gap_findings`, `gap_items`, lightweight finding/item context links | Keep/simplify |
| Organization evidence | `documents`, `document_versions`, `document_chunks` | Keep/flatten processing |
| AI provenance and admitted context | `ai_processing_runs`, `ai_processing_run_context` | Keep/simplify |
| One executable plan | `action_plans`, `action_plan_items`, `action_plan_item_gaps` | Keep/simplify |
| Immutable exports | `reports`, `report_document_sources` | Keep/simplify |
| Durable operations | `background_jobs`, `upload_sessions`, `idempotency_records`, `api_rate_limit_windows` | Keep/simplify |
| Legal evidence | corpus families/snapshots/members, legal sources/versions/renditions/processing/chunks/embeddings, stable-key chunk bindings | Keep independently versioned |
| Audit | `audit_events`, `platform_audit_events` | Keep append-only |

## Tables and subsystems to remove

The implementation should remove the following families after all runtime
imports and tests have been cut over:

- Organization facts: fact definitions and versions, fact options, organization
  fact values/options, and question-to-fact mappings.
- Database-authored product catalogs: frameworks and versions, modules, content
  items/revisions/translations, questionnaires and versions, questions/options,
  scope models/sectors/entity types/threshold sets and versions.
- Generic national-jurisdiction catalogs: jurisdiction profiles and versions,
  national entity types and versions, mappings, thresholds, jurisdiction rules,
  effective states, designations, and their legal-provision joins.
- Applicability release control plane: rule sets, compliance-check releases,
  release membership joins, active pointers, activation history, and corpus
  release joins.
- Gap definition control plane: requirement catalogs and versions, requirement
  sets and members, question mappings, question legal-provision joins, Gap
  releases, applicability rules, active pointers, activation history, and corpus
  release joins.
- Generic generated artifacts and their generic assessment/artifact/document
  lineage joins, replaced by narrow analysis outputs and direct lineage.
- Separate NIS2 result projections.
- Questionnaire and reassessment draft tables, replaced by Gap cycles.
- Document extraction, embedding-generation, and chunk-embedding helper tables.
- Normalized AI assessment/artifact/document/legal input joins, AI claims, and
  claim-context joins. Legal and organization evidence used by the model remains
  in AI run context.
- Separate Gap review-resolution history; resolution is part of the new
  immutable finding/revision plus audit history.
- Background-job, upload-session, and idempotency result tables.
- Report artifact and Action Plan source joins; reports use direct references.
  The many-document source join remains.
- Legal instrument/version/provision catalogs, corpus evaluations, release
  activation history, automatic source monitors/checks/alerts, and obsolete
  compliance/Gap-to-corpus release joins.
- Organization provider-policy rows and platform-administrator rows.
- All routes, clients, services, operator scripts, scheduled tasks, DTO fields,
  permissions, audit event types, and tests that exist solely for the removed
  publication, activation, approval, monitoring, or lifecycle behavior.

## Integrity rules worth keeping

- All public tables have RLS enabled and no browser-access policy unless a
  separately reviewed design explicitly adds one.
- Organization-owned relationships cannot cross tenant boundaries.
- One applicability assessment and one Gap assessment exist per organization.
- One stable analysis output exists per organization and output kind.
- Submitted assessment revisions, analysis-output revisions, generated Gap
  content, Action Plan content, document versions, legal source versions, corpus
  snapshots, reports, and audit events are immutable.
- Current-revision pointers must point to a revision owned by the same parent.
- Previous-revision links must remain within the same parent.
- At most one unfinished Gap cycle exists per organization.
- A cycle may select only document versions belonging to its organization.
- Gap findings and items belong to one Gap revision; citation links point to the
  AI context admitted for that generation lineage.
- One Action Plan exists per organization. Action-to-gap links cannot cross
  plans, Gap revisions, organizations, or categories.
- An Action Plan cannot be generated from a Gap revision with unresolved
  material contradictions.
- Reports reference source records from the same organization.
- Invitation, guest, job, upload, idempotency, and rate-limit expiry cleanup is
  explicit and tested.

## Implementation commits

Each commit should leave the application type-safe and testable against a
database updated with Drizzle Kit push. Target tables may temporarily coexist
with old tables; destructive removal happens only after the relevant runtime
has stopped using the old model.

### 1. Lock the new architecture in tests and documentation

- Add architecture assertions for the intended retained and forbidden table
  families.
- Change persistence-boundary tests so they describe the target modules rather
  than the old release catalogs.
- Mark architecture documents and ADRs that require later amendment or
  supersession.
- Do not change runtime behavior yet.

### 2. Establish code-owned applicability definitions

- Make the deployed applicability questionnaire, localized options, entity
  definitions, German jurisdiction rules, deterministic evaluator, and stable
  definition hash load without a database release.
- Make Germany the only supported jurisdiction and retain the explicit
  unsupported-country result for all others.
- Remove runtime dependence on published/active applicability releases while
  leaving old tables temporarily present.
- Retire applicability publisher/activator commands and their API-facing
  concepts after all readers use code definitions.

### 3. Establish code-owned Gap definitions

- Load the Gap questionnaire, requirements, localized requirement snapshots,
  icons, criticality, mappings, legal provision keys, deterministic category
  evaluator, and prompt selection from application code.
- Replace Gap release compatibility with definition/build-hash compatibility.
- Remove runtime dependence on active Gap releases while leaving old tables
  temporarily present.
- Retire Gap publisher/activator commands and release-registry database readers.

### 4. Add the simplified organization and access model

- Introduce the minimal organization fields and selected provider mode.
- Replace the user directory projection with the minimal user profile.
- Replace role values with Owner, Contributor, and Viewer and update capability
  derivation.
- Cut invitations and memberships over to existence-based lifecycles and enforce
  the final-owner rule.
- Update organization archive/restore behavior and audit events.

### 5. Add simplified immutable assessment persistence

- Add stable assessments, immutable revisions, and answer snapshots without
  questionnaire, option, fact, module, or release foreign keys.
- Store stable keys, localized question/selected-label snapshots, answer values,
  definition hash, locale, submitter, and deterministic category evaluations.
- Cut authenticated applicability submission and historical reads to this model.
- Remove organization-fact reads, writes, invalidation, routes, and UI.

### 6. Simplify the anonymous applicability flow

- Keep unfinished guest answers client-side.
- Persist only submitted guest snapshots with token hash and expiry.
- Implement claim as an atomic copy into organization-owned assessment/output
  history followed by guest-row deletion.
- Implement expiry cleanup and remove guest lifecycle status handling.

### 7. Add narrow analysis outputs and direct lineage

- Introduce stable applicability/Gap output identities and immutable revisions.
- Add direct assessment lineage, Gap-to-applicability lineage, document sources,
  definition/build hashes, locale, validated result JSON, and the few typed
  applicability fields needed by current reads.
- Cut applicability result reads and writes to the new output model.
- Remove approval/candidate/accepted behavior from services, routes, permissions,
  and UI; successful validated generation becomes current.

### 8. Replace Gap drafts with one cycle model

- Introduce Gap cycles with validated draft-answer JSON, stages, exact definition
  hash, immutable answer snapshot, selected documents, generation job, and output
  revision.
- Cut autosave, evidence selection, generation locking, retry, repeat-analysis,
  prefill, and history reads to this model.
- Enforce one unfinished cycle and hash-matched prefill behavior.
- Remove both old draft families and their concurrency/version contracts from
  runtime code.

### 9. Flatten organization document indexing

- Move indexing lifecycle/configuration to immutable document versions.
- Store the embedding directly with its chunk and retain exact page/section/text
  provenance.
- Cut upload completion, index workers, retries, retrieval, archive/restore, and
  historical citation reads to the flattened model.
- Remove extraction, embedding-generation, and chunk-embedding helpers.

### 10. Simplify AI run provenance

- Add validated input-manifest and claim-validation snapshots directly to AI
  runs.
- Cut grounding and generation writers/readers to AI runs plus canonical context
  rows.
- Ensure actual provider/model and prompt/build hashes remain queryable on the
  run.
- Remove normalized input and claim table writers and then their tables.

### 11. Cut Gap findings and contradictions to the decided behavior

- Point normalized findings at the new Gap output revision and snapshot stable
  customer-facing requirement metadata.
- Preserve atomic gaps and exact context-row citations without copying retrieval
  data.
- Remove hidden, derived, duplicated finding fields and the old generic correction
  and guidance-regeneration paths.
- Implement the two-choice contradiction resolution as creation of a new current
  Gap revision, including one-finding document-authoritative regeneration.
- Enforce the Action Plan gate for unresolved material contradictions only.

### 12. Simplify the one-time Action Plan

- Point the one organization Action Plan directly at its source Gap revision,
  generation job, and successful AI run.
- Keep immutable generated item content and the within-category many-to-many gap
  links.
- Reduce mutable item data to open/in-progress/done status and audit each change.
- Remove owner, due date, execution notes, plan revision/lifecycle fields,
  approval coupling, cancellation/deletion paths, and optimistic-lock handling.

### 13. Simplify reports

- Replace generic report source joins with direct applicability, Gap, and
  optional Action Plan references while retaining document sources.
- Derive readiness and failure from the rendering job and PDF locator.
- Remove report kind, duplicate state/error/completion fields, and copied input
  JSON.
- Update renderer, download authorization, history, and audit behavior.

### 14. Inline operational result locators

- Store validated result locators directly on background jobs, upload sessions,
  and idempotency records.
- Switch job kinds to stable business operation names and move build/definition
  identity into payloads.
- Derive cancellation support and authorization in code and retain only durable
  cancellation-request state.
- Reauthorize and reload idempotent replay targets.
- Remove the three helper result tables and obsolete per-row cancellation fields.

### 15. Simplify legal corpus operation without weakening evidence history

- Retain source/version/rendition/processing/chunk/embedding history and stable
  provision-key bindings.
- Replace evaluated/published/activated release machinery with an immutable
  validated corpus snapshot and one atomic current pointer per corpus family.
- Convert corpus administration to deployment-authorized operator commands and
  preserve platform audit identity.
- Remove customer/admin corpus APIs, platform-admin membership, evaluations,
  activation history, automatic URL monitors/checks/alerts, and their scheduler.

### 16. Remove dead schema and obsolete code paths

- Prove with repository search and architecture tests that no production import,
  route, worker, script, or test uses a table family marked for removal.
- Delete the obsolete Drizzle declarations, relations, enums, indexes, and
  constraints in coherent domain groups.
- Delete obsolete contracts, clients, services, operator commands, scheduled
  tasks, UI states, and translations.
- Remove or rewrite tests that assert intentionally removed behavior.

### 17. Push the destructive schema to the disposable database

- Resolve and display only the target database host, port, and database name;
  never print credentials.
- Run the Drizzle Kit push explanation and review every create, rename, drop,
  constraint, index, and RLS change.
- Treat the database as disposable: approve the reviewed destructive changes and
  do not backfill old rows.
- Apply with the existing `db:push` script. Do not generate or run a migration
  for this refactor.
- Verify server-only/default-deny RLS on every remaining public table.
- Run a second push explanation and require zero drift.

### 18. Verify end-to-end behavior and replace stale architecture docs

- Run static checks, unit/integration tests, i18n checks, worker tests, route
  tests, and relevant Gap/Action Plan AI contract tests.
- Exercise the authenticated path from applicability submission through repeated
  Gap Analysis, contradiction resolution, one Action Plan, item status changes,
  report generation, and historical reads.
- Exercise anonymous submit/claim/expiry, document indexing retry/archive,
  organization archive/restore, invitation/member removal, provider selection,
  Germany-only jurisdiction gating, cleanup jobs, and corpus snapshot selection.
- Rewrite the database overview, workflow documentation, reset/bootstrap
  instructions, operator runbooks, and route inventory to describe only the new
  architecture.
- Explicitly supersede ADRs that require database product releases, generic
  operational-result tables, blanket optimistic concurrency, platform
  administrators, source monitoring, corpus evaluation/activation, or an
  accepted-result approval workflow.

## Testing decisions

Good tests assert behavior visible at a module, API, worker, or database-integrity
boundary. They should not preserve a table or column merely because the old
implementation had one.

### Retain and adapt

- Applicability deterministic rules, localization, question visibility, defaults,
  Germany support, and unsupported-country Gap eligibility.
- Authenticated and guest submission snapshots and historical result rendering.
- Tenant authorization, role capabilities, organization archiving, final-owner
  protection, and default-deny RLS verification.
- Gap deterministic category evaluation, atomic output validation, citations,
  historical revisions, selected-document access, job retries, and safe
  projection.
- Action Plan exactly-once creation, generation validation, within-category gap
  coverage, localization, styling, and status updates.
- Document extraction/index adapter behavior, retrieval thresholds, citation
  access, usage history, archive/restore, and private storage.
- Job leasing, heartbeat, recovery, cancellation request, progress, polling,
  worker wakeup, and terminal-state rules.
- AI provider boundaries, grounding safety, token limits, language policy, and
  claim/citation validation.
- Report rendering and download authorization.
- Idempotency, upload policy, rate limiting, append-only audit, and persistence
  module boundaries.

### Remove or rewrite

- Compliance and Gap release publication/activation tests.
- Prompt/schema-versioned job-kind tests.
- Candidate/accepted result approval and accepted-pointer tests.
- Generic correction/guidance-regeneration tests outside the two-choice
  contradiction flow.
- Organization-fact, relational option catalog, and database product-definition
  schema tests.
- Per-resource optimistic-concurrency tests for removed version fields.
- Platform-administrator, corpus evaluation gate, and automatic legal-source
  monitor tests.
- Typed helper-result-table tests for jobs, uploads, and idempotency.
- Tests that require owner/due-date/execution-note Action Plan fields or report
  lifecycle duplication.

### Add

- A target-schema inventory test that fails if removed table families return.
- Immutable assessment/output snapshot tests based on definition hashes and
  localized answer metadata.
- One stable assessment and output per organization/kind integrity tests.
- Guest submit/claim/delete/expiry behavior.
- One unfinished Gap cycle, same-cycle retry, hash-matched prefill, repeated Gap
  history, and outdated-result downstream blocking.
- Optional evidence behavior and the exact two-choice contradiction flow.
- Direct run-manifest/claim-validation JSON schema validation.
- Flattened document-index lifecycle and failed retry behavior.
- One Action Plan per organization, same-category linkage, multiple actions per
  gap, status-only mutation, and last-write-wins audit behavior.
- Direct report lineage and job-derived readiness.
- Corpus snapshot atomic-current selection and stable provision-to-chunk binding.
- Germany-only supported-jurisdiction behavior independent of organization
  country.

## Documentation and ADR impact

The existing database overview and older schema plan describe the system being
removed and must not remain labeled current. During implementation:

- Replace the current database-structure overview with the final target model.
- Mark the original expansive schema plan and column-remediation plan as
  historical/superseded.
- Amend the concurrency ADR so idempotency remains but resource version tokens
  are not mandatory; future lost-update protection is one cross-cutting API
  policy.
- Amend the typed-lineage ADR to allow small validated result locators directly
  on jobs, uploads, and idempotency records while retaining relational business
  lineage.
- Preserve the normalized-Gap-findings ADR, updated for narrow analysis outputs
  and code-owned requirement snapshots.
- Supersede ADRs for platform administrators, automatic legal-source monitoring,
  corpus evaluation gates, release activation, or approval behavior that no
  longer exists.
- Keep the Local AI Connector design separate and unchanged.

## Acceptance criteria

- The app runs against a clean database created solely from the simplified
  Drizzle schema plus required Supabase operator infrastructure.
- Drizzle Kit push reports zero drift after application.
- Every remaining public table has RLS enabled and remains default-deny to
  browser roles.
- No production code imports or queries any removed table family.
- Applicability and Gap product definitions execute directly from the deployed
  application without database publication or activation.
- Germany is the only jurisdiction that can unlock Gap Analysis; other countries
  receive an explicit unsupported result.
- Historical submitted answers, generated outputs, exact document/legal
  citations, AI run provenance, reports, and audit events remain explainable.
- Users can repeat Gap Analysis before Action Plan creation, but only one
  unfinished cycle exists and retries reuse its locked input.
- Missing documents never block. Unresolved material contradictions alone block
  Action Plan creation and are resolvable only through the two decided choices.
- Each organization can create one immutable-content Action Plan whose items
  expose only open/in-progress/done status as mutable state.
- Reports use direct source lineage and derive lifecycle from their job.
- The job worker, document indexing, legal corpus processing, cleanup, uploads,
  idempotency, rate limiting, organization access, archive behavior, and audit
  history all pass their rewritten behavior tests.
- The full verification command, worker/route/report suites, and relevant AI
  evaluations pass.

## Rollout and recovery

There is no row-level rollback or data conversion. Before applying the
destructive push, verify that the connected target is the intended disposable
pre-production database. Recovery is to correct the Drizzle schema and push
again, or recreate the disposable database and push the corrected schema.

Once the product reaches a non-disposable environment, future schema changes
must return to committed migrations and the production migration policy.
