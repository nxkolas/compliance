# Immutable Compliance Release Architecture

Status: Approved — code implementation and code-level verification completed on 2026-07-16; guarded database cutover and live smoke tests still require a confirmed disposable target.

## Objective

Refactor the current NIS2 applicability checker so that normalized PostgreSQL records are the authoritative legal-content model, published releases are immutable and auditable, and the evaluator consumes a compiled JSON artifact rather than an editable JSON blob.

The database foundations should support later compliance checks without prematurely building a generic rule language or a complete evaluator-plugin framework. This implementation migrates only the NIS2 scope checker.

## User-visible outcome

- The NIS2 checker continues to ask 12 applicability questions and returns the same four outcome categories.
- Question wording, options, entity definitions, result explanations, and legal references come from one versioned localization/content model.
- A guest or authenticated assessment is pinned to one complete compliance release when it starts.
- Historical results retain the exact legal model and localized content revisions used when they were created.
- Results display their release version and show an outdated indicator when a newer release is active.
- An outdated result offers a clean “start assessment with current rules” action. It is never silently re-evaluated.
- Unsupported-country behavior remains asymmetric: reliable EU-core inclusions may be returned, while negative conclusions require a supported national profile.
- Country selection precedes entity selection. Germany uses its pinned national catalog; unsupported countries use the EU application catalog.
- The German catalog covers all 67 BSIG Annex statutory identities plus the four supported out-of-annex identities defined by BSIG § 2(9) and § 29. Selectable identities may split one statutory row when classification requires it; critical-installation qualification remains a separate evidence-bearing designation.

## Accepted architecture decisions

1. Design generic database foundations, but implement and migrate only NIS2 now.
2. Treat every published release as completely immutable, including questions, options, legal references, translations, profiles, parameters, and compiled rules.
3. Keep static interface text in `lib/i18n.ts`; store only dynamic/versioned compliance content in the database localization model.
4. Use normalized tables as the authoritative authoring model and retain `rule_sets.rules` only as an immutable compiled execution artifact.
5. Continue authoring legal content in reviewed repository files. Do not add an admin editor or permit direct production edits.
6. Clear and reseed current development data; do not build a legacy-data converter or dual-write compatibility layer.
7. Store German and English as equal translation rows. Do not retain base-language text columns on compliance domain records.
8. Require complete German and English translations before publication; runtime fallback to the release default locale is defensive only.
9. Keep a full immutable result evidence snapshot while also persisting typed reporting projections.
10. Normalize authenticated single- and multi-choice selections through option join rows.
11. Retain organization facts as reusable, provenance-tracked projections and normalize their enum/multi-enum selections.
12. Normalize legal instruments and provisions, including jurisdiction, official source, provision identifier, and effective dates.
13. Pin assessments to releases at creation and never silently reinterpret an old assessment.
14. Version EU-core models and national profiles independently, then pin their exact combination in an aggregate release.
15. Give entity types stable cross-release identities while storing their legal meaning in immutable version rows.
16. Keep legal algorithms in reviewed TypeScript evaluators; store thresholds, mappings, and rule parameters as versioned data.
17. Publish releases using a dedicated transactional command that refuses to modify an existing published version.
18. Deny `anon` and `authenticated` direct table access. Browser clients continue using server APIs exclusively.
19. Manage ordinary schema, constraints, indexes, and relations through Drizzle and the existing `db:push` workflow.
20. Deliver Supabase-specific RLS, privileges, and scheduled cleanup as idempotent SQL files plus an SQL Editor runbook.
21. Retain superseded published releases indefinitely and protect referenced records with restrictive foreign keys.
22. Reuse unchanged localized content through immutable content revisions; wording changes create new revisions.
23. Use one active aggregate release per check. It pins the questionnaire, evaluator, EU model, thresholds, compiled artifact, and a mapping of supported national-profile versions.
24. Create guest sessions when the questionnaire is loaded so the release is pinned before jurisdiction is answered.
25. Expire abandoned guest sessions after 24 hours and submitted claimable results after 14 days.
26. Physically delete expired guest data using a documented daily Supabase cleanup job.
27. Store language-neutral result evidence: stable codes, version IDs, facts, and legal-provision IDs. Resolve display text from pinned content revisions.
28. Treat evaluator identifiers as immutable semantic contracts. Outcome-affecting changes require a new evaluator identifier and release.
29. Gate publication with version-controlled golden fixtures and deterministic compilation checks.
30. Roll back a bad release by retiring it and reactivating the prior release, never by rewriting historical records.
31. When a completed assessment changes an organization fact, transactionally supersede only facts answered by that assessment and retain prior provenance.
32. Deliver the development migration as one coordinated cutover without an old/new schema compatibility period.
33. Replace generic entity descriptions with reviewed, entity-specific definitions and structured official references for all 70 stable application entity identities before publishing the first immutable release. Preserve many-to-one provenance where application identities split one statutory category.
34. Give each supported national profile its own stable selectable national entity identities and immutable version rows. A selectable identity may split or combine statutory rows when the evaluator needs a decisive distinction; shared provision provenance preserves the statutory relationship. Do not model national law as overrides of EU application identities.
35. Store explicit zero-to-many national mappings to EU application identities with relationship kinds `exact`, `subset`, `aggregate`, `overlap`, or `none`; mappings express provenance, not legal equivalence.
36. Keep the 12-question flow. Move country to question 2 and make question 3's option catalog profile-driven: German answers use German identities, while unsupported countries use EU application identities.
37. Treat the user's entity selection as an evidence-bearing assertion that the selected legal definition is met. Definitions must state decisive inclusions and exclusions; `unknown` remains available where the user cannot establish them.
38. Expand the existing size-verification answer so it records whether submitted AWU/financial buckets already apply the pinned profile's two-period, partner/linked-enterprise, and German IT-independence rules. Do not build a company-group calculator in this release.
39. Store typed national classification predicates, aggregation policy, jurisdiction-basis rules, and legal provisions in the profile. The reviewed TypeScript evaluator retains formula semantics.
40. Introduce `nis2_scope_v3` for the outcome-affecting national-profile algorithm. Preserve `nis2_scope_v2` as a retained historical evaluator; use a narrow explicit dispatch and do not add a generic plugin framework.
41. Keep critical-installation qualification as a formal status under a pinned effective regime. Do not infer it from sector, size, or self-assessed criticality, and do not build a BSI-KritisV capacity calculator.
42. Publication and activation must fail closed when the BSIG § 66 / BSI-KritisV § 12 transition state, required § 29 orders, or other time-sensitive official legal sources are not explicitly captured for the release effective date.
43. Store national identity version IDs, mapping IDs, classification-rule codes, jurisdiction-rule codes, aggregation-policy codes, and legal-provision IDs in language-neutral result evidence.

## Non-goals

- Do not add another compliance framework or applicability check in this change.
- Do not build a database rule-language editor, visual rule builder, or compliance CMS.
- Do not build a generalized evaluator-plugin system before a second real evaluator exists.
- Do not migrate current development assessments, guest checks, results, or organization facts.
- Do not automatically copy answers between releases.
- Do not automatically re-evaluate historical assessments.
- Do not move static navigation, button, layout, or other application-shell translations out of `lib/i18n.ts`.
- Do not give browser roles direct read access to “safe” definition tables.
- Do not manage ordinary tables or columns through hand-written Supabase SQL.
- Do not use `db:reset`; the cutover uses the approved `db:clear` and `db:push` workflow.
- Do not add a thirteenth questionnaire question; extend existing option sets and evidence assertions within the 12-question flow.
- Do not calculate AWU, group consolidation, NACE status, REACH registration, German IT independence, or negligible activity from organization names or broad sector selections.
- Do not calculate critical-installation status from raw BSI-KritisV sector capacity or throughput metrics. Accept only a formal evidence-bearing status tied to the pinned regime.
- Do not implement the 16 Länder regional-administration regimes. A German regional-administration path without a pinned Land-law designation remains `clarification_required`.

## Target data model

The exact Drizzle names may be adjusted to match repository conventions, but the relationships and constraints below are required.

### Localized content

#### `content_items`

Stable semantic identities for dynamic compliance content.

- `id`
- `stable_key` — globally unique, for example `nis2.entity.dns_service_provider.label`
- `format` — plain text or Markdown
- timestamps

#### `content_revisions`

Immutable revisions that may be reused by multiple releases.

- `id`
- `content_item_id`
- `revision_number`
- `content_hash`
- timestamps
- unique `(content_item_id, revision_number)`
- unique `(content_item_id, content_hash)` to make publishing idempotent

#### `content_translations`

- `content_revision_id`
- `locale`
- `value`
- primary/unique key `(content_revision_id, locale)`
- index on `locale`

Both `de` and `en` are normal rows. Publication requires both locales for every referenced user-visible content revision.

The following old special-purpose translation tables are replaced after the approved development clear:

- `question_translations`
- `question_option_translations`
- `organization_fact_definition_translations`

### Legal sources

#### `legal_instruments`

Stable identity such as `eu_nis2`, `eu_sme_recommendation`, or `de_bsig`.

- `id`
- `code`
- `jurisdiction_code`
- `instrument_type`
- unique code

#### `legal_instrument_versions`

- `id`
- `legal_instrument_id`
- official identifier
- official source URL
- effective-from/effective-to dates
- title content revision
- immutable source/content hash

#### `legal_provisions`

- `id`
- `legal_instrument_version_id`
- stable provision code such as `article_3` or `section_28_1_1`
- optional official fragment/source URL
- citation content revision when localized display text is required
- unique `(legal_instrument_version_id, provision_code)`

Domain records reference legal provisions through join tables rather than storing citation strings.

### Stable facts and options

Retain `organization_fact_definitions` as stable semantic identities, but remove localized display columns and make their type constraints explicit.

Add versioned/display records where a fact’s label or explanation is release-dependent. Add stable `fact_options` for enum and multi-enum values.

#### `fact_options`

- `id`
- `fact_definition_key`
- `stable_value`
- optional stable `scope_entity_type_id`
- unique `(fact_definition_key, stable_value)`

Question-option versions reference fact options. This prevents the selectable entity catalog and the evaluator catalog from drifting apart.

#### Organization fact values

Retain the existing provenance model and current/history semantics. Replace opaque enum JSON with:

- typed scalar value columns for scalar fact types;
- `organization_fact_value_options` for enum and multi-enum selections;
- JSON only for facts explicitly declared as structured data.

Use a partial unique constraint/index so only one current value exists per organization and fact. Completion supersedes current values in the same transaction that writes the assessment revision and result.

### NIS2 scope models

#### `scope_models` and `scope_model_versions`

Represent the independently versioned EU-core model.

- stable model code
- immutable version label
- publication status
- effective dates
- content hash

#### `scope_sectors` and versioned sector content

Store stable sector codes separately from their immutable localized label revisions.

#### `scope_entity_types`

Stable identities such as `dns_service_provider`.

- `id`
- `code`
- unique code

#### `scope_entity_type_versions`

- `scope_entity_type_id`
- `scope_model_version_id`
- sector version/reference
- Annex number or special-case marker
- supported evaluator rule kind
- label and description content revisions
- immutable definition hash
- unique `(scope_entity_type_id, scope_model_version_id)`

#### `scope_entity_type_legal_provisions`

Many-to-many relationship from an entity-type version to its official legal provisions.

The first release must contain reviewed entity-specific German and English descriptions for all 70 entity types. Generic “legally defined entity type” placeholders are not publishable.

### Thresholds and national profiles

#### `scope_threshold_sets`

Store versioned typed NIS2 parameters, including:

- medium employee threshold;
- medium turnover threshold;
- medium balance-sheet threshold;
- large employee threshold;
- large turnover threshold;
- large balance-sheet threshold;
- comparison inclusivity/exclusivity where necessary;
- SME legal-provision references.

The TypeScript evaluator retains the formula semantics. Data supplies parameters; the database does not contain a generic executable expression language.

#### `jurisdiction_profiles` and `jurisdiction_profile_versions`

- stable jurisdiction/profile identity;
- independent immutable version;
- supported/unsupported status;
- whether a negative conclusion is allowed;
- effective dates and hash;
- profile-level legal provisions.

Germany is the first fully supported profile. Unsupported EU countries have no negative-conclusion profile.

#### National entity identities and versions

Add stable `jurisdiction_entity_types` owned by a jurisdiction profile and immutable `jurisdiction_entity_type_versions` owned by a profile version.

Each version stores:

- national Annex/out-of-Annex locator and ordinal;
- classification rule kind;
- localized label and entity-specific description content revisions;
- immutable definition hash;
- whether remuneration and non-negligible-activity assertions are required;
- legal-provision relationships through `jurisdiction_entity_type_legal_provisions`.

The German release covers all 53 Anlage-1 and 14 Anlage-2 statutory identities, the BSIG § 2(9) domain-registration identity, and the three § 29 federal-administration identities identified in `docs/research/german-bsig-profile-model.md`. It uses separate qualified/non-qualified trust-service selection identities linked to the shared Anlage-1 row. A German regional-administration selection is retained only as an explicit Land-law-unresolved path and cannot support a federal-profile conclusion.

#### `jurisdiction_entity_type_mappings`

Store versioned many-to-many provenance from a national entity-type version to stable EU application identities:

- national entity-type version ID;
- EU application identity ID;
- relationship kind: `exact`, `subset`, `aggregate`, or `overlap`;
- legal provision supporting the relationship.

National identities with no EU application match and EU identities with no national match remain explicit through catalog coverage validation; do not invent mapping rows.

#### Typed profile policies

Replace `jurisdiction_profile_entity_overrides` with typed national modules:

- `jurisdiction_profile_classification_rules` for § 28 / § 29 rule kinds and outcome priority;
- `jurisdiction_profile_threshold_policies` referencing the immutable threshold set and storing AWU, financial-pair, aggregation, Article-3(4), German IT-independence, and negligible-activity policy codes;
- `jurisdiction_profile_jurisdiction_rules` mapping national entity identities to the accepted § 59, § 60, NIS2 Article 26, or Land-law basis codes and legal provisions;
- existing typed designations for formal critical-installation, authority, CER, and § 29 states.

These rows are data parameters for `nis2_scope_v3`, not a generic expression language.

#### `jurisdiction_profile_effective_states`

Store each time-sensitive legal state that publication relies on:

- immutable profile-version ID and stable declaration code;
- typed state value, such as `pre_kritisdachg_regulation` or `post_kritisdachg_regulation`;
- effective-from/effective-to dates and reviewed-at timestamp;
- official legal provision/source URL and optional official announcement identifier;
- immutable declaration hash.

The first German profile requires declarations for the BSIG § 66 definition path, BSI-KritisV § 12 repeal trigger, applicable critical-installation regulation, and any authority order that the catalog or fixtures rely on. Absence is a publication error; expiry or inconsistency is an activation error.

### Questions and options

Retain the existing framework/module/questionnaire concepts, but make published questionnaire versions immutable.

For versioned question rows:

- replace `question_text` and `help_text` with content-revision foreign keys;
- retain stable key, position, answer type, required flag, and narrowly scoped JSON UI/visibility configuration;
- validate configuration in application schemas before publication.

For question-option rows:

- replace `label` with a content-revision foreign key;
- add a fact-option foreign key where the option produces a reusable fact;
- keep only non-domain UI hints in `metadata`;
- remove translated sector descriptions and legal references from metadata.

Entity-selection options reference either a stable EU application identity or a stable national entity identity, never both. Add a relational catalog discriminator to the option/fact-option model; do not hide country applicability in JSON metadata.

Question order is `eu_activity`, `jurisdiction_country`, then entity selection. The immutable questionnaire DTO carries separately keyed pinned catalogs; the client presents only the catalog selected by the country answer. The server rejects an option from the wrong catalog even if a client submits its UUID directly.

The existing size-verification question gains typed answer options that distinguish:

- verified EU/standard aggregation;
- verified German aggregation with no IT-independence exception;
- verified German aggregation using the § 28(4) IT-independence exception;
- not verified;
- unknown.

The existing jurisdiction-basis question gains the § 59/§ 60 basis options required by the German profile. The member-state-designation question retains critical-installation and authority decisions as formal evidence-bearing assertions.

Question fact mappings remain relational and reference stable fact definitions.

### Rules and aggregate releases

#### `rule_sets`

Retain `rules JSONB` as the compiled execution artifact. Add or enforce:

- immutable version identity;
- evaluator kind and evaluator schema version;
- deterministic content hash;
- publication timestamp/status;
- no update path after publication.

The compiled artifact contains stable/version IDs and evaluation parameters required at runtime. It is derived from normalized rows and is not edited independently.

#### `compliance_check_releases`

The aggregate pinned by every assessment/session.

- `id`
- module/check identity
- immutable version label
- questionnaire version ID
- EU scope-model version ID
- threshold-set ID
- rule-set ID
- evaluator kind/version
- default locale
- effective dates as legal metadata
- status: draft/published/retired/superseded as appropriate
- deterministic aggregate hash
- publication timestamp

#### `compliance_check_release_profiles`

Pins the national-profile version supported by an aggregate release.

- `check_release_id`
- `country_code`
- `jurisdiction_profile_version_id`
- unique `(check_release_id, country_code)`

This aggregate solves guest pinning before jurisdiction is known. EU-core and national components remain independently reusable, but the user session pins their exact published combination.

#### `active_compliance_check_releases`

- one row per check/module;
- primary/unique check identity;
- active aggregate release ID;
- activation metadata.

Publishing does not activate. Activation transactionally replaces this pointer. Rollback restores an earlier pointer.

### Assessments, answers, and results

#### Assessment release pin

- Add non-null `check_release_id` to new assessments.
- All revisions of that assessment use the same release.
- Starting under a newer release creates a new assessment, not a cross-release revision.

#### `assessment_answers`

Keep an answer header per revision/question. Add typed scalar fields where supported and retain structured JSON only for explicitly structured answer types.

#### `assessment_answer_options`

- `assessment_answer_id`
- exact versioned `question_option_id`
- primary/unique `(assessment_answer_id, question_option_id)`
- indexed option ID for reporting

Single-choice answers are enforced by validation and, where practical, a database constraint/model distinction. Multi-choice answers use multiple rows.

#### Result evidence and projections

Keep a language-neutral JSON result snapshot containing:

- result schema version;
- outcome/reason codes;
- release, evaluator, model, profile, and threshold version IDs;
- decisive facts;
- matched entity-type version IDs;
- selected national entity-type version IDs and catalog code;
- national-to-EU mapping IDs and relationship kinds;
- applied national classification, threshold-policy, aggregation-policy, and jurisdiction-rule codes;
- legal-provision IDs;
- unresolved fact codes;
- obligation and indirect-exposure codes;
- deterministic input hash and evaluation timestamp.

Add generic searchable fields to the evaluation/artifact revision record where they apply broadly, including outcome code, check release, evaluator kind, and evaluation time. Store NIS2-specific reporting fields such as country and size classification in a one-to-one NIS2 result projection rather than polluting generic artifact tables with framework-specific columns.

Writes to evidence JSON and typed projections occur atomically and are tested for consistency.

### Guest sessions

Extend the guest applicability record into an explicit state machine:

- `started` when the questionnaire is loaded;
- `submitted` after successful validation/evaluation;
- `claimed`, `expired`, or `deleted` as terminal states.

Required fields include the pinned aggregate release, secure token hash, created/submitted/expiry timestamps, and language-neutral submission/result snapshots.

- Started sessions expire after 24 hours.
- Submitted sessions receive a 14-day claim expiry.
- Claiming converts choice answers into relational authenticated answer rows while preserving the pinned release.

## Authoring, compilation, publication, and activation

### Repository source layout

Move the monolithic NIS2 seed definition toward a release-oriented structure, for example:

```text
src/server/compliance/nis2/
  evaluators/
    nis2-scope-v2.ts
    nis2-scope-v3.ts
  releases/
    2026-v1/
      release.ts
      content.ts
      legal-sources.ts
      entity-types.ts
      questions.ts
      profiles/
        de.ts
        de-entity-types.ts
        de-jurisdiction.ts
        de-threshold-policy.ts
      fixtures.ts
  publishing/
    compile-release.ts
    validate-release.ts
```

Exact file splitting should remain pragmatic; the required property is a reviewed, deterministic release definition rather than one oversized mixed file.

### Evaluator contract

- Preserve the current rigid staged NIS2 algorithm as retained `nis2_scope_v2`.
- Implement the national-catalog and typed-profile behavior as `nis2_scope_v3`; the aggregate release selects it explicitly.
- Move thresholds and entity/profile mappings out of hard-coded literals and into typed compiled parameters.
- Keep one deep evaluator interface: compiled immutable artifact plus decisive facts in, language-neutral evidence out. German legal structure stays behind that seam.
- Never change outcome semantics under an existing evaluator identifier.
- Outcome-affecting fixes or new legal algorithms introduce a new evaluator version.
- Do not build a generalized evaluator plugin API yet; keep a narrow dispatch seam that rejects unknown evaluator kinds.

### Publish command

Replace legal-content upserts with a dedicated command, for example:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
```

Before opening the publication transaction, the command must:

1. parse the repository release definition;
2. verify stable-code uniqueness;
3. verify all referenced records exist in the source definition;
4. require complete `de` and `en` translations;
5. verify official legal-source/provision references;
6. reject generic entity description placeholders;
7. validate question visibility and fact mappings;
8. compile the normalized model deterministically;
9. validate the compiled rule artifact schema;
10. run all release golden fixtures;
11. calculate component and aggregate hashes;
12. refuse an existing published version or conflicting hash/version pair.
13. verify coverage of all 67 German Annex statutory identities and four supported out-of-Annex identities, with complete localized definitions and official provisions for every selectable identity;
14. verify mapping coverage across all 70 EU application identities, including explicit no-match cases and every non-`exact` relationship;
15. verify classification, threshold, aggregation, jurisdiction, and designation rules reference typed known codes and official provisions;
16. verify the release records a reviewed effective-state declaration for BSIG § 66, BSI-KritisV § 12, the KRITISDachG regulation trigger, and any referenced § 29/Land authority decision;
17. reject a German profile that allows negative conclusions while any selected catalog identity, required mapping, or applicable jurisdiction path is unresolved.

Within one database transaction it then inserts/reuses immutable content revisions, inserts the normalized component versions, inserts the compiled rule set, inserts the aggregate release/profile mappings, and marks the release published. Any failure rolls back the entire release.

Publishing does not change the active release.

### Activation command

Add a separate explicit command, for example:

```powershell
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
```

It must verify that the aggregate release is complete and published, then atomically update the single active pointer. Activation and rollback actions should be logged.

## API and service changes

### Questionnaire loading

- Resolve the one active aggregate release instead of hard-coded `2026-v1` constants.
- Load the pinned questionnaire, normalized options, and requested-locale content revisions.
- Load the EU catalog and pinned national catalogs relationally into separately keyed immutable DTO catalogs; after country is answered, the client option-selection module presents only the applicable catalog.
- Validate that a required translation exists; use default-locale fallback only as a defensive runtime path.
- Return release identity and supersession metadata in the DTO.
- Cache immutable release definitions by aggregate hash/version where useful, with explicit invalidation when the active pointer changes.

### Guest flow

- Loading the guest questionnaire creates a secure `started` guest session pinned to the active aggregate release.
- Return only the opaque guest session/token needed for submission.
- Submission loads the pinned release from the session; it must never use whichever release is active at submit time.
- Claiming preserves the release and converts answer selections/facts transactionally.

### Authenticated flow

- Creating an assessment pins the current aggregate release.
- Submission validates visible required questions against that release.
- Persist answer headers, option selections, fact supersession, evaluation evidence, result projections, and artifact links in one transaction.

### Profile-driven entity selection

- Reorder country before entity selection without changing the total of 12 questions.
- When country is `DE`, use the German profile catalog. For unsupported countries, use the EU application catalog.
- Changing country clears any entity selection from the previous catalog in the client and is independently enforced by server validation.
- National selection values persist through relational fact/answer option rows and compile to national identity version IDs; mappings add EU provenance without replacing the national selection.
- A selected `overlap`, missing authority decision, Land-law path, unverified aggregation assertion, or other unresolved decisive fact yields `clarification_required` unless an independently reliable higher-priority positive rule decides the result.

### Results

- Resolve localized labels/explanations from pinned immutable content revisions.
- Show aggregate release version and profile versions.
- Compare the pinned release with the current active pointer.
- If superseded, show an outdated badge and a clean-start CTA.
- Never automatically reinterpret or copy an old assessment.

## Supabase SQL deliverables

Ordinary schema changes remain in `src/db/schema.ts` and are applied with `db:push`. Introduce an explicitly manual location for Supabase-only SQL, for example:

```text
supabase/sql-editor/
  001_server_only_definition_rls.sql
  002_server_only_application_data_rls.sql
  003_guest_retention_cleanup.sql
docs/database/supabase-security-runbook.md
```

Each SQL file must be idempotent and safe to paste into the Supabase SQL Editor.

### Definition-table RLS and privileges

- Enable RLS on compliance definitions, content, legal sources, profiles, rules, releases, and active pointers.
- Revoke direct table privileges from `anon` and `authenticated`.
- Create no browser read/write policies.
- Verify the application’s server database role before considering `FORCE ROW LEVEL SECURITY`; do not force owner RLS if it would lock out the direct server connection.

### Application-data RLS and privileges

- Enable RLS and revoke browser-role privileges for organizations, assessments, revisions, answers, answer selections, facts, artifacts, guest checks, and other application-owned operational tables.
- Continue enforcing organization authorization in server APIs.
- Do not add direct organization-member policies in this release.
- Include indexes needed by any future policies, but avoid speculative policy functions.

### Guest cleanup

- Create a `SECURITY DEFINER` cleanup function with an empty, explicit search path and fully qualified table names.
- Revoke public function execution.
- Delete abandoned `started` sessions after 24 hours and submitted unclaimed sessions after 14 days.
- Schedule daily cleanup with `pg_cron` when available.
- Make cron creation idempotent and document a manual fallback invocation.

### Runbook requirements

Document:

1. schema prerequisites and required execution order;
2. current role/BYPASSRLS preflight queries;
3. exact SQL Editor execution steps;
4. verification via `pg_class`, policy catalogs, grants, and role simulation;
5. authenticated and guest server-API smoke tests;
6. cleanup-job inspection and manual execution;
7. rollback statements for policies, grants, and cron without changing ordinary Drizzle schema.

## Implementation sequence

### Phase 1 — Schema and typed contracts

1. Add Drizzle tables/enums/relations for content revisions, legal sources, scope components, national profiles, release aggregates, active pointers, answer selections, fact options, result projections, and guest session states.
2. Add stable/versioned national entity identities, national legal links, explicit national-to-EU mappings, typed profile classification/threshold/jurisdiction policies, and relational option catalog ownership; remove the shallow entity-override model.
3. Refactor existing question/fact/answer tables to remove specialized translation/base-language storage and add required foreign keys.
4. Add restrictive deletion behavior, uniqueness constraints, current-fact partial indexes, reporting indexes, and release hashes.
5. Update `drizzle.config.ts` table filters and `scripts/clear-db.ts` for every managed table.
6. Add schema-focused tests/type checks before service changes.

### Phase 2 — Release source, compiler, and publisher

1. Split the current NIS2 definition into release-oriented repository modules.
2. Research and author reviewed entity-specific German and English definitions for all 70 entity types using official primary legal sources.
3. Author selectable German identities covering all 67 Annex statutory rows, four supported out-of-Annex identities, the explicit regional unresolved path, their localized definitions, and the complete mapping matrix from `docs/research/german-bsig-profile-model.md`.
4. Populate normalized legal instruments/provisions for NIS2, SME Recommendation, CER, BSIG, BSI-KritisV/KRITISDachG, and every incorporated EU/German definition used by both catalogs.
5. Move EU and German thresholds, mappings, classification predicates, aggregation policy, jurisdiction rules, designations, and effective-state declarations into typed release data.
6. Implement and retain the explicit `nis2_scope_v2`/`nis2_scope_v3` evaluator dispatch.
7. Implement release validation, deterministic compilation, content hashing, immutable component reuse/publication, activation completeness checks, and explicit activation.
8. Convert the existing unit cases into release golden fixtures and add compiler/publisher failure cases.

### Phase 3 — Runtime and persistence

1. Resolve the active aggregate release instead of hard-coded version constants.
2. Refactor questionnaire loading/localization around content revisions.
3. Reorder country/entity questions and add profile-driven option-catalog filtering, clearing, and server validation while retaining 12 questions.
4. Keep shared conditional visibility and server-side visible-required validation.
5. Refactor authenticated answers to headers plus relational option selections.
6. Refactor organization facts to normalized typed/option values with transactional provenance supersession.
7. Produce language-neutral result evidence containing national identity/mapping/policy provenance plus typed reporting projections.
8. Preserve the four existing result outcomes and staged evaluation behavior.

### Phase 4 — Guest lifecycle and user-visible release state

1. Create pinned guest sessions on questionnaire load.
2. Submit and claim against the pinned release.
3. Add started/submitted/claimed/expired/deleted lifecycle and TTL behavior.
4. Show release/profile information and superseded-result indicators.
5. Add the clean-start action for the current release.

### Phase 5 — Supabase security and operations

1. Add the idempotent SQL Editor RLS/privilege files.
2. Add the guest cleanup function and optional daily cron schedule.
3. Add the SQL Editor security/rollback runbook.
4. Verify browser roles cannot read or write app tables and server APIs continue working.

### Phase 6 — Coordinated development cutover

Run all code-level verification first. Then use the approved local database sequence, replacing the legacy legal seed with publish/activate commands:

```powershell
$env:DB_CLEAR_CONFIRM='clear-app-tables'
npm.cmd run db:clear
npm.cmd run db:push
```

Execute the documented Supabase SQL Editor security files after the Drizzle schema exists. Then:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
```

Clear `DB_CLEAR_CONFIRM` after the destructive local step. Do not run `db:reset`.

## Affected files and components

Expected existing files:

- `src/db/schema.ts`
- `drizzle.config.ts`
- `scripts/clear-db.ts`
- `scripts/seed-compliance-foundation.ts` — split or replaced for legal-release publication
- `package.json`
- `src/server/questionnaires/service.ts`
- `src/server/applicability-check/service.ts`
- `src/server/applicability-check/rules.ts`
- `src/server/applicability-check/rule-set-schema.ts`
- `src/server/applicability-check/rule-evaluation-schema.ts`
- `src/server/applicability-check/nis2-scope-definition.ts` — replaced by release-oriented definitions
- `src/server/applicability-check/question-visibility.ts`
- `src/server/applicability-check/validation.ts`
- `components/applicability-check/applicability-questionnaire-form.tsx`
- `components/applicability-check/applicability-result-card.tsx`
- guest and organization applicability API routes
- guest cookie/session handling
- `lib/i18n.ts` only for new static UI labels such as outdated-release messaging
- `docs/architecture/db-schema-plan.md`
- `docs/architecture/database-structure.md`

Expected additions:

- `CONTEXT.md` with the compliance-release, EU-identity, national-identity, mapping, profile, and decisive-fact language;
- `docs/research/german-bsig-profile-model.md` as the reviewed primary-source input for the German catalog and rule model;
- release-oriented NIS2 source modules and fixtures;
- compiler/validator/publisher/activator modules and scripts;
- content/legal/release database query services;
- SQL Editor security and cleanup files;
- Supabase security runbook;
- schema, compiler, publication, localization, persistence, guest lifecycle, and integration tests.

## Acceptance criteria

### Schema and integrity

- No question, option, fact, entity type, outcome, or legal explanation stores `label`/`labelEn` pairs or owner-specific translation rows.
- All user-visible compliance content resolves through immutable content revisions with complete `de` and `en` rows.
- Entity choices and evaluator entity types share stable relational identities.
- German choices reference stable national identities; their immutable versions, official provisions, and zero-to-many EU provenance mappings are relationally constrained.
- A fact option cannot reference both an EU application identity and a national entity identity, and catalog membership is not stored in JSON metadata.
- German classification, threshold/aggregation, jurisdiction, designation, and effective-state rules are immutable typed profile data.
- Published release components cannot be updated or cascade-deleted through supported application/publisher paths.
- One aggregate release uniquely pins every component used by an assessment.
- One active aggregate pointer exists for the NIS2 applicability check.
- Choice answers and enum/multi-enum fact values are relationally constrained.
- Full result evidence and typed projections are written consistently in one transaction.

### Publication

- Re-publishing the same published version is refused without modifying data.
- Incomplete translations, missing references, generic entity descriptions, invalid visibility, invalid mappings, failed fixtures, and nondeterministic compilation all prevent publication.
- Missing German catalog rows, incomplete 70-code mapping coverage, unresolved non-exact mapping semantics, unknown rule codes, and absent transitional effective-state declarations prevent publication.
- Activation verifies that the aggregate, all pinned components, the complete German profile, and its recorded legal effective state are published and internally consistent.
- Publishing never changes the active release.
- Activation and rollback atomically change only the active pointer.

### Runtime

- The questionnaire still contains 12 questions and 70 stable application entity identities. These map to the statutory categories with explicit many-to-one and national-profile mappings; 70 is not asserted as a canonical legal count.
- Germany exposes selectable identities covering all 67 Annex statutory rows plus four supported out-of-Annex identities and the explicit regional unresolved path, rather than pretending the 70 EU application identities are German statutory categories.
- Country is answered before entity selection; changing country clears incompatible catalog selections, and the server rejects cross-catalog submissions.
- All four result categories remain reachable through guest and authenticated submissions.
- Exact EU and German threshold boundaries, AWU measure, financial `AND`, employee/financial `OR`, two-period rule, Article-3(4) exclusion, and German § 28(4) IT-independence assertion remain correct.
- German DNS/TLD/qualified-trust, other-trust, telecom, Anlage-1, Anlage-2, § 29, domain-registration, regional-administration, and critical-installation paths follow their distinct compiled rule kinds.
- A missing Land-law designation, BSI/department order, BSI jurisdiction declaration, non-exact mapping fact, or verified size-aggregation assertion produces `clarification_required` unless a higher-priority reliable positive rule independently decides the result.
- Broad sectors and indirect signals cannot determine direct scope.
- Unsupported-country negative results remain `clarification_required`.
- Guest and authenticated flows use the release pinned when their session/assessment was created.
- Historical results render correctly in German and English after a newer release is active.
- Superseded assessments display an outdated indicator and clean-start action.
- New completed assessments supersede only facts they answered and retain old provenance.

### Security and retention

- `anon` and `authenticated` cannot directly select, insert, update, or delete compliance or application data tables.
- Existing server API flows continue to work after RLS/privilege SQL is applied.
- RLS and grants can be verified and rolled back using the runbook.
- Abandoned guest sessions are eligible for deletion after 24 hours.
- Submitted unclaimed guest results are eligible for deletion after 14 days.
- Cleanup SQL is idempotent and has a documented manual fallback.

## Tests and verification

### Automated tests

- Content revision identity, reuse, immutability, locale completeness, and fallback.
- Legal instrument/provision referential integrity.
- Entity stable identity versus versioned meaning.
- Coverage of all 67 German Annex statutory identities, four supported out-of-Annex identities, shared-provision provenance for split selections, and complete reverse coverage of the 70 EU application identities.
- Exact/subset/aggregate/overlap/no-match national mapping validation and cross-catalog option rejection.
- Threshold parameter parsing and exact boundary behavior.
- German § 28 classification matrices, AWU/financial predicates, verified aggregation modes, negligible/remuneration assertions, and unknown paths.
- German § 59/§ 60/NIS2 Article 26 jurisdiction routing, including entity-specific allowed bases and authority-only states.
- BSIG § 66 / BSI-KritisV § 12 effective-state declaration validation and critical-installation regime pinning.
- Deterministic rule compilation and hash stability.
- Publisher rejection cases and full transaction rollback.
- Golden fixtures for every Annex/size combination, special category, multiple activity, uncertainty, Germany path, unsupported country, and indirect advisory.
- Active release activation/rollback behavior.
- Assessment and guest release pinning, including an activation occurring mid-session.
- Visible-required validation and exclusive multi-choice options.
- Country-before-entity option filtering, stale catalog-answer clearing, and identical server enforcement.
- Relational answer selection persistence and loading.
- Organization fact supersession/provenance transaction behavior.
- Language-neutral result evidence and projection consistency.
- National identity, mapping, classification, aggregation, jurisdiction, legal-provision, and effective-regime provenance in language-neutral evidence.
- Guest started/submitted/claimed/expired lifecycle and cleanup eligibility.
- Guest/auth result parity.
- Historical German/English rendering after supersession.

### Required commands before database cutover

```powershell
npm.cmd exec tsc -- --noEmit
npm.cmd exec vitest -- run
npm.cmd run lint
npm.cmd run build
git diff --check
```

### Database and security verification

- Clear, push, manually apply SQL Editor files, publish, and activate in the documented order.
- Run persisted guest and authenticated smoke submissions for essential, important, not-directly-in-scope, and clarification-required outcomes.
- Activate a test successor release and prove old sessions/results remain pinned.
- Test publisher refusal against an existing version.
- Verify all expected tables have RLS enabled and browser-role privileges revoked.
- Smoke-test login, organization access, questionnaire load, submission, result display, guest claim, and fact reuse through server APIs.
- Run the guest cleanup function against controlled expired fixtures and prove active/unexpired rows remain.

## Risks and mitigations

### Large coordinated schema change

Risk: service and schema changes can temporarily diverge.

Mitigation: implement in phases on one branch, keep narrow tests passing at each phase, and perform one approved development cutover only after typecheck, tests, lint, and build pass.

### RLS lockout

Risk: forcing RLS or revoking the wrong role could break the server database connection.

Mitigation: SQL Editor preflight the server role, do not use `FORCE ROW LEVEL SECURITY` without verified bypass behavior, apply definition and operational scripts separately, and run API smoke tests after each script.

### Translation join/query cost

Risk: normalized localized content introduces joins.

Mitigation: index content revision and locale keys, load an immutable release in bounded queries, and cache by aggregate content hash. Do not denormalize mutable translations back into domain metadata.

### Authoring/published-data divergence

Risk: repository definitions and database rows could differ.

Mitigation: deterministic hashes, immutable publication, transactional inserts, compiled artifact validation, and a command that can verify a published release against its repository source without modifying it.

### Evaluator reproducibility

Risk: code deployments could change historical semantics.

Mitigation: immutable evaluator identifiers, retained old implementations, release golden fixtures, language-neutral result snapshots, and no automatic historical re-evaluation.

### Legal-content accuracy

Risk: normalized incorrect definitions remain incorrect.

Mitigation: use official primary legal sources, require entity-specific descriptions and provision links, review content changes separately from mechanical schema work, and preserve `clarification_required` for unresolved national questions.

### National catalog drift

Risk: German selectable identities, statutory rows, EU mappings, and question options could drift apart or imply false equivalence.

Mitigation: keep stable national identities relational, preserve shared statutory provisions, require explicit mapping relationship kinds, validate full statutory/application coverage, and test catalog filtering through the same module interface used by runtime callers.

### Time-sensitive German legal state

Risk: the BSIG § 66 / BSI-KritisV § 12 transition or a required authority order can change after source review.

Mitigation: pin reviewed effective-state declarations and official sources in the profile, fail publication/activation closed when required declarations are absent or expired, retain the old release for historical results, and publish a new profile/release rather than editing one.

### Guest-table growth

Risk: creating sessions at questionnaire load increases abandoned rows.

Mitigation: minimal guest payloads, indexed status/expiry fields, 24-hour abandonment TTL, 14-day submitted TTL, and daily physical cleanup.

## Rollback strategy

### Before activation

- A failed publication transaction leaves no partial release.
- A published but inactive release has no user impact and may remain retained for audit or be retired if publication policy permits; it is never edited into a different release.

### After activation

- Atomically restore the previous aggregate release in the active pointer.
- Mark the bad release retired/superseded for new assessments.
- Preserve assessments already pinned to it and display a warning/outdated state.
- Publish a separate corrected release and direct affected users to reassess.

### Development cutover rollback

- Because current app data is explicitly disposable, return to the previous code revision, run the guarded `db:clear`, apply the previous Drizzle schema with `db:push`, and use the previous seed workflow if the coordinated cutover must be abandoned.
- Use the SQL runbook’s explicit rollback statements to remove cron jobs/policies and restore only the required server privileges.
- Never use `db:reset` as part of rollback.

## Assumptions

- The current database contains no production assessment data that must survive this refactor.
- Browser clients do not require direct PostgREST table access.
- The server database connection uses a role that can operate after browser privileges are revoked; this must be verified before applying RLS SQL.
- German and English remain the required locales for the first release.
- Germany remains the only fully supported national profile in the first immutable release.
- The existing four NIS2 outcome categories and 12-question user flow remain product requirements.
- Official-source research and legal-content review are available during implementation.
- Users may assert evidence-backed legal statuses such as verified aggregation method, NACE/REACH qualification, formal critical-installation status, and authority decisions; when they cannot, the corresponding fact is `unknown` and the evaluator fails closed.
- “Fully supported German profile” means every German catalog and rule path is represented and evaluated deterministically when its decisive facts are known. It does not mean every German submission can avoid `clarification_required`.

## Unresolved decisions

None. The user selected the full German-model expansion and explicitly approved this revised document on 2026-07-16.

## Approval gate

Approved on 2026-07-16. Implementation must follow the phases above and report any required scope change before proceeding.
