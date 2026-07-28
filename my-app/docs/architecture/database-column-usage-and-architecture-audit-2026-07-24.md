# Database Column Usage and Architecture Audit

Date: 2026-07-24  
Status: Current-state audit and recommendation  
Scope: PostgreSQL schema, runtime usage, operational scripts, tests, and persistence architecture
Implementation response:
[Database Column and Persistence Architecture Remediation](../plans/done/database-column-and-persistence-architecture-remediation.md)

> Remediation status (2026-07-24): the linked response is implemented. This
> file remains the pre-remediation audit snapshot; table/column names and
> recommendations below intentionally describe the state that was audited.

## Executive summary

The audit covered all 113 public database tables and all 951 columns declared
in `src/db/schema.ts`. The live PostgreSQL schema matches the Drizzle schema
exactly: no modeled columns are missing and no extra live columns were found.

The main confirmed redundancy is
`gap_requirement_versions.recommendation`. It is populated by the release
publisher, loaded and localized by the Gap release loader, and exposed through
`LoadedGapRelease`, but no production consumer uses it. The Gap prompt omits
the catalogue recommendation and the AI generates a new recommendation for
each finding. The column is therefore dead-throughput state.

The audit found:

- 937 columns with no current removal signal;
- two columns recommended for removal;
- nine columns whose intended behavior should either be implemented or the
  columns removed;
- three useful but unsafe denormalizations that require database-level
  consistency enforcement;
- several cross-table ownership invariants enforced only by application code;
- duplicated Gap finding state in JSON and normalized rows;
- weak referential integrity around polymorphic references and typed values;
- 19 strict left-prefix index redundancy candidates; and
- 113 foreign keys without a supporting left-prefix index, which require
  workload-based prioritization rather than blanket indexing.

The live rows examined during the audit are currently consistent. This does
not remove the architectural risks because PostgreSQL still permits invalid
states that the application happens not to create today.

## Audit method

The review combined:

1. Static extraction of every table and column from `src/db/schema.ts`.
2. Comparison with `information_schema.columns` in the configured live
   PostgreSQL database.
3. Repository-wide tracing through:
   - server queries and writes;
   - Next.js routes and pages;
   - feature clients and contracts;
   - workers;
   - publishing and activation scripts;
   - Supabase SQL;
   - tests and evaluations; and
   - architecture and product documentation.
4. Live, read-only checks for:
   - row and non-null population;
   - cross-owner revision pointers;
   - release-pointer identity mismatches;
   - question/fact option mismatches;
   - cross-tenant Action Plan references;
   - schema drift;
   - RLS and browser grants; and
   - index and foreign-key coverage.
5. Baseline verification with TypeScript and Vitest.

### Verification results

- Drizzle columns: 951
- Live public columns: 951
- Missing live columns: 0
- Extra live columns: 0
- Public tables: 113
- Tables with RLS enabled: 113
- Direct table grants to `anon` or `authenticated`: 0
- TypeScript typecheck: passed
- Vitest: 70 files passed, 348 tests passed

The live database had recently been reset and seeded. Null counts and low row
counts were therefore treated as supporting evidence, not as sufficient proof
that a column is redundant.

## Column disposition

### Remove

#### `gap_requirement_versions.recommendation`

Current behavior:

1. The release publisher writes the localized JSON recommendation.
2. The release loader reads and localizes it.
3. `LoadedGapRelease.requirements` exposes it.
4. The generation prompt does not include it.
5. The AI independently produces `gap_findings.recommendation`.
6. Action Plan descriptions are derived from the generated or human-corrected
   finding recommendation, not the catalogue recommendation.

This field is populated in every current Gap requirement row but has no
downstream production consumer.

Recommendation:

- remove the database column;
- remove the release-definition field;
- remove it from requirement content hashes;
- remove `LegacyLocalizedJson` and the associated localization path if nothing
  else uses them;
- remove it from `LoadedGapRelease`;
- update publisher and loader tests; and
- document that recommendations are generated finding output, not authored
  requirement metadata.

Relevant implementation:

- `src/db/schema.ts`
- `src/server/gap-analysis/publishing/publish-release.ts`
- `src/server/gap-analysis/release-loader.ts`
- `src/server/gap-analysis/prompt-builder.ts`
- `src/server/gap-analysis/generation-service.ts`
- `src/server/gap-analysis/finalization-service.ts`

#### `gap_requirement_versions.code`

`gap_requirement_versions.code` duplicates the immutable and unique
`gap_requirements.code`. The current live values agree, but no database
constraint requires equality.

The stable requirement record exists specifically to provide identity across
versions, so its code should be authoritative.

Recommendation:

- retain `gap_requirements.code`;
- join the stable requirement in the release loader;
- use the stable record's code for runtime and publication verification; and
- remove `gap_requirement_versions.code`.

### Implement or remove

The following columns have no completed runtime behavior behind them:

| Column | Current state | Recommendation |
| --- | --- | --- |
| `assessment_revisions.change_reason` | No non-schema runtime reference; null in current rows | Implement revision-reason capture or remove |
| `assessment_revisions.reverted_from_revision_id` | No runtime reference; null | Implement immutable revert or remove |
| `generated_artifact_revisions.reverted_from_revision_id` | No runtime reference; null | Implement artifact revert or remove |
| `action_plans.predecessor_plan_id` | No runtime reference; null | Implement plan replacement/reconciliation or remove |
| `action_plan_items.predecessor_item_id` | No runtime reference; null | Implement item reconciliation or remove |
| `ai_processing_runs.estimated_cost_micros` | No runtime reference; null | Add a provider-aware cost calculator or remove |
| `legal_source_versions.upstream_published_at` | No runtime reference; null | Add ingestion and display behavior or remove |
| `legal_source_versions.supersedes_version_id` | No runtime reference; null | Implement source supersession or remove |
| `gap_analysis_releases.model_policy` | Published and loaded, but ignored by generation | Enforce it or remove it |

`gap_analysis_releases.model_policy` deserves priority because it creates a
false assurance about provider choice, model choice, batching, cost, and
potential external disclosure. The current Grounding Gateway instead selects
the provider and model from organization policy and environment configuration.

### Keep only with consistency enforcement

#### `assessments.module_id`

The module is derivable from either the pinned Compliance Release or pinned
Gap Release. The column is useful for grouping and query performance, but the
database can currently store a module that disagrees with the release.

#### `assessments.questionnaire_id`

The questionnaire is derivable from the release's pinned questionnaire
version. It is useful as a stable grouping key, but equality is not enforced.

#### `assessment_answers.question_stable_key`

This duplicates `questions.stable_key`. It is useful for semantic queries and
debugging but can disagree with `question_id`.

Recommendation:

- either remove each derived column and join to its authoritative source; or
- retain it as an intentional denormalization and enforce equality with
  composite unique keys and composite foreign keys.

For the current query patterns, retaining these columns with database-level
enforcement is reasonable.

## Intentional duplication that should remain

Not every duplicated value is redundant. The following categories provide
auditability or stable historical interpretation:

- immutable content and release hashes;
- immutable excerpt snapshots disclosed to an AI provider;
- input and rendered-input hashes;
- processing-generation configuration snapshots;
- current activation pointers plus append-only activation history;
- current versus accepted artifact revision pointers;
- report input snapshots;
- citation excerpts and source identifiers; and
- output locale pins across generated outputs and plans.

These values should remain where they allow a historical result to be
understood without consulting mutable external state.

Their consistency should be enforced where possible.

## Architectural findings

### 1. Revision ownership is enforced only by application code

The schema permits several invalid relationships:

- `generated_artifacts.current_revision_id` can point to a revision belonging
  to another artifact.
- `generated_artifacts.accepted_revision_id` can point to a revision belonging
  to another artifact.
- `assessments.current_revision_id` can point to a revision belonging to
  another assessment.
- `documents.current_version_id` can point to a version belonging to another
  document.
- a Gap review resolution can combine a revision with a finding from another
  revision;
- an Action Plan can reference another organization's artifact revision; and
- an active release pointer can use a code or family that disagrees with the
  referenced release.

No violations were found in the current live rows. The database nevertheless
allows them.

Recommendation:

Use composite identities and foreign keys:

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

Apply the same pattern to review resolutions, active pointers, tenant-scoped
sources, and Action Plans.

### 2. Typed answers and facts lack database-level type integrity

`assessment_answers` and `organization_fact_values` use parallel nullable
value columns:

- text;
- number;
- boolean;
- date or structured JSON; and
- separate option join rows.

PostgreSQL does not currently enforce:

- that exactly one representation is used;
- that the representation matches the question or fact datatype;
- that a selected question option belongs to the answer's question; or
- that a selected fact option belongs to the fact value's definition.

Recommendation:

1. Add composite keys that bind an option to its parent question or fact:

   ```text
   question_options:
     UNIQUE (question_id, id)

   assessment_answer_options:
     include question_id
     FOREIGN KEY (question_id, question_option_id)
       -> question_options (question_id, id)
   ```

2. Do the equivalent for organization fact options.
3. Add a check preventing multiple scalar representations.
4. For full datatype enforcement, use subtype tables or a database trigger that
   validates against the referenced question/fact definition.

### 3. Gap findings have two sources of truth

Gap generation stores substantially the same finding state in:

- `generated_artifact_revisions.result.findings`; and
- normalized `gap_findings` rows.

Duplicated fields include:

- requirement identity;
- status;
- evidence sufficiency;
- severity;
- rationale;
- recommendation;
- assumptions; and
- review state.

Correction logic must update both representations transactionally. A future
code path or operator change can cause them to diverge.

Recommendation:

- make normalized `gap_findings` authoritative for finding fields;
- keep only revision-level metadata in
  `generated_artifact_revisions.result`, such as:
  - output schema kind;
  - source IDs;
  - contradictions;
  - questionnaire disagreements;
  - correction metadata; and
  - other non-normalized generation metadata; or
- introduce a dedicated `gap_artifact_revisions` subtype table and reduce the
  generic JSON payload further.

### 4. Polymorphic references weaken referential integrity

Several tables use a `type + UUID` relationship without a target foreign key:

- `artifact_revision_sources`;
- `report_sources`;
- `audit_events`;
- `platform_audit_events`;
- background job results;
- upload results; and
- idempotency results.

This flexibility prevents PostgreSQL from detecting dangling references and
from enforcing tenant ownership.

Recommendation:

- retain polymorphic references for immutable audit history where the event
  should outlive the referenced object;
- use typed source tables for live workflow dependencies, for example:
  - `artifact_revision_assessment_sources`;
  - `artifact_revision_artifact_sources`;
  - `artifact_revision_document_sources`; and
  - `artifact_revision_fact_sources`; and
- use typed result tables or constrained result registries for operational
  jobs where replay depends on the target still existing.

### 5. The persistence interface is too wide

Current repository measurements:

- 53 of 139 server TypeScript files import database/schema definitions;
- 156 full-row `db.query.*.findFirst/findMany` calls exist in server code; and
- six unprojected `.select()` calls exist.

This creates a shallow persistence interface:

- callers must know physical table layouts;
- whole rows are loaded when only a few fields are needed;
- schema changes spread across many callers;
- dead-throughput fields appear to be live merely because a whole row is
  selected; and
- tenant, lifecycle, and ownership invariants are repeatedly reconstructed in
  services.

Recommendation:

Create deep modules around business use cases, not generic repositories around
individual tables:

- Compliance Release Catalogue
- Assessment Submission
- Artifact Revision Lifecycle
- Gap Generation and Review
- Evidence Library
- Action Plan Lifecycle
- Legal Corpus Publication

Each module should expose a small command/read interface and use explicit
database projections internally. The existing Compliance Runtime Release
assembler is a useful direction: it concentrates release-loading behavior
behind a dedicated seam.

Do not add a repository interface merely to wrap every Drizzle call. Introduce
an adapter seam only where an actual production/test or local/remote variation
exists.

### 6. Lifecycle schema and product behavior disagree

The schema contains structures for:

- revision reverts;
- Gap reassessment;
- Action Plan replacement and reconciliation; and
- legal source supersession.

The current product behavior is generate-once, permits only one plan ever, and
does not implement plan reconciliation. This creates a large interface for
behavior that callers cannot exercise.

Recommendation:

Choose one of two explicit directions:

1. Current minimal lifecycle:
   - remove revert and predecessor columns;
   - simplify current/candidate paths;
   - remove stale historical service concepts.
2. Full revision lifecycle:
   - implement reassessment;
   - implement immutable revert;
   - implement plan replacement and item reconciliation;
   - add recovery from stale pre-finalization results; and
   - test these behaviors through one lifecycle module interface.

Until product requirements choose the second direction, the first direction
has lower complexity and lower integrity risk.

### 7. Index policy needs cleanup and prioritization

#### Redundant index candidates

Nineteen non-unique indexes are strict left prefixes of wider indexes with
matching access method and predicate:

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

The wider indexes can serve queries on their leading columns. Verify with
`EXPLAIN` against representative queries and then remove the redundant
indexes to reduce write amplification and schema noise.

#### Unindexed foreign keys

The live schema has 113 foreign keys without a supporting left-prefix index.
PostgreSQL does not create indexes automatically for referencing columns.

Do not add all 113 automatically. Prioritize:

- high-row-count membership tables;
- document chunks and embeddings;
- legal source chunks and embeddings;
- AI context and claim tables;
- finding evidence;
- source/release membership joins;
- foreign keys used in parent deletion or archival; and
- foreign keys visible in measured slow queries.

Use production-like benchmarks and `EXPLAIN (ANALYZE, BUFFERS)` before and
after each index group.

## Other system-level risks

The canonical workflow documentation already identifies additional concerns
that should be included in the architecture backlog:

1. Gap Analysis does not explicitly require a positive applicability outcome.
   Negative and clarification outcomes can enter the wizard and fail later
   after selecting zero requirements.
2. Organization evidence processing is synchronous and lacks OCR.
3. Embedding disclosure bypasses the organization chat-provider policy.
4. Generate-once guards combined with staleness can create a state from which
   the user cannot finalize or regenerate.
5. Legal grounding is fixed to EU/DE families and German retrieval.
6. The current Gap catalogue contains only four demo-derived requirements.

These are not column redundancies, but they influence whether the current
schema is supporting real product behavior or preserving unused future
structures.

## Recommended implementation sequence

### Phase 1: Remove misleading and redundant state

1. Remove `gap_requirement_versions.recommendation`.
2. Remove `gap_requirement_versions.code` after changing consumers to use
   `gap_requirements.code`.
3. Enforce or remove `gap_analysis_releases.model_policy`.
4. Remove dormant lifecycle and metadata columns not scheduled for
   implementation.

### Phase 2: Close database integrity gaps

1. Add owner-scoped composite foreign keys for revision/version pointers.
2. Enforce active release pointer identity.
3. Enforce question-option and fact-option parent identity.
4. Enforce assessment module/questionnaire denormalizations.
5. Enforce tenant and artifact type for Action Plan source revisions.
6. Add status/timestamp consistency checks to lifecycle tables where useful.

### Phase 3: Establish one authoritative Gap model

1. Make `gap_findings` the source of truth.
2. Reduce Gap revision JSON to revision metadata.
3. Update generation, correction, workflow reading, and finalization to read
   normalized findings.
4. Add a consistency migration check before removing duplicated JSON fields.

### Phase 4: Deepen persistence modules

1. Start with the Gap lifecycle because it has the highest state duplication
   and recovery complexity.
2. Move queries behind explicit use-case interfaces.
3. Replace whole-row reads with explicit projections.
4. Test behavior through the module interface rather than through internal
   query fragments.

### Phase 5: Tune indexes from measured workloads

1. Remove verified prefix-redundant indexes.
2. benchmark important unindexed foreign keys;
3. add only indexes justified by joins, deletion behavior, or measured query
   plans; and
4. re-run the existing Gap and compliance runtime benchmarks.

## Final recommendation

The architecture has strong foundations:

- immutable published definitions;
- deterministic applicability decisions;
- explicit AI provenance;
- current versus accepted business revisions;
- source and citation pinning;
- comprehensive RLS;
- server-only data access; and
- append-only audit concepts.

Its main weakness is not normalization versus denormalization in isolation.
The weakness is that several relationships and future lifecycle concepts are
visible through a large persistence interface without being protected by
database invariants or completed product behavior.

The preferred target is:

```text
Small use-case interfaces
  -> deep workflow modules
    -> explicit PostgreSQL projections and commands
      -> database-enforced ownership and type invariants
```

This preserves the existing auditability while reducing unused state,
dual-write risk, and the amount of schema knowledge every caller must carry.
