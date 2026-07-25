# Database Column and Persistence Architecture Remediation

Status: implemented and acceptance-verified on 2026-07-24.

This plan responds to the
[Database Column Usage and Architecture Audit](../architecture/database-column-usage-and-architecture-audit-2026-07-24.md).
It covers database-column cleanup, relational integrity, Gap-result
authority, live-reference typing, persistence-module boundaries, and measured
index work.

Related decisions:

- [Make normalized Gap Findings authoritative](../adr/0034-make-normalized-gap-findings-authoritative.md)
- [Use typed references for live workflow dependencies](../adr/0035-use-typed-references-for-live-workflow-dependencies.md)
- [Encapsulate persistence behind use-case modules](../adr/0036-encapsulate-persistence-behind-use-case-modules.md)

## Goal

Move from a wide persistence interface with partially enforced relationships
to this target:

```text
routes, pages, workers, and scripts
  -> small use-case commands and read interfaces
    -> deep business modules
      -> explicit PostgreSQL projections and commands
        -> database-enforced ownership, identity, and datatype invariants
```

The completed change must:

- remove state that has no current product behavior;
- make every retained duplicate either authoritative or database-verified;
- make normalized Gap Findings the only business source of truth for findings;
- replace live `type + UUID` references with typed foreign-key relationships;
- keep polymorphic identifiers only where they are intentionally historical;
- migrate all seven audited business areas behind complete module boundaries;
- eliminate unprojected production reads;
- tune indexes only from measured query plans; and
- complete a guarded, disposable-development clear/push/reseed rollout without
  requiring approval from the plan author.

## Confirmed decisions

### Scope

This plan includes:

- database-column disposition;
- database ownership, identity, datatype, and lifecycle constraints;
- the authoritative Gap result model;
- typed workflow lineage and operational results;
- all seven persistence modules named by the audit;
- affected jobs, uploads, reports, and idempotency result handling;
- query projections and architecture enforcement;
- index cleanup and evidence-based FK indexes; and
- documentation and rollout changes required by those items.

The audit's six adjacent system risks remain outside implementation scope:

- positive-applicability gating for Gap Analysis;
- asynchronous Organization Evidence processing and OCR;
- embedding-provider disclosure policy;
- the generate-once staleness recovery dead end;
- EU/DE and German-retrieval grounding limits; and
- replacement of the four-requirement demo Gap catalogue.

Record them as dependencies in the architecture backlog. Do not pull their
product behavior into this refactor.

### Lifecycle direction

The current generate-once Gap lifecycle is authoritative:

- one successful Gap generation per organization;
- findings may be corrected before plan creation;
- finalization creates the organization's one Action Plan and locks the Gap
  Analysis;
- there is no reassessment, immutable revert, plan replacement, or item
  reconciliation; and
- the Action Plan's measure set is fixed after creation.

Remove schema concepts that advertise the rejected lifecycle. Do not recreate
historical reassessment or reconciliation behavior while deepening the
modules.

### Rollout authority

The database is a disposable non-production target. The executor may:

- clear and reseed it;
- inspect and accept the controlled corpus fixture;
- publish, evaluate, and activate corpus releases;
- publish and activate compliance and Gap releases; and
- execute every verification and smoke gate

without requesting confirmation from the plan author.

Automated target checks, command guards, audit attribution, corpus evidence,
and fail-fast behavior remain mandatory. They are executable safety controls,
not approval gates.

## Final column disposition

### Remove

| Column | Reason and replacement |
| --- | --- |
| `gap_requirement_versions.recommendation` | Recommendations belong to Gap Findings. Remove the definition field, publication/localization path, version hash input, loader field, and tests. |
| `gap_requirement_versions.code` | `gap_requirements.code` is the stable authoritative identity. Join it in catalogue loaders and publication verification. |
| `assessment_revisions.change_reason` | No product flow captures it. Existing correction and audit reasons remain in their purpose-specific records. |
| `assessment_revisions.reverted_from_revision_id` | Immutable assessment revert is not a supported lifecycle operation. |
| `generated_artifact_revisions.reverted_from_revision_id` | Immutable artifact revert is not a supported lifecycle operation. |
| `action_plans.predecessor_plan_id` | The product permits one plan ever and no replacement/reconciliation. |
| `action_plan_items.predecessor_item_id` | The measure set is fixed and items are not reconciled across plans. |
| `ai_processing_runs.estimated_cost_micros` | Cost calculation and rate-card versioning are not required now. Preserve token counts. |
| `legal_source_versions.supersedes_version_id` | A single self-reference cannot safely express partial, multiple, or cross-source legal replacement. Use effective intervals, immutable releases, and withdrawal state. |
| `gap_analysis_releases.model_policy` | Provider authorization belongs to organization policy, runtime selection belongs to the Grounding Gateway, and actual provider/model provenance belongs to the AI run. |

Remove associated enums, helper types, relations, indexes, validators, DTO
properties, mocks, fixtures, and documentation when they become unused.

In particular:

- remove `LegacyLocalizedJson` and its localization helper if the
  recommendation path is its final consumer;
- remove `modelPolicy` from Gap release definitions, compilation validation,
  aggregate inputs, publisher values, loader output, and test fixtures;
- remove `maxRequirementsPerBatch` rather than moving it to an unimplemented
  setting; and
- keep actual provider, model, prompt, schema, token, and disclosure
  provenance on `ai_processing_runs`.

Published development releases will be recreated during the coordinated
reseed. Do not preserve obsolete release hashes merely to retain unused
fields.

### Retain and implement

Retain `legal_source_versions.upstream_published_at` as optional provenance.
It means the trustworthy publication time reported by the upstream authority.
It is distinct from:

- `retrieved_at`, when this system obtained the source; and
- `effective_from` / `effective_to`, when the source has legal effect.

Implementation must:

1. Add the optional value to legal upload and URL-import contracts.
2. Carry it through upload/import jobs without converting it into an effect
   date.
3. Persist it when a Platform Administrator supplies or verifies it.
4. Include it in corpus catalogue/review read models and administration UI.
5. Display an explicit unknown state when it is absent.
6. Test that retrieval never infers legal effect from upstream publication
   time.

### Retain as enforced denormalizations

Keep:

- `assessments.module_id`;
- `assessments.questionnaire_id`; and
- `assessment_answers.question_stable_key`.

They are useful grouping and semantic-query keys, but equality with their
authoritative records must be enforced by PostgreSQL.

Use supporting composite identities rather than application-only comparison:

1. Add `questionnaire_id` to both Compliance and Gap Release headers.
2. Bind `(questionnaire_version_id, questionnaire_id)` to the matching
   Questionnaire Version.
3. Bind each release's `(module_id, questionnaire_id)` to one Questionnaire.
4. Expose unique release identities containing
   `(release_id, module_id, questionnaire_id)`.
5. Bind an Assessment's release, module, and questionnaire tuple to the
   selected Compliance or Gap Release.
6. Bind `(question_id, question_stable_key)` on each answer to the matching
   Question identity.
7. Bind every Assessment Revision's Questionnaire Version to the
   Questionnaire selected by its Assessment.

The release-kind check remains responsible for requiring exactly one
Compliance or Gap Release path.

## Database integrity work

### Owner-scoped current and accepted pointers

Add supporting unique identities and composite foreign keys:

```text
generated_artifact_revisions:
  UNIQUE (artifact_id, id)

generated_artifacts:
  FOREIGN KEY (id, current_revision_id)
    -> generated_artifact_revisions (artifact_id, id)
  FOREIGN KEY (id, accepted_revision_id)
    -> generated_artifact_revisions (artifact_id, id)

assessment_revisions:
  UNIQUE (assessment_id, id)

assessments:
  FOREIGN KEY (id, current_revision_id)
    -> assessment_revisions (assessment_id, id)

document_versions:
  UNIQUE (document_id, id)

documents:
  FOREIGN KEY (id, current_version_id)
    -> document_versions (document_id, id)
```

Remove the weaker single-column pointer foreign keys only after the composite
constraints exist in the target schema.

Apply the same ownership pattern to:

- a Gap review resolution and its Finding;
- a Finding and its artifact revision;
- an Action Plan Item and its source Finding;
- a Gap Assessment and its pinned applicability artifact revision;
- current document extraction/embedding pointers where the pointer can cross
  its owning document or version; and
- any other current/accepted pointer discovered by the cross-table invariant
  inventory.

For relationships whose owner/type is only reachable through two parent
levels, use a small deferred constraint trigger rather than adding misleading
general-purpose identity columns. In particular:

- an Action Plan source revision must belong to a
  `gap_analysis_result` artifact owned by the same organization;
- a Gap Assessment's applicability revision must belong to an
  `affectedness_result` artifact owned by the same organization; and
- typed source relationships must not cross organizations.

### Active pointer identity

Make the pointer key and referenced release identity agree:

```text
active_compliance_check_releases:
  (check_code, check_release_id)
    -> compliance_check_releases (check_code, id)

active_gap_analysis_releases:
  (release_code, gap_analysis_release_id)
    -> gap_analysis_releases (release_code, id)

active_legal_corpus_releases:
  (family_id, release_id)
    -> legal_corpus_releases (family_id, id)
```

Apply equivalent composite foreign keys to activation-history rows so a
history entry cannot combine one code/family with another release.

### Review resolution identity

Expose `UNIQUE (artifact_revision_id, id)` on `gap_findings`, then replace the
independent resolution foreign keys with:

```text
gap_finding_review_resolutions:
  (artifact_revision_id, finding_id)
    -> gap_findings (artifact_revision_id, id)
```

Keep the one-resolution-per-finding uniqueness rule.

### Status and timestamp checks

Inventory lifecycle tables and add checks for states already required by the
product. At minimum cover:

- submitted Assessment Revisions and `submitted_at`;
- completed/failed/cancelled AI runs and terminal timestamps/error fields;
- ready Reports and output metadata;
- completed Upload Sessions and typed results;
- succeeded Background Jobs and typed results;
- active/archived Action Plans and their timestamps;
- reviewed/published/withdrawn Legal Source Versions and review/withdrawal
  metadata; and
- published/withdrawn Corpus Releases and governance metadata.

Do not introduce new states. Express the current state machine and make
impossible combinations fail in database integration tests.

## Typed answers and organization facts

Keep the parallel scalar columns, but make their meaning enforceable.

### Bind selected options to their parent

For Assessment Answers:

1. Add `question_id` to `assessment_answer_options`.
2. Expose `UNIQUE (id, question_id)` on `assessment_answers`.
3. Expose `UNIQUE (question_id, id)` on `question_options`.
4. Add:

   ```text
   (assessment_answer_id, question_id)
     -> assessment_answers (id, question_id)

   (question_id, question_option_id)
     -> question_options (question_id, id)
   ```

For Organization Fact Values:

1. Add `fact_key` to `organization_fact_value_options`.
2. Expose `UNIQUE (id, fact_key)` on `organization_fact_values`.
3. Expose `UNIQUE (fact_definition_key, id)` on `fact_options`.
4. Add equivalent composite foreign keys through `fact_key`.

### Enforce the representation

Add ordinary checks that:

- at most one scalar representation is non-null;
- option-based values do not also carry a scalar representation; and
- structured JSON is used only as one representation, never alongside another
  scalar.

Add deferred constraint triggers for final transactional validation because
answer/fact headers are inserted before their option joins. The triggers must
verify:

- the Question belongs to the Assessment Revision's Questionnaire Version;
- the representation matches `questions.answer_type`;
- selected Question Options belong to that Question;
- the fact representation matches the Fact Definition datatype;
- selected Fact Options belong to that Fact Definition;
- single-choice values contain exactly one option;
- multi-choice values contain the allowed option count;
- scalar answer/fact types use exactly their declared scalar column; and
- a persisted answer or fact has exactly one logical representation.

Keep application validation for friendly errors. Database validation is the
final integrity boundary.

Test every supported datatype, wrong scalar columns, mixed scalar/option
values, cross-question options, cross-fact options, empty choices, and valid
transactional insert order against PostgreSQL.

## Make normalized Gap Findings authoritative

### Target model

The business state of a Finding exists only in:

- `gap_findings`; and
- `gap_finding_evidence`.

This includes:

- requirement identity;
- status;
- evidence sufficiency;
- severity;
- rationale;
- recommendation;
- assumptions;
- review state; and
- citations/evidence.

`generated_artifact_revisions.result` remains the generic artifact metadata
envelope. For Gap revisions it must contain only a versioned structure similar
to:

```json
{
  "schemaKind": "gap_revision_metadata_v1",
  "outputLocale": "de",
  "findingDiagnostics": [
    {
      "requirementVersionId": "uuid",
      "contradictions": [],
      "questionnaireDisagreements": []
    }
  ],
  "correctedFromRevisionId": null,
  "correctedRequirementVersionIds": []
}
```

Do not keep status, severity, rationale, recommendation, assumptions,
evidence sufficiency, review state, or citations in that envelope.

Add one runtime schema for the envelope and a database check requiring Gap
revision metadata to:

- identify its schema kind;
- carry an output locale equal to the relational locale; and
- omit the legacy `findings` key.

Keep Finding diagnostics in the envelope only while they remain
non-authoritative model commentary. Key them by immutable Requirement Version
ID, validate exact requirement coverage, and suppress/clear diagnostics whose
meaning no longer applies after human correction.

### Writer changes

Generation must:

1. validate model output in memory;
2. create the immutable artifact revision;
3. persist metadata-only revision JSON;
4. insert one normalized Finding for every expected Requirement Version;
5. insert validated evidence rows;
6. verify exact normalized coverage; and
7. advance the current pointer in the same transaction.

Correction must:

1. lock the current Gap artifact;
2. create a new immutable revision;
3. copy prior normalized Findings and evidence;
4. apply corrections only to the new rows;
5. write correction metadata without recreating a JSON Finding copy; and
6. advance the current pointer in the same transaction.

Finalization, workflow reads, reports, and Action Plan generation must read
Finding business state only from normalized rows.

Ensure severity remains consistent with requirement criticality and final
status. Use a database constraint trigger if it remains a stored
denormalization.

### Cutover

Because the development database will be cleared, do not build a compatibility
backfill for obsolete development rows. Instead:

- add a fixture-level consistency test proving the old and normalized
  representations agree before deleting the old writer;
- change all readers and writers in one coordinated code/schema cutover;
- reseed only the metadata-only representation; and
- add a regression test that fails if a Gap revision JSON payload contains
  `findings`.

## Replace live polymorphic references

### Artifact revision lineage

Replace `artifact_revision_sources` with:

```text
artifact_revision_assessment_sources
  artifact_revision_id
  assessment_revision_id

artifact_revision_artifact_sources
  artifact_revision_id
  source_artifact_revision_id

artifact_revision_document_sources
  artifact_revision_id
  document_version_id
```

Each ID must have a real foreign key. Add uniqueness/cardinality constraints
for the actual workflows:

- applicability revisions have one Assessment Revision source;
- Gap revisions have one Gap Assessment Revision source;
- Gap revisions have one applicability Artifact Revision source;
- Gap revisions have zero or more selected Document Version sources; and
- duplicate sources are impossible.

Remove the unused `organization_fact_snapshot` source kind unless a concrete
current writer and target table are found during implementation.

Update exact-input reads, staleness, generation, correction, finalization, and
lineage inspection to use the typed tables.

### AI processing inputs

`ai_processing_run_inputs` has the same live `type + UUID` weakness. Replace
it with typed assessment, artifact, and document input relationships while
preserving `source_hash`. Keep the already-typed legal input and prompt-context
tables.

### Report sources

Replace `report_sources` with:

- `report_artifact_sources`;
- `report_action_plan_sources`; and
- `report_document_sources`.

Every source must belong to the Report's organization at snapshot time.
Continue storing `reports.input_snapshot` and its hash as immutable rendered
input provenance; it does not replace live typed source validity.

### Jobs, uploads, and idempotency

Remove generic `result_type` / `result_id` pairs where successful completion
or replay depends on a live target. Introduce result links owned by the
corresponding use case, for example:

- Gap generation job -> Generated Artifact Revision;
- Report job -> Report;
- legal import/processing job -> Rendition or Processing Generation;
- document upload -> Document Version;
- legal upload -> Legal Source Rendition;
- Gap finalization idempotency record -> Action Plan; and
- generation-enqueue idempotency record -> Background Job.

Do not create a universal resource registry. Inventory every currently written
result type, create only the typed relationship its workflow needs, and reject
unknown result kinds at module boundaries.

### Audit history

Keep `audit_events.entity_type/entity_id` and
`platform_audit_events.entity_type/entity_id` polymorphic. They are historical
identifiers and must remain readable when a target is no longer available.

Require event metadata to retain the stable business facts needed to
understand the event without dereferencing a mutable target. Do not add target
foreign keys to append-only audit history.

## Migrate every persistence module

### Boundary rules

Each module exposes business commands and read models from one public entry
point. Routes, pages, workers, and other modules may not import its private
query files.

Module internals may use Drizzle directly. Do not introduce a repository class
that merely renames individual table methods. Introduce an adapter/port only
when there is an actual alternative implementation or a valuable test seam.

Production reads must use:

- `db.select({ ... })`; or
- relational queries with explicit `columns`.

The target is:

- zero unprojected `.select()` calls in production server code;
- zero full-row `db.query.*.findFirst/findMany` calls in production server
  code;
- zero route, page, client, or worker-orchestration imports of
  `src/db/schema`; and
- zero imports of another module's private persistence files.

Schema-management, benchmark, verification, and tightly controlled operator
scripts may import database definitions. Business scripts must call the public
module commands.

Add a static architecture test that enforces these rules and reports exact
offending files.

### 1. Compliance Release Catalogue

Public operations should cover:

- compile and validate a release definition;
- publish an immutable release;
- activate/retire a release;
- load one published Runtime Release through an explicit projection; and
- resolve current release identity.

Responsibilities:

- own stable Requirement/Questionnaire/Release identity assembly;
- remove Gap requirement version code/recommendation throughput;
- enforce active pointer identity;
- remove Gap model policy;
- preserve deterministic aggregate hashes for the new definitions; and
- centralize localized content resolution.

Use the existing Compliance Runtime Release assembler as the starting seam.
Gap Release loading and publication must follow the same catalogue boundary
rather than exposing physical tables to generation code.

### 2. Assessment Submission

Public operations should cover:

- create or resolve the Assessment workflow identity;
- submit one immutable revision;
- persist typed answers and options;
- derive and supersede Organization Facts transactionally;
- advance the current Assessment Revision; and
- read an exact submitted revision.

Responsibilities:

- enforce release/module/questionnaire identity;
- own answer/fact datatype representation;
- own Assessment revision numbering and pointer changes; and
- expose explicit read models for applicability and Gap consumers.

No caller may insert an Assessment Revision, Answer, option join, or Fact Value
directly.

### 3. Artifact Revision Lifecycle

Public operations should cover:

- resolve/create a stable Generated Artifact;
- append an immutable revision;
- attach typed sources;
- advance current/accepted pointers under optimistic or row-lock concurrency;
- read exact revision metadata; and
- archive where the current product permits it.

Responsibilities:

- enforce pointer ownership;
- enforce artifact type and organization ownership;
- own typed artifact lineage; and
- keep generic artifact metadata separate from subtype business state.

The module must not expose a generic “update revision row” operation.

### 4. Gap Generation and Review

Public operations should cover:

- collect the exact generation snapshot;
- enqueue/run the one allowed generation;
- read the current workflow;
- read exact generated inputs;
- correct Findings before plan creation; and
- finalize the current revision and create the one Action Plan atomically.

Responsibilities:

- own normalized Findings/evidence;
- own metadata-only Gap revision envelopes;
- own exact Requirement coverage;
- own typed Assessment, applicability, and Document sources;
- own correction and review-resolution rules;
- own staleness and finalization validation; and
- serialize correction against finalization.

This module is complete only when no caller reconstructs Gap lifecycle state
from raw tables.

### 5. Evidence Library

Public operations should cover:

- create upload sessions;
- complete an upload into an immutable Document Version;
- read eligible/current versions;
- process/index a version;
- archive/restore a Document; and
- authorize controlled original-file access.

Responsibilities:

- own Document/current-version identity;
- own extraction and embedding-generation ownership;
- expose explicit evidence projections to Gap generation; and
- provide typed upload and job results.

Do not reintroduce Gap reassessment controls into the generic Evidence Library.

### 6. Action Plan Lifecycle

Public operations should cover:

- create the single plan only through Gap finalization;
- read the plan and fixed measure set;
- update allowed execution fields with optimistic concurrency; and
- archive only if current product behavior supports it.

Responsibilities:

- enforce same-organization, Gap-artifact source identity;
- enforce source Finding ownership for every item;
- prevent second-plan creation;
- keep plan item snapshots immutable except for documented execution fields;
  and
- preserve item-change audit history.

Do not expose plan replacement, regeneration, or item reconciliation commands.

### 7. Legal Corpus Publication

Public operations should cover:

- create/update a stable Legal Source;
- ingest a version/rendition;
- capture optional upstream publication provenance;
- review processing generations and source versions;
- create/evaluate/publish/activate/withdraw Corpus Releases; and
- monitor source URLs without automatic publication.

Responsibilities:

- own source/version/rendition/generation identity;
- own family-scoped active pointers;
- preserve immutable published history;
- keep publication, retrieval, and legal-effect times distinct;
- expose explicit projections to pinned grounding; and
- provide typed upload/job results.

Remove the ambiguous source-version supersession pointer. Do not infer legal
replacement from version labels or publication timestamps.

### Operational modules affected by the migration

Update Jobs, Uploads, Reports, and Idempotency so their public interfaces use
the typed result links described above. Update API handlers and clients only
where result DTOs change. Preserve current authorization, idempotency,
concurrency, cancellation, and safe-error behavior.

## Index work

### Redundant candidates

Evaluate all 19 strict left-prefix candidates named by the audit:

- `questionnaire_versions_questionnaire_idx`
- `rule_sets_module_idx`
- `idx_answers_revision`
- `generated_artifacts_organization_idx`
- `documents_organization_idx`
- `document_chunks_extraction_idx`
- `document_versions_document_idx`
- `compliance_framework_versions_framework_idx`
- `compliance_modules_framework_version_idx`
- `gap_reassessment_drafts_organization_idx`
- `gap_requirement_versions_requirement_idx`
- `generated_artifact_revisions_artifact_idx`
- `assessment_revisions_assessment_idx`
- `artifact_revision_sources_revision_idx`
- `question_fact_mappings_question_idx`
- `questionnaires_module_idx`
- `questions_questionnaire_version_idx`
- `question_options_question_idx`
- `organization_memberships_org_idx`

Some named tables/indexes will disappear earlier in this plan. Remove those
through the schema refactor rather than benchmarking an obsolete shape.

For every remaining candidate:

1. Capture representative read, update, and delete SQL.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` against a production-scale disposable
   fixture.
3. Record the plan with both indexes present.
4. remove the narrower index in the rehearsed schema;
5. rerun the same plans and write-path benchmark; and
6. keep the removal only when the wider index serves the workload without a
   material regression.

### Unsupported foreign keys

Do not add all unsupported FK indexes.

Prioritize:

- high-row-count join/link tables;
- Document and Legal Source chunks/embeddings;
- AI context and claim tables;
- Finding Evidence;
- release/source membership;
- typed lineage/result tables introduced by this plan;
- parent archival/deletion paths; and
- measured slow queries.

Require a before/after plan, row-count fixture, latency/buffer comparison, and
write-cost rationale for each added index group.

Extend:

- `scripts/benchmark-compliance-runtime.ts`;
- `scripts/benchmark-gap-workflow.ts`; and
- focused corpus/document benchmark coverage

so the important module interfaces, not private query fragments, are the
benchmark entry points.

## Implementation sequence

The code and schema deploy as one coordinated cutover, but implement and review
the work in these dependency-ordered slices.

### Phase 0: Freeze the baseline and add architecture checks

1. Run `npm.cmd run verify`, `npm.cmd run build`, worker tests, AI evaluations,
   and current database smoke/benchmark commands.
2. Capture current query counts and benchmark fixtures.
3. Add the static persistence-boundary test in report-only mode.
4. Add schema integration-test helpers for real PostgreSQL constraint tests.
5. Record the exact registered release references:
   `nis2/2026-v1` and `nis2-gap/guided-v3`.

Exit criteria:

- baseline results are recorded;
- every current architecture violation is inventoried; and
- the test harness can distinguish expected transitional violations from new
  ones.

### Phase 1: Remove dead release and lifecycle state

1. Remove Gap catalogue recommendation throughput.
2. Make stable Gap Requirement code authoritative.
3. Remove Gap release model policy.
4. Remove rejected lifecycle columns and AI estimated cost.
5. Remove legal supersession and implement upstream publication provenance.
6. Update contracts, definitions, hashes, publishers, loaders, fixtures, and
   tests.

Exit criteria:

- no non-schema reference to a removed field remains;
- compiled release definitions contain no misleading policy/recommendation
  state; and
- release compiler/publisher/loader tests pass.

### Phase 2: Build the relational integrity foundation

1. Add composite owner identities and pointer foreign keys.
2. enforce active release pointer identity;
3. enforce Assessment release/module/questionnaire identity;
4. enforce Answer stable-key identity;
5. enforce review-resolution and Action Plan source ownership;
6. add current lifecycle status/timestamp checks; and
7. add direct database tests for every invalid relationship.

Exit criteria:

- every audit-listed cross-owner insert fails in PostgreSQL; and
- valid application transactions remain accepted.

### Phase 3: Enforce typed answers and facts

1. Add parent identity columns to option joins.
2. Add composite option foreign keys.
3. Add scalar representation checks.
4. Add deferred datatype constraint triggers.
5. Update submission writers and fixtures.
6. Add exhaustive database integration tests.

Exit criteria:

- PostgreSQL rejects every wrong datatype and cross-parent option case; and
- both applicability and Gap submissions pass through their public modules.

### Phase 4: Introduce typed lineage and result tables

1. Add typed Artifact Revision source tables.
2. Add typed AI input tables.
3. Add typed Report source tables.
4. Add use-case job/upload/idempotency result links.
5. Change readers and writers.
6. Remove obsolete polymorphic workflow columns/tables/enums.
7. Keep audit references unchanged.

Exit criteria:

- no live workflow depends on an unconstrained `type + UUID`;
- all typed links enforce target existence and tenant ownership; and
- audit history remains append-only and target-independent.

### Phase 5: Establish the authoritative Gap model

1. Add the versioned metadata-only Gap envelope.
2. Remove Finding business fields from revision JSON writers.
3. Switch generation, correction, reads, reports, and finalization to normalized
   rows only.
4. Add the no-legacy-`findings` database check and regression test.
5. Verify correction/finalization concurrency and exact coverage.

Exit criteria:

- normalized Findings/evidence are the only business representation; and
- a future JSON/row divergence is structurally impossible.

### Phase 6: Complete all seven module migrations

Migrate modules in dependency order:

1. Compliance Release Catalogue;
2. Assessment Submission;
3. Artifact Revision Lifecycle;
4. Evidence Library;
5. Gap Generation and Review;
6. Action Plan Lifecycle; and
7. Legal Corpus Publication.

Then complete affected Jobs, Uploads, Reports, and Idempotency boundaries.

For each module:

1. Define its public commands/read models.
2. Move invariants behind those operations.
3. Convert reads to explicit projections.
4. Migrate routes, pages, workers, scripts, and cross-module callers.
5. Add module, route-contract, authorization, concurrency, and database tests.
6. Turn its transitional architecture-test allow-list entries into failures.

Exit criteria:

- all target architecture counts are zero;
- callers cannot import private persistence code; and
- behavior is verified only through public module operations.

### Phase 7: Measure and tune indexes

1. Build production-scale disposable fixtures.
2. Evaluate surviving prefix-redundant candidates.
3. Benchmark prioritized unsupported FKs.
4. Apply only evidence-backed index changes.
5. Rerun module-level Compliance, Gap, Document, and Corpus benchmarks.

Exit criteria:

- every removed or added index has recorded evidence; and
- no blanket FK-index migration exists.

### Phase 8: Documentation and coordinated database cutover

1. Update database structure, end-to-end workflow, API architecture, reset
   runbook, security table lists, smoke paths, and historical plans whose
   “current behavior” notes changed.
2. Rehearse the exact reset/push/reseed sequence against a fresh disposable
   database.
3. Resolve all DDL ordering failures before touching the shared development
   target.
4. Execute the rollout below.
5. Record final schema, security, storage, corpus, release, benchmark, test,
   and build evidence.

## Disposable database rollout

Follow
[Development database reset and bootstrap](../database/development-database-reset-and-bootstrap.md)
and the
[2026-07-24 postmortem](../database/reset-and-reseed-postmortem-2026-07-24.md).
The sequence below is a plan-level checklist; the runbook remains authoritative
for exact command arguments and recovery details.

### 1. Automated preflight

The executor performs and records these checks without asking the plan author:

- `DATABASE_URL` and `DRIZZLE_DATABASE_URL` identify the same approved
  disposable non-production database;
- the database role and project identity are expected;
- a usable backup exists;
- web, workers, monitors, and other writers are quiesced;
- the Platform Administrator Auth UUID is available;
- required provider/storage secrets are configured; and
- both registered release references exist.

Run:

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run build
```

### 2. Rehearse before clearing the shared target

On a fresh disposable database:

1. apply the required pre-push SQL;
2. run the exact strict Drizzle push;
3. inspect generated DDL ordering for every new composite identity and foreign
   key;
4. apply all post-push SQL; and
5. run schema/security verification.

Do not proceed while the rehearsal has a partial or failed schema state.

### 3. Clear the disposable target

Scope the destructive guard to the clear command and fail on any nonzero native
exit:

```powershell
$env:DB_CLEAR_CONFIRM = 'clear-app-tables'
try {
  npm.cmd run db:clear
  if ($LASTEXITCODE -ne 0) { throw 'db:clear failed' }
}
finally {
  Remove-Item Env:DB_CLEAR_CONFIRM -ErrorAction SilentlyContinue
}
```

No additional approval from the plan author is required.

### 4. Pre-push SQL

Apply, in the runbook order:

```powershell
npm.cmd run db:apply-operator-sql -- supabase/sql-editor/004_gap_evidence_infrastructure.sql
npm.cmd run db:apply-operator-sql -- scripts/sql/api-corpus-integrity-additions.sql
```

### 5. Apply the Drizzle schema

Run:

```powershell
npx.cmd drizzle-kit push --strict --verbose
```

Review the full proposed diff, approve only the expected coordinated schema,
and never use `--force`.

`drizzle-kit push` is not atomic. If it fails:

1. stop immediately;
2. inspect the actual schema state;
3. keep all writers stopped;
4. fix and rehearse the ordering issue; and
5. restart the disposable clear/push sequence from a known state.

### 6. Post-push infrastructure and security

Apply the exact runbook sequence, including:

- the second `004_gap_evidence_infrastructure.sql` pass;
- definition/application server-only RLS SQL;
- workflow server-only revokes;
- guest retention;
- the second API/corpus integrity pass;
- Phase 1 and legal-corpus server-only SQL;
- append-only audit protection; and
- legal-corpus indexes.

Set up and verify all private storage buckets.

RLS lives in the Drizzle model. Operator-owned triggers and HNSW indexes remain
outside it and require their dedicated verifiers.

### 7. Reseed and govern the corpus

The executor:

1. bootstraps the Platform Administrator;
2. seeds the controlled Legal Corpus fixture;
3. drains import, processing, and embedding jobs;
4. inspects the exact source renditions and processing generations;
5. records corpus review/acceptance through the guarded operator command;
6. creates, publishes, and evaluates releases for both required families; and
7. activates only evaluation-passed releases.

This is an auditable governance operation, but it does not require review by
the plan author.

### 8. Publish and activate application releases

Use the registered references:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
npm.cmd run db:publish:gap -- --release nis2-gap/guided-v3
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v3
```

Preserve the runbook's actor attribution, environment-variable cleanup, and
explicit `$LASTEXITCODE` checks.

### 9. Final verification

Run at minimum:

```powershell
npm.cmd run db:verify:server-only
npm.cmd run storage:verify
npm.cmd run db:verify:rollout
npm.cmd run db:verify:gap-requirements
npm.cmd run db:smoke:nis2
npm.cmd run db:smoke:gap
npm.cmd run verify
npm.cmd run test:worker
npm.cmd run test:ai
npm.cmd run build
```

Also run:

- typed-value and owner-integrity database integration tests;
- module-boundary architecture tests;
- report, upload, idempotency, and job result tests;
- the updated Compliance and Gap benchmarks;
- corpus/document query-plan benchmarks; and
- an authenticated end-to-end generate/correct/finalize/read-only Gap flow.

Resume application writers only after every dedicated gate passes.

## Test matrix

### Schema and database integration

- removed columns/tables/enums are absent;
- all composite owner and active-pointer constraints exist;
- invalid cross-owner pointers fail;
- invalid release-code/family pointers fail;
- invalid Action Plan source organization/type fails;
- invalid review revision/Finding pairs fail;
- all Answer/Fact datatype and option-parent failures fail;
- Gap revision JSON containing `findings` fails; and
- valid transactions pass with deferred checks.

### Module behavior

- public command/read interfaces cover every current caller;
- exact projections return the required DTOs;
- generation and correction create normalized Finding state only;
- finalization reads normalized state and remains atomic;
- typed sources preserve staleness and exact-input behavior;
- one-plan-ever and generate-once guards remain;
- Legal Corpus publication retains review/evaluation/activation gates; and
- report/job/upload/idempotency replay resolves typed targets.

### Cross-layer behavior

Follow ADR 0032:

- shared contracts and typed clients agree;
- routes authenticate and validate;
- module and database constraints are exercised;
- authorization, idempotency, and concurrency are tested;
- worker retry/cancellation is tested; and
- grounding/citation evaluations pass.

### Architecture regression

The static test fails on:

- a direct database/schema import from a route, page, client, or orchestration
  layer;
- a cross-module private persistence import;
- an unprojected production `.select()`;
- a full-row relational production query; or
- a new live `type + UUID` relationship.

## Documentation updates during implementation

Update:

- `docs/architecture/database-structure.md`;
- `docs/architecture/end-to-end-compliance-workflow.md`;
- `docs/architecture/organization-api-architecture.md`;
- `docs/database/development-database-reset-and-bootstrap.md`;
- `docs/database/api-corpus-rollout-runbook.md`;
- `docs/database/supabase-security-runbook.md`;
- relevant product workflow documentation; and
- historical plans whose status notes incorrectly describe current behavior.

Replace outdated smoke instructions for reassessment/reconciliation with the
generate-once, correct-before-plan, finalize-and-lock workflow.

## Acceptance criteria

The implementation is complete only when:

- all ten removal decisions are reflected in schema, code, definitions,
  hashes, tests, and docs;
- upstream legal publication provenance is captured and displayed without
  affecting legal-effect evaluation;
- all three retained denormalizations are database-enforced;
- every audit-listed ownership/type invariant is enforced by PostgreSQL;
- typed Answers and Facts cannot persist an invalid representation;
- normalized Gap Findings/evidence are the sole Finding business source;
- Gap revision JSON is metadata-only and versioned;
- live workflow lineage/results use typed foreign keys;
- audit identifiers remain intentionally polymorphic and self-describing;
- all seven business modules and affected operational modules meet the public
  boundary rules;
- production server code contains no unprojected reads or full-row relational
  queries;
- architecture tests prevent boundary regressions;
- every index addition/removal has recorded query-plan evidence;
- the fresh-database rehearsal and shared disposable rollout succeed;
- RLS, browser-grant denial, audit triggers, and private storage pass;
- both required Corpus Families are reviewed, evaluated, and active;
- `nis2/2026-v1` and `nis2-gap/guided-v3` are published and active;
- current workflow smoke tests and benchmarks pass; and
- `verify`, worker tests, AI evaluations, and the production build pass.

## Implementation evidence

Acceptance was completed on 2026-07-24 against the approved live disposable
development target:

- the from-empty database rehearsal completed the pre-push, strict Drizzle,
  post-push, and integrity sequence before the shared cutover;
- the live schema verifier covered all 122 public tables and 44 rollout
  tables, with two append-only audit triggers, durable schedulers, and no
  browser-role access;
- the remediation verifier found all 10 constraints and 9 deferred triggers,
  rejected four invalid transactions, and accepted the valid control
  transaction;
- all three storage buckets are private;
- active evaluated Corpus Releases are
  `195bc420-fe15-4805-b4c4-eb05f35728f9` (`nis2-eu-primary`) and
  `510f6d0e-333e-4736-81e6-6cae1955e786`
  (`nis2-de-primary`);
- active releases are `d255ecd9-b293-4c2c-8815-f1c97770f5ee`
  (`nis2/2026-v1`) and `ddff07d5-3bb0-42d6-9cc5-4b0c8fd4ce96`
  (`nis2-gap/guided-v3`);
- applicability, Gap, API/corpus, and authenticated
  generate/correct/finalize/repeated-read smokes passed; the authenticated
  fixture has four normalized findings and action plan
  `77e4d060-b0d7-4293-888a-dbbd7c9c7e91`;
- the final complete Gap workflow warm median was 259.3 ms at exactly 17 SQL
  calls; Compliance and Corpus/Document assertion-mode benchmarks passed, and
  the 250,000-row structural index benchmark retained only evidence-backed
  changes;
- `npm run verify` passed 77 files/434 tests, the worker suite passed 10 tests,
  AI evaluations passed 8 tests, and the Next.js production build completed;
  and
- the final rollout verifier reported zero unfinished jobs and a scheduled
  next cleanup.

## Rollback

Before the database cutover, revert individual code slices normally.

After the disposable schema cutover:

1. keep writers stopped;
2. return web and worker code to the preceding coordinated revision;
3. run the preceding revision's approved guarded clear/push/reseed workflow;
4. republish and reactivate its registered releases; and
5. rerun its dedicated security, storage, corpus, smoke, test, and build gates.

Do not use `db:reset`, `--force`, a second post-security Drizzle push, or
blanket privilege grants.
