> Status update (2026-07-17): this historical design is now implemented and
> refined by two approved plans. The NIS2 applicability portion uses the
> immutable compliance-release architecture in
> `docs/plans/immutable-compliance-release-architecture.md`; Gap-Analyse,
> document evidence, Maßnahmenplan, AI runs, review, staleness, and audit use
> `docs/plans/gap-analysis-evidence-and-action-plan.md`. The implemented design
> deliberately supersedes the illustrative SQL sketches below where they differ:
> requirements and releases are immutable sibling aggregates, document analysis
> is evidence inside Gap-Analyse, findings and citations are normalized, and
> action plans pin an approved gap artifact revision. The schema source of truth
> is `src/db/schema.ts`.

Yes — you need a **flexible, versioned questionnaire/compliance engine**, not a fixed schema like `betroffenheitscheck_question_1`, `question_2`, etc.

The cleanest architecture is:

```text
Organization
  └── Memberships

Compliance Framework
  └── Framework Version, e.g. NIS2-2026-v1
        └── Modules
              ├── Betroffenheitscheck Questionnaire
              ├── Gap-Analyse Questionnaire
              ├── Maßnahmenplan Artifact
              └── Dokumentenanalyse Artifact

Assessment Instance
  └── Assessment Revisions
        └── Answers

Generated Artifact
  └── Artifact Revisions
        └── Depends on specific assessment/artifact revisions
```

The key idea: **answers are versioned**, **questions are versioned**, and **generated outputs depend on exact input revisions**.

---

## 1. Do not store organization info only as fixed columns

For `organizations`, keep only stable identity information:

```sql
organizations
- id
- name
- legal_name
- country
- created_at
- updated_at
```

Do **not** put everything from the Betroffenheitscheck directly here.

Bad long-term approach:

```sql
organizations
- employee_count
- revenue
- balance_sheet_total
- industry
- provides_critical_services
- provides_it_services
- handles_sensitive_data
- ...
```

That becomes painful when:

* NIS-2 changes
* you add DORA, ISO 27001, GDPR, KRITIS, etc.
* questions change
* one answer maps to multiple compliance facts
* users revert to older answers

Instead, use a separate **organization facts** layer.

---

## 2. Recommended model for organization facts

Implementation status: the foundation tables `organization_fact_definitions`
and `organization_fact_values` are implemented in `src/db/schema.ts`. Seed data
currently covers reusable fact definitions only; organization-specific values
are written later from assessment revisions.

Use stable semantic facts like:

```text
employee_count_bucket
annual_revenue_bucket
balance_sheet_total_bucket
eu_activity
jurisdiction_country
jurisdiction_basis
nis2_entity_types
member_state_designation
sme_figures_verified
sector_specific_regime
serves_critical_customers
has_customer_security_evidence_requests
```

These are not “question 1”, “question 2”, etc. They are reusable compliance facts.

```sql
CREATE TABLE organization_fact_definitions (
    key text PRIMARY KEY,
    label text NOT NULL,
    data_type text NOT NULL, -- text, number, boolean, enum, json
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_fact_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    fact_key text NOT NULL REFERENCES organization_fact_definitions(key),

    value jsonb NOT NULL,

    source_type text NOT NULL,
    source_revision_id uuid NOT NULL,

    confidence numeric(5,4),
    is_current boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_fact_current
ON organization_fact_values (organization_id, fact_key)
WHERE is_current = true;

CREATE INDEX idx_org_fact_value_gin
ON organization_fact_values USING gin (value);
```

Example:

```json
{
  "fact_key": "employee_count_bucket",
  "value": "50_249",
  "source_type": "assessment_revision",
  "source_revision_id": "..."
}
```

This gives you flexibility while still making queries possible.

For very frequent queries, you can add a denormalized read model later:

```sql
organization_compliance_profile_current
- organization_id
- facts jsonb
- employee_count_bucket text
- jurisdiction_country text
- annual_revenue_bucket text
- affectedness_outcome text
- current_betroffenheitscheck_revision_id
- current_gap_analysis_revision_id
- current_action_plan_revision_id
```

That table is **not the source of truth**. It is a cache/read model.

---

## 3. Core organization and membership tables

```sql
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    legal_name text,
    country text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    user_id uuid NOT NULL REFERENCES users(id),

    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'auditor')),
    status text NOT NULL DEFAULT 'active',

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (organization_id, user_id)
);
```

---

## 4. Compliance frameworks and versions

Implementation status: the foundation tables `compliance_frameworks`,
`compliance_framework_versions`, and `compliance_modules` are implemented in
`src/db/schema.ts`. Display metadata is authored bilingually in release
definitions and pinned to immutable content revisions.

This is what makes NIS-2 changes and additional compliance checks manageable.

```sql
CREATE TABLE compliance_frameworks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE, -- nis2, dora, iso27001, gdpr
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE compliance_framework_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id uuid NOT NULL REFERENCES compliance_frameworks(id),

    version_label text NOT NULL, -- e.g. "2026-v1"
    name_content_revision_id uuid NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
    description_content_revision_id uuid NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),

    effective_from date,
    effective_to date,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (framework_id, version_label)
);

CREATE TABLE compliance_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_version_id uuid NOT NULL REFERENCES compliance_framework_versions(id),

    code text NOT NULL, -- betroffenheitscheck, gap_analysis, action_plan, document_analysis
    name_content_revision_id uuid NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
    module_type text NOT NULL CHECK (
        module_type IN ('questionnaire', 'generated_artifact', 'document_analysis')
    ),

    position int NOT NULL DEFAULT 0,

    UNIQUE (framework_version_id, code)
);
```

So later you can have:

```text
NIS2
  2026-v1
    betroffenheitscheck
    gap_analysis
    action_plan
    document_analysis

DORA
  2026-v1
    scope_check
    gap_analysis
    action_plan

ISO27001
  2026-v1
    readiness_check
    control_gap_analysis
    action_plan
```

---

## 5. Versioned questionnaires

Implementation status: the questionnaire-definition foundation is implemented
in `src/db/schema.ts` with `questionnaires` and `questionnaire_versions`.
Release publishers create the stable questionnaire identity and pin its
localized title on the immutable questionnaire version.

You want to seed different questions. So questionnaires need versions.

```sql
CREATE TABLE questionnaires (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id uuid NOT NULL REFERENCES compliance_modules(id),

    code text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (module_id, code)
);

CREATE TABLE questionnaire_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),

    version_label text NOT NULL,
    title_content_revision_id uuid NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),

    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,

    UNIQUE (questionnaire_id, version_label)
);
```

Once a questionnaire version is published, do **not** mutate it. If you change questions, create a new version.

Gap requirement sets follow the same split: `gap_requirement_sets` retains only
stable `code` identity, while `gap_requirement_set_versions` requires a
`title_content_revision_id` referencing `content_revisions(id)` with
`ON DELETE RESTRICT`.

---

## 6. Flexible question model

Implementation status: `questions` and `question_options` are implemented in
`src/db/schema.ts`. The current seed creates twelve required `single_choice`
Betroffenheitscheck questions. Question text is stored in German by default,
English translations live in `questions.config.translations.en`, and option
translations live in `question_options.metadata.translations.en`. The
questionnaire preview renders options as buttons by default and as a combobox
when `config.ui.control` is `select` or the option list is long.

```sql
CREATE TABLE questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_version_id uuid NOT NULL REFERENCES questionnaire_versions(id),

    stable_key text NOT NULL,
    position int NOT NULL,

    question_text text NOT NULL,
    help_text text,

    answer_type text NOT NULL CHECK (
        answer_type IN (
            'single_choice',
            'multi_choice',
            'text',
            'long_text',
            'number',
            'boolean',
            'date',
            'file',
            'json'
        )
    ),

    required boolean NOT NULL DEFAULT false,

    -- For conditional questions, validations, UI hints, etc.
    config jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (questionnaire_version_id, stable_key)
);
```

Example `stable_key`s:

```text
bc.eu_activity
bc.entity_types
bc.jurisdiction_country
bc.jurisdiction_basis
bc.member_state_designation
bc.employee_count
bc.annual_revenue
bc.balance_sheet_total
bc.sme_figures_verified
bc.sector_specific_regime
bc.critical_customers
bc.security_evidence_requested
```

For options:

```sql
CREATE TABLE question_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES questions(id),

    stable_value text NOT NULL, -- yes, no, unsure, under_50, 50_249, 250_plus
    label text NOT NULL,
    position int NOT NULL,

    metadata jsonb NOT NULL DEFAULT '{}',

    UNIQUE (question_id, stable_value)
);
```

Important: store answers using `stable_value`, not the German label. Labels can change; stable values should not.

Example:

```text
label: "50–249"
stable_value: "50_249"
```

---

## 7. Mapping questions to organization facts

Implementation status: `question_fact_mappings` is implemented in
`src/db/schema.ts`. The current Betroffenheitscheck seed maps each question to
one stable organization fact with an identity transform. The mapping layer is
definition-only for now; `organization_fact_values` are still skipped by the
seed until persisted assessment revisions exist.

This solves your “how do I save company size / industry / etc.” problem.

```sql
CREATE TABLE question_fact_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES questions(id),

    fact_key text NOT NULL REFERENCES organization_fact_definitions(key),

    -- Optional transformation rule
    transform jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (question_id, fact_key)
);
```

Example:

```text
Question: bc.employee_count
maps to fact: employee_count_bucket

Question: bc.entity_types
maps to fact: nis2_entity_types

Question: bc.jurisdiction_country
maps to fact: jurisdiction_country
```

This way, your Betroffenheitscheck can change wording or answer options, but your internal semantic facts remain stable.

---

## 8. Versioned assessments and answers

Implementation status: assessment instances, assessment revisions, and answers
are implemented in `src/db/schema.ts`. The org-scoped Betroffenheitscheck flow
creates one active assessment per organization/module and stores later
submissions as new assessment revisions with answer snapshots.

A user does not just “fill out a Betroffenheitscheck”. They create an **assessment instance** with multiple revisions.

```sql
CREATE TABLE assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL REFERENCES organizations(id),
    module_id uuid NOT NULL REFERENCES compliance_modules(id),
    questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),

    current_revision_id uuid,

    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),

    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
```

Each submitted/draft version:

```sql
CREATE TABLE assessment_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    assessment_id uuid NOT NULL REFERENCES assessments(id),
    questionnaire_version_id uuid NOT NULL REFERENCES questionnaire_versions(id),

    revision_number int NOT NULL,

    parent_revision_id uuid REFERENCES assessment_revisions(id),
    reverted_from_revision_id uuid REFERENCES assessment_revisions(id),

    status text NOT NULL CHECK (
        status IN ('draft', 'submitted', 'superseded', 'archived')
    ),

    change_reason text,

    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,

    UNIQUE (assessment_id, revision_number)
);

ALTER TABLE assessments
ADD CONSTRAINT fk_assessments_current_revision
FOREIGN KEY (current_revision_id)
REFERENCES assessment_revisions(id);
```

Answers:

```sql
CREATE TABLE assessment_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    assessment_revision_id uuid NOT NULL REFERENCES assessment_revisions(id),
    question_id uuid NOT NULL REFERENCES questions(id),

    -- duplicate stable key for easier querying/debugging
    question_stable_key text NOT NULL,

    -- single value, array, text, number, etc.
    answer_value jsonb NOT NULL,

    -- optional human-readable text snapshot
    answer_label text,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (assessment_revision_id, question_id)
);

CREATE INDEX idx_answers_revision
ON assessment_answers (assessment_revision_id);

CREATE INDEX idx_answers_stable_key
ON assessment_answers (question_stable_key);

CREATE INDEX idx_answers_value_gin
ON assessment_answers USING gin (answer_value);
```

Example answer:

```json
{
  "question_stable_key": "bc.employee_count",
  "answer_value": "50_249",
  "answer_label": "50–249"
}
```

For multi-choice:

```json
{
  "answer_value": ["cloud_provider", "software_provider", "hosting"]
}
```

For free text:

```json
{
  "answer_value": {
    "text": "Wir haben bereits ein ISMS nach ISO 27001 begonnen..."
  }
}
```

Do **not** store the Betroffenheitscheck outcome in `assessment_answers`.
Answers are user-provided input. The outcome is a derived, reproducible result
and belongs in a generated artifact revision that points back to this exact
assessment revision.

---

## 9. Betroffenheitscheck outcome

Implementation status: `rule_sets`, `generated_artifacts`,
`generated_artifact_revisions`, and `artifact_revision_sources` are implemented
in `src/db/schema.ts`. `scripts/seed-compliance-foundation.ts` seeds the
published `affectedness_check` rule set, and runtime calculation loads that
rule JSON from the database before storing the generated outcome revision.

The deterministic NIS2 scope checker has four fixed outcomes:

```text
essential_entity
important_entity
not_directly_in_scope
clarification_required
```

Calculate this outcome with deterministic backend rules, not AI. The result
should be reproducible, auditable, testable, legally defensible, and tied to a
specific rule-set version. AI can still help explain or summarize the result,
but the actual `outcome` value should come from system logic.

Do not store this as just a column on `organizations`, and do not write it back
as a questionnaire answer. Store it as a generated result depending on a
specific assessment revision and rule set.

Rule sets should be versioned under the module they belong to. Since modules
are meaningful domain concepts, this keeps questionnaires, rules, and generated
artifacts grouped around the same workflow:

```sql
CREATE TABLE rule_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    module_id uuid NOT NULL REFERENCES compliance_modules(id),

    code text NOT NULL, -- e.g. affectedness_check
    version_label text NOT NULL, -- e.g. 2026-v1

    status text NOT NULL CHECK (
        status IN ('draft', 'published', 'archived')
    ),

    rules jsonb NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,

    UNIQUE (module_id, code, version_label)
);
```

Conceptually:

```text
compliance_framework_versions
  -> compliance_modules
      -> questionnaires
      -> rule_sets
      -> generated_artifacts
```

You can use a generic artifact table:

```sql
CREATE TABLE generated_artifacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL REFERENCES organizations(id),
    module_id uuid NOT NULL REFERENCES compliance_modules(id),

    artifact_type text NOT NULL CHECK (
        artifact_type IN (
            'affectedness_result',
            'gap_analysis_result',
            'action_plan',
            'document_analysis'
        )
    ),

    current_revision_id uuid,

    created_at timestamptz NOT NULL DEFAULT now()
);
```

Artifact revisions:

```sql
CREATE TABLE generated_artifact_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    artifact_id uuid NOT NULL REFERENCES generated_artifacts(id),

    revision_number int NOT NULL,
    parent_revision_id uuid REFERENCES generated_artifact_revisions(id),
    reverted_from_revision_id uuid REFERENCES generated_artifact_revisions(id),

    status text NOT NULL CHECK (
        status IN ('draft', 'generated', 'reviewed', 'approved', 'superseded', 'archived')
    ),

    result jsonb NOT NULL,

    model_name text,
    prompt_version text,
    rule_set_id uuid REFERENCES rule_sets(id),
    input_hash text,

    generated_by text NOT NULL DEFAULT 'system'
        CHECK (generated_by IN ('system', 'ai', 'user')),

    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (artifact_id, revision_number)
);

ALTER TABLE generated_artifacts
ADD CONSTRAINT fk_artifacts_current_revision
FOREIGN KEY (current_revision_id)
REFERENCES generated_artifact_revisions(id);
```

For the Betroffenheitscheck, `generated_by` should be `system`,
`rule_set_id` should point to the affectedness rule set, and AI-specific fields
such as `model_name` and `prompt_version` should remain `NULL` unless an
optional AI explanation was generated as part of the stored result.

Dependencies:

```sql
CREATE TABLE artifact_revision_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    artifact_revision_id uuid NOT NULL REFERENCES generated_artifact_revisions(id),

    source_type text NOT NULL CHECK (
        source_type IN (
            'assessment_revision',
            'artifact_revision',
            'document_version',
            'organization_fact_snapshot'
        )
    ),

    source_id uuid NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now()
);
```

Example Betroffenheitscheck result:

```json
{
  "schemaVersion": 2,
  "outcome": "important_entity",
  "label": "Wichtige Einrichtung",
  "reasons": [
    "Managed Service Provider fällt in Anhang I und erreicht die maßgebliche Unternehmensgröße."
  ],
  "sizeClassification": "medium",
  "matchedEntityTypes": [
    {
      "code": "managed_service_provider",
      "annex": 1
    }
  ],
  "unresolvedFacts": []
}
```

Recommended submission flow:

```text
1. Create a new assessment_revision.
2. Store all questionnaire answers in assessment_answers.
3. Extract/update organization_fact_values from question_fact_mappings.
4. Run the published affectedness rule set in backend application code.
5. Create a generated_artifact_revision with the affectedness result.
6. Link the artifact revision to the assessment revision in artifact_revision_sources.
7. Mark the artifact revision as current on generated_artifacts.
```

This lets you audit a result later as:

```text
NIS2 framework version 2026-v1
+ module Betroffenheitscheck
+ questionnaire version 2026-v1
+ assessment revision 3
+ rule set affectedness_check 2026-v1
= affectedness result revision 3
```

---

## 10. Gap-Analyse structure

For Gap-Analyse, I would store both:

1. the raw questionnaire revision
2. structured gap findings generated by AI

You can keep the overall result in `generated_artifact_revisions.result`, but serious products usually also want normalized findings:

```sql
CREATE TABLE compliance_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    framework_version_id uuid NOT NULL REFERENCES compliance_framework_versions(id),

    code text NOT NULL, -- e.g. "NIS2-RM-001"
    title text NOT NULL,
    description text,

    category text,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (framework_version_id, code)
);
```

Gap findings:

```sql
CREATE TABLE gap_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    artifact_revision_id uuid NOT NULL REFERENCES generated_artifact_revisions(id),
    requirement_id uuid REFERENCES compliance_requirements(id),

    title text NOT NULL,
    description text NOT NULL,

    severity text NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),

    status text NOT NULL CHECK (
        status IN ('open', 'partially_addressed', 'closed', 'not_applicable')
    ),

    evidence text,
    recommendation text,

    source_refs jsonb NOT NULL DEFAULT '[]',

    created_at timestamptz NOT NULL DEFAULT now()
);
```

Example `source_refs`:

```json
[
  {
    "type": "answer",
    "assessment_revision_id": "...",
    "question_stable_key": "ga.incident_response_process"
  },
  {
    "type": "document_analysis",
    "artifact_revision_id": "..."
  }
]
```

---

## 11. Maßnahmenplan structure

A Maßnahmenplan should not only be one blob of AI text. Store action items separately so the user can track progress.

```sql
CREATE TABLE action_plan_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    artifact_revision_id uuid NOT NULL REFERENCES generated_artifact_revisions(id),
    gap_finding_id uuid REFERENCES gap_findings(id),

    title text NOT NULL,
    description text,

    priority text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    effort text CHECK (effort IN ('small', 'medium', 'large')),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'done', 'dismissed')),

    owner_user_id uuid REFERENCES users(id),

    due_date date,

    created_at timestamptz NOT NULL DEFAULT now()
);
```

The full generated plan can still live in:

```sql
generated_artifact_revisions.result
```

Example:

```json
{
  "summary": "Die Organisation sollte zuerst Incident Response, Asset Management und Lieferantenkontrolle verbessern.",
  "assumptions": [
    "Unternehmen ist möglicherweise von NIS-2 betroffen",
    "IT-Dienstleistungen werden für kritische Kunden erbracht"
  ]
}
```

---

## 12. Dokumentenanalyse

Even if Dokumentenanalyse is not its own page, it should be its own data concept.

```sql
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL REFERENCES organizations(id),

    title text NOT NULL,
    document_type text,

    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id uuid NOT NULL REFERENCES documents(id),

    version_number int NOT NULL,

    file_name text,
    file_mime_type text,
    file_size_bytes bigint,

    storage_url text,
    content_hash text,

    extracted_text text,

    uploaded_by uuid REFERENCES users(id),
    uploaded_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (document_id, version_number)
);
```

Then document analysis becomes a generated artifact revision with sources:

```text
document_version
+ betroffenheitscheck revision
+ gap analysis revision
+ maßnahmenplan revision
```

That means you can later say:

```text
This document was evaluated against:
- Betroffenheitscheck revision 3
- Gap-Analyse revision 5
- Maßnahmenplan revision 2
- Document version 1
```

That is exactly what you want for auditing.

---

## 13. Recalculation logic

When the user changes the Betroffenheitscheck:

```text
Betroffenheitscheck revision 1
  ↓
Gap-Analyse revision 1
  ↓
Maßnahmenplan revision 1
  ↓
Dokumentenanalyse revision 1
```

Then they edit the Betroffenheitscheck:

```text
Betroffenheitscheck revision 2
  ↓ stale
Gap-Analyse revision 1
Maßnahmenplan revision 1
Dokumentenanalyse revision 1
```

You can detect stale artifacts by comparing their stored source revisions to the current source revisions.

For example, `artifact_revision_sources` says the current Maßnahmenplan was based on:

```text
Betroffenheitscheck revision 1
Gap-Analyse revision 1
```

But the current Betroffenheitscheck is now revision 2. So the Maßnahmenplan is stale and should be regenerated.

You can either store this dynamically or persist it:

```sql
ALTER TABLE generated_artifacts
ADD COLUMN is_stale boolean NOT NULL DEFAULT false;
```

I would usually calculate staleness from dependencies, and optionally cache it.

---

## 14. Audit log

For compliance software, add an audit event table.

```sql
CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid REFERENCES organizations(id),
    actor_user_id uuid REFERENCES users(id),

    event_type text NOT NULL,

    entity_type text NOT NULL,
    entity_id uuid NOT NULL,

    metadata jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now()
);
```

Examples:

```text
assessment_revision.submitted
assessment_revision.reverted
gap_analysis.generated
action_plan.approved
document.uploaded
document_analysis.generated
organization_fact.updated
```

---

## 15. How to handle reverting

Do **not** delete newer versions.

When a user reverts, create a new revision copied from the old one:

```text
Revision 1
Revision 2
Revision 3
Revision 4 = revert to Revision 1
```

Then:

```text
assessment.current_revision_id = Revision 4
Revision 4.reverted_from_revision_id = Revision 1
```

This preserves the full timeline.

---

## 16. Recommended minimal schema overview

The main tables I would start with are:

```text
users
organizations
organization_memberships

compliance_frameworks
compliance_framework_versions
compliance_modules
rule_sets

questionnaires
questionnaire_versions
questions
question_options
question_fact_mappings

assessments
assessment_revisions
assessment_answers

organization_fact_definitions
organization_fact_values

generated_artifacts
generated_artifact_revisions
artifact_revision_sources

compliance_requirements
gap_findings
action_plan_items

documents
document_versions

audit_events
```

Current implementation status:

```text
Implemented:
organizations
organization_memberships
organization_invitations
compliance_frameworks
compliance_framework_versions
compliance_modules
questionnaires
questionnaire_versions
questions
question_options
question_fact_mappings
organization_fact_definitions
organization_fact_values
assessments
assessment_revisions
assessment_answers
rule_sets
generated_artifacts
generated_artifact_revisions
artifact_revision_sources

Planned:
compliance_requirements
gap_findings
action_plan_items
documents
document_versions
audit_events
```

This is flexible enough for:

```text
NIS-2
DORA
KRITIS
ISO 27001
GDPR
custom internal checks
future questionnaire changes
AI-generated results
manual edits
reverts
auditing
```

---

## 17. What I would hardcode vs. not hardcode

Hardcode these as stable semantic concepts:

```text
employee_count_bucket
annual_revenue_bucket
balance_sheet_total_bucket
eu_activity
jurisdiction_country
jurisdiction_basis
nis2_entity_types
member_state_designation
sme_figures_verified
```

Do **not** hardcode:

```text
question_1_answer
question_2_answer
nis2_betroffenheitscheck_q7
```

Questions are UI/input structure.

Facts are business/compliance meaning.

---

## 18. Practical recommendation

Use this pattern:

```text
Source of truth:
  assessment_revisions
  assessment_answers
  generated_artifact_revisions
  artifact_revision_sources

Derived semantic layer:
  organization_fact_values

Fast read/cache layer:
  organization_compliance_profile_current
```

So you get:

* flexibility from JSON/question engine
* auditability from immutable revisions
* performance from current profile/cache tables
* extensibility for future frameworks
* clean recalculation because every AI result knows its exact inputs

For your case, I would **not** make separate hardcoded tables like `betroffenheitscheck_answers`, `gap_analysis_answers`, `massnahmenplan_versions`. I would make one generic versioned assessment/artifact system and distinguish modules with `module.code` and `artifact_type`.
