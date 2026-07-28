# Gap Analysis guided-v4 questionnaire and deterministic category findings

Status: proposed implementation plan; product and architecture decisions
confirmed on 2026-07-25.

Source questionnaire:
[`../product/1. Gap-Analyse-Fragebogen.xlsx - Gap-Analyse.csv`](../../product/1.%20Gap-Analyse-Fragebogen.xlsx%20-%20Gap-Analyse.csv)

## Outcome

Replace the four-question Gap Analysis demo questionnaire with a production-
shaped, immutable `nis2-gap/guided-v4` release containing the 31 questions from
the source CSV.

The questionnaire is presented as ten category pages and produces exactly ten
Gap Findings, one per category. Finding status is derived deterministically
from the submitted answers. The AI model explains the fixed status, assesses
evidence sufficiency, recommends remediation, and surfaces contradictions; it
does not choose or change the status.

The release is bilingual, uses exact versioned legal-provision relationships,
supports autosaved shared questionnaire drafts with optimistic concurrency,
and retains the existing manual correction and Action Plan lifecycle.

## Agreed product decisions

- Publish a new immutable `nis2-gap/guided-v4` release. Do not modify the
  already-authored `guided-v3` contract.
- Treat the development database as disposable. No questionnaire, assessment,
  result, or Action Plan migration is required for this cutover.
- Update and reuse the existing database clear, legal-corpus seed, compliance
  publication, and Gap publication scripts. Keep their current package-script
  entry points usable; do not introduce a separate one-off guided-v4 reseed
  path.
- During implementation, clear and fully reseed the configured disposable
  development database with the new legal corpus, compliance modules, and Gap
  Analysis release. This destructive development reset is already authorized
  and must not pause for another user verification or acceptance checkpoint.
- Automated integrity, test, and smoke checks remain implementation gates. They
  are run and resolved by the implementer and do not require user sign-off.
- Use all 31 CSV rows as required single-choice questions.
- Present one of the ten categories at a time inside the existing outer
  `Questions -> Documents -> Review -> Results` workflow.
- Use the following five answer values:

  | Stable value | German | English |
  | --- | --- | --- |
  | `fully_implemented` | Vollständig umgesetzt | Fully implemented |
  | `partially_implemented` | Teilweise umgesetzt | Partially implemented |
  | `not_implemented` | Nicht umgesetzt | Not implemented |
  | `unsure` | Unsicher | Unsure |
  | `not_applicable` | Nicht relevant | Not applicable |

- Do not require a justification for `not_applicable`.
- Require every question to have an answer before the user can continue to
  document selection.
- Store unfinished answers in one shared server-side questionnaire draft per
  assessment.
- Protect shared draft updates with optimistic concurrency. A stale browser
  must not overwrite a newer answer silently.
- Produce ten findings, one for each CSV category.
- Use the same questionnaire, aggregation, and finding definitions for
  `essential_entity` and `important_entity` applicability outcomes.
- Determine each category's criticality from the highest-priority question in
  that category.
- Do not calculate or display points, percentages, a maturity score, or a
  "percent compliant" value.
- Do not expose preliminary category statuses in the questionnaire, document,
  or review steps. The user first sees statuses in the generated Gap Analysis.
- Retain the existing Owner/Admin manual correction flow, mandatory correction
  reason, immutable corrected revision, and audit history.
- Preserve each question's exact BSIG and NIS2 provision relationships in
  normalized relational tables.
- Use official, versioned legal sources and provisions instead of the current
  Gap demo placeholders.
- Author German and English question, help, option, category, and requirement
  text in the repository and publish both through the content dictionary.

## Category and finding catalogue

Each category is represented by one stable Gap requirement version. Questions
map to the category requirement relationally; category membership is not
inferred from display text.

| Position | Requirement code | Category | Questions | Criticality |
| --- | --- | --- | --- | --- |
| 1 | `NIS2-GOV-01` | Responsibility and organization | 1-3 | high |
| 2 | `NIS2-RISK-02` | Risks and overview | 4-7 | high |
| 3 | `NIS2-IAM-03` | Access and personnel | 8-10 | high |
| 4 | `NIS2-IR-04` | Security incidents and reporting | 11-14 | high |
| 5 | `NIS2-BC-05` | Backups and emergency preparedness | 15-18 | high |
| 6 | `NIS2-SC-06` | Supply chain | 19-21 | high |
| 7 | `NIS2-VM-07` | Secure systems and vulnerabilities | 22-24 | high |
| 8 | `NIS2-ASSURE-08` | Effectiveness review | 25-26 | high |
| 9 | `NIS2-AWARE-09` | Training and cyber hygiene | 27-28 | medium |
| 10 | `NIS2-PROTECT-10` | Encryption, communication, and physical protection | 29-31 | medium |

The codes are stable product identities, not statutory section identifiers.
The exact category titles and requirement wording must be authored in German
and English and reviewed independently of the mechanical schema work.

The requirement text for each category must describe the complete obligation
represented by its questions. It must not merely repeat the category title or
claim that answering the questionnaire proves legal compliance.

## Legal-provision coverage

The source CSV maps each question to one or more provisions. Preserve that
granularity rather than storing only a category-level union.

The expected category-level union is:

| Category | German provisions | EU provisions |
| --- | --- | --- |
| Responsibility and organization | BSIG § 38(1), (3) | NIS2 Art. 20(1), (2) |
| Risks and overview | BSIG § 30(1), (2) nos. 1 and 9 | NIS2 Art. 21(1), (2)(a), (i) |
| Access and personnel | BSIG § 30(2) nos. 9 and 10 | NIS2 Art. 21(2)(i), (j) |
| Security incidents and reporting | BSIG § 30(2) nos. 2 and 6; § 32 | NIS2 Art. 21(2)(b), (f); Art. 23 |
| Backups and emergency preparedness | BSIG § 30(2) nos. 3 and 6 | NIS2 Art. 21(2)(c), (f) |
| Supply chain | BSIG § 30(2) nos. 3 and 4 | NIS2 Art. 21(2)(c), (d), (3) |
| Secure systems and vulnerabilities | BSIG § 30(2) no. 5 | NIS2 Art. 21(2)(e) |
| Effectiveness review | BSIG § 30(1), (2) no. 6 | NIS2 Art. 21(2)(f), (4) |
| Training and cyber hygiene | BSIG § 30(2) no. 7 | NIS2 Art. 21(2)(g) |
| Encryption, communication, and physical protection | BSIG § 30(1), (2) nos. 8 and 10 | NIS2 Art. 21(1), (2)(h), (j) |

The CSV is an authoring source, not legal sign-off. Before publication, a
reviewer must compare every question/provision pair with the exact official
BSIG and NIS2 text and record the reviewed source versions. The product
disclaimer remains: the result is guidance and not a legally binding
compliance certificate.

## Immutable legal catalogue dependency

The current `nis2/2026-v1` compliance release publishes applicability
provisions but does not contain the required BSIG §§ 30, 32, and 38 or NIS2
Articles 20, 21, and 23.

Do not mutate `2026-v1`. Add a new immutable compliance release, provisionally
`nis2/2026-v2`, that:

1. retains the current 12-question applicability flow and deterministic
   applicability behavior;
2. retains the current entity identities, national mappings, thresholds, and
   outcome codes unless an independent legal review requires a change;
3. extends the legal instrument catalogue with every exact provision needed by
   the 31 Gap questions;
4. publishes bilingual citation labels and official source URLs for those
   provisions; and
5. pins the same reviewed primary-law corpus families, or newer reviewed corpus
   releases if required by the legal-source review.

`guided-v4.compatibleCheck.versionLabel` then points to `2026-v2`. This makes
the legal-provision IDs resolvable during Gap publication without changing the
meaning or hash of an already-published compliance release.

Register `nis2/2026-v2` and `nis2-gap/guided-v4` in their respective repository
release registries. Remove older Gap releases from the publishable registry
after the disposable cutover if they are no longer needed operationally; old
definition files may remain as explicit test fixtures, but they must not be
silently republished under changed content.

## Target data model

### Requirement-to-question mapping

Replace the `questionStableKeys` array currently stored inside
`gap_analysis_release_applicability_rules.conditions` with a relational
mapping:

```text
gap_requirement_question_mappings
  gap_analysis_release_id uuid not null
  requirement_version_id uuid not null
  question_id uuid not null
  position integer not null
```

Constraints:

- primary key `(gap_analysis_release_id, requirement_version_id, question_id)`;
- unique `(gap_analysis_release_id, question_id)` so every guided-v4 question
  maps to exactly one finding category;
- unique `(gap_analysis_release_id, requirement_version_id, position)`;
- restrictive foreign keys to the release, requirement version, and question;
- positive position check;
- an integrity trigger or publication-time verification that the requirement
  belongs to the release's requirement set and the question belongs to the
  release's questionnaire version.

Keep `applicabilityOutcomeCodes` in the release applicability rule for now.
The loader obtains question membership from the new mapping table, never from
the legacy JSON field.

### Question-to-provision mapping

Add:

```text
gap_question_legal_provisions
  question_id uuid not null
  legal_provision_id uuid not null
  position integer not null
```

Constraints:

- primary key `(question_id, legal_provision_id)`;
- unique `(question_id, position)`;
- restrictive foreign keys to `questions` and `legal_provisions`;
- positive position check.

A requirement's display and prompt-facing legal references are the ordered,
deduplicated union of the provisions mapped to its questions. Resolve labels
from each provision's pinned citation content revision and URLs from
`legal_provisions.official_source_url`.

For the clean development cutover, remove
`gap_requirement_versions.legal_references` after every runtime consumer uses
the relational projection. Do not preserve a second JSON copy.

### Shared questionnaire draft

Add a mutable, server-owned draft separate from immutable submitted assessment
revisions:

```text
gap_questionnaire_drafts
  id uuid primary key
  organization_id uuid not null
  assessment_id uuid not null
  gap_analysis_release_id uuid not null
  questionnaire_version_id uuid not null
  status open | locked | discarded
  version integer not null default 1
  last_submitted_assessment_revision_id uuid null
  created_by uuid not null
  updated_by uuid not null
  created_at timestamptz not null
  updated_at timestamptz not null

gap_questionnaire_draft_answers
  draft_id uuid not null
  question_id uuid not null
  question_option_id uuid not null
  updated_by uuid not null
  updated_at timestamptz not null
```

Constraints:

- one open draft per assessment;
- the draft's organization, assessment, Gap release, and questionnaire version
  must agree;
- primary key `(draft_id, question_id)`;
- a composite foreign key proves the selected option belongs to the question;
- `version > 0`;
- only `open` drafts are mutable;
- `locked` drafts cannot change after generation locks the selected assessment
  revision;
- restrictive ownership foreign keys and server-only RLS consistent with the
  existing Gap tables.

The draft is a collaborative working projection, not immutable audit truth.
Every successful answer mutation increments `version` and updates
`updated_by/updated_at`.

### Deterministic assessment results

Persist the hidden category evaluation created from each submitted
questionnaire revision:

```text
assessment_requirement_evaluations
  assessment_revision_id uuid not null
  requirement_version_id uuid not null
  status gap_finding_status not null
  evaluator_kind text not null
  evaluator_version integer not null
  input_hash text not null
  created_at timestamptz not null
```

Constraints:

- primary key `(assessment_revision_id, requirement_version_id)`;
- restrictive foreign keys to the assessment revision and requirement version;
- exactly ten rows for a valid guided-v4 submission;
- evaluator metadata must match the pinned Gap release;
- evaluation rows are immutable after insertion.

These rows are server-side inputs to generation. Do not add them to the
pre-generation workflow DTO, page source, client state, review screen, or
browser API response.

## Release authoring model

Extend `GapQuestionDefinition` with authored legal provision keys:

```ts
type GapQuestionDefinition = {
  stableKey: string;
  position: number;
  text: LocalizedText;
  help: LocalizedText;
  required: true;
  answerType: "single_choice";
  legalProvisionKeys: string[];
  options: GapQuestionOptionDefinition[];
};
```

Keep requirement-to-question membership in the typed repository definition as
`questionStableKeys`; change only its persistence from JSON to relational
rows. This remains convenient for compilation while the database becomes
queryable and enforceable.

The guided-v4 release must be authored independently rather than spreading and
mutating `guided-v3`. Give every question a descriptive stable key, for
example:

```text
gap.governance.security_owner
gap.governance.management_oversight
gap.governance.management_training
```

Do not use row numbers as stable keys. Use positions `10, 20, ... 310` to
preserve the CSV order while allowing later insertion in a future release.

Treat the TypeScript release definition as the runtime source of truth. Keep
the CSV as a reviewed product-input artifact. Add a focused source-traceability
test that verifies:

- 31 questions exist;
- source numbers 1-31 are represented exactly once;
- the German question and help copy matches the reviewed CSV values;
- all 31 questions have non-empty reviewed English copy;
- every question has exactly the five agreed stable option values;
- every question maps to exactly one category and at least one legal provision.

Do not load or parse the CSV in the production runtime.

## Compiler and publication

### Compiler

Extend `compileGapAnalysisRelease` to reject:

- a question missing German or English text/help;
- an option missing a German or English label;
- an answer option set that differs from the exact guided-v4 five-value
  contract;
- duplicate question positions or stable keys;
- missing or duplicate legal provision keys on a question;
- a question mapped to zero or more than one requirement;
- a requirement with no questions;
- a requirement whose criticality differs from the highest mapped source
  priority;
- missing coverage for either `essential_entity` or `important_entity`;
- a release that does not contain exactly 31 questions and ten requirements
  when its reference is `nis2-gap/guided-v4`.

Compilation remains deterministic and UUID-independent. Include question legal
keys and requirement/question membership in component and aggregate hashes so
changing either mapping requires a new release.

### Publisher

Update `publishGapAnalysisRelease` to:

1. resolve the published compatible compliance release;
2. load its legal instrument versions and provisions into a stable-key-to-ID
   map;
3. reject unknown legal keys before any structural Gap row is committed;
4. publish bilingual module, questionnaire, question, help, option,
   requirement-set, requirement-title, and requirement-text content through
   the existing content dictionary transaction;
5. insert all questions and options;
6. insert ten requirement versions and requirement-set memberships;
7. insert the Gap release;
8. insert 31 requirement/question mappings;
9. insert every question/provision mapping;
10. insert applicability outcome rules without `questionStableKeys`;
11. pin the reviewed corpus releases; and
12. verify exact counts and hashes before committing.

Activation completeness must additionally require:

- exactly 31 questions;
- exactly ten requirements;
- exactly 31 requirement/question mappings;
- every question mapped once;
- every question having at least one legal provision;
- both applicability outcomes covered by every category;
- a supported deterministic evaluator and prompt/response schema; and
- complete legal corpus pins.

## Deterministic category evaluator

Add a pure evaluator keyed by the Gap release's
`evaluatorKind/evaluatorVersion`. Do not infer status from localized labels.
Use only stable option values.

For each category:

1. load the submitted answers for its mapped questions;
2. reject a missing answer, duplicate answer, option/question mismatch, or
   unknown stable value;
3. ignore `not_applicable` while other applicable answers exist;
4. apply this precedence:

```text
any not_implemented
  -> not_fulfilled

else any partially_implemented
  -> partially_fulfilled

else any unsure
  -> insufficient_evidence

else at least one fully_implemented
  -> fulfilled

else (all answers are not_applicable)
  -> insufficient_evidence
```

5. hash the canonical category input: release ID, questionnaire version ID,
   assessment revision ID, requirement version ID, ordered question stable
   keys, and ordered stable answer values;
6. persist one immutable `assessment_requirement_evaluations` row.

Run evaluation in the same transaction that creates the submitted assessment
revision and answer rows. If evaluation cannot produce exactly ten rows, roll
back the submission.

No score, weight, average, percentage, or numeric points field is introduced.

## Questionnaire draft service and API

### Read model

The authorized Gap workflow read returns:

```ts
questionnaireDraft: {
  id: string;
  version: number;
  status: "open";
  answers: Record<questionId, optionId>;
  updatedAt: string;
} | null;
```

It does not return deterministic evaluation rows or preliminary category
statuses.

When an assessment is started, create or open its shared questionnaire draft.
If a new draft is created after a previously submitted questionnaire, seed it
from the latest submitted answers so returning to edit does not clear the
form.

### Autosave mutation

Add an internal endpoint:

```text
PATCH /api/organizations/:organizationId/gap-analysis/questionnaire-draft/answers/:questionId
```

Request:

```json
{
  "draftId": "uuid",
  "optionId": "uuid",
  "expectedVersion": 4
}
```

Require `If-Match` with the same version. The service transaction:

1. authorizes `gap:contribute`;
2. asserts Gap inputs remain mutable;
3. verifies draft, organization, assessment, release, questionnaire, question,
   and option ownership;
4. conditionally increments the draft version;
5. upserts the answer;
6. updates attribution/timestamps; and
7. returns the new draft version and saved answer.

Missing `If-Match` returns 428. A stale version returns 412 with a stable
`GAP_QUESTIONNAIRE_DRAFT_CHANGED` code and the client performs an authoritative
workflow refresh. Do not use last-write-wins.

Debounce browser writes briefly, but flush a pending answer before changing
category, leaving the question step, or submitting. Display localized
`Saving`, `Saved`, and conflict/error states without optimistic success before
the server acknowledges the version.

### Submission mutation

Change the existing questionnaire submission request to snapshot the
server-side draft:

```json
{
  "assessmentId": "uuid",
  "draftId": "uuid",
  "expectedVersion": 31
}
```

The client no longer submits all question/option pairs as authoritative input.
The idempotent server command:

1. locks and validates the current draft/version;
2. requires exactly one valid answer for all 31 release questions;
3. creates the immutable assessment revision and answer rows;
4. computes and persists ten hidden deterministic category evaluations;
5. supersedes the former submitted assessment revision;
6. records `last_submitted_assessment_revision_id` on the draft;
7. updates `assessments.current_revision_id`; and
8. writes the existing questionnaire-submitted audit event with safe counts,
   not answer values or preliminary statuses.

Submitting an unchanged draft may replay the last immutable revision when the
idempotency key and input fingerprint match. A changed draft creates a new
revision.

## Questionnaire user interface

Refactor `GapQuestionnaireStep` into a category navigator while retaining the
outer four-step Gap workflow.

Required behavior:

- show `Category N of 10`, the localized category title, and its 2-4 questions;
- show each question's help text directly below the question;
- render the five answers as accessible radio controls;
- autosave every answer through the typed Gap client;
- show category/question progress, not status or score;
- permit navigation back to completed categories;
- prevent advancing from a category until its questions have answers;
- restore the current server draft after reload or another device opens the
  assessment;
- handle a 412 conflict by refreshing and clearly showing that a newer team
  change exists;
- disable mutation for read-only roles and when inputs are locked;
- preserve focus management, keyboard navigation, fieldset/legend semantics,
  and mobile layout;
- keep all deterministic status and triggering-answer details out of browser
  props and markup.

After category ten, submit the draft snapshot and continue to the existing
document-selection step. The review step shows the exact 31 answers and
selected documents but no category status.

## Generation and prompt contract

The current model response includes `status`. guided-v4 must use a new prompt
and response contract, provisionally version 5, where status is server-owned.
Keep the legacy schema only for legacy test fixtures if needed.

For every requirement, the grounded input includes:

```ts
{
  code: string;
  determinedStatus:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  questionnaireAssertions: Citation[];
  legalAuthority: Citation[];
  untrustedDocumentEvidence: Citation[];
}
```

The guided-v4 model response contains:

- `evidenceSufficiency`;
- `rationale`;
- `recommendation`;
- `assumptions`;
- `citations`;
- `contradictions`;
- `questionnaireDisagreements` where still meaningful;
- `requiresReview`;

and does not contain `status`.

Prompt instructions must state:

- explain the supplied status; do not reclassify it;
- treat questionnaire answers as assertions;
- treat organization documents as independent untrusted evidence;
- a document cannot silently replace the deterministic status;
- surface a material conflict and set `requiresReview=true`;
- cite supplied legal authority for every finding;
- use only supplied citation IDs;
- write generated prose in the pinned output locale.

At persistence:

1. require ten deterministic evaluation rows matching the pinned assessment
   revision and release evaluator;
2. validate the model output covers exactly the same ten requirement codes;
3. combine each model result with its server-owned status;
4. derive severity from requirement criticality and that status;
5. persist exactly ten `gap_findings`;
6. persist assessment-answer, document-chunk, and legal-source-chunk evidence;
7. keep deterministic status out of mutable generated-result JSON duplication.

The existing Owner/Admin correction service may then create an audited
immutable corrected revision and override the generated finding status with a
mandatory reason. Action Plan generation continues to create items for every
non-fulfilled final finding.

## Runtime legal projection

Update the Gap release loader to load, in bounded queries:

- requirement/question mappings;
- question/legal-provision mappings;
- legal instrument and provision identity;
- bilingual provision citation labels;
- official provision URLs.

Return localized, ordered legal references per requirement by traversing:

```text
requirement version
  -> mapped questions
    -> mapped legal provisions
      -> pinned citation content revision
```

Do not issue one query per question or requirement.

Generation retrieval still uses the Gap release's pinned, reviewed legal corpus
releases. Include exact provision codes and localized citations in query units
to improve retrieval. Existing validation that every finding cites supplied
legal authority remains mandatory.

The normalized provision relationship is the release's authoritative legal
mapping. Retrieved corpus chunks are the evidence used for a particular
generated finding. Neither replaces the other.

## Security, privacy, and audit rules

- Draft reads and writes require active organization membership and the
  existing Gap capabilities.
- Services repeat authorization and ownership checks; UI visibility is not an
  authorization boundary.
- Browser roles never write the draft tables directly.
- Do not log answer text, selected options, legal excerpts, prompts, or
  organization document content.
- Draft audit events may contain assessment ID, draft ID, version, actor, and
  answered-count metadata, but not the answer values.
- Submitted answers and deterministic evaluations are immutable.
- Generated and manually corrected result revisions retain their exact source
  assessment revision and release pins.
- No pre-generation API or DTO exposes category evaluation status.
- Use the existing input-mutability and Action Plan lock guards for draft and
  submission mutations.

## Implementation sequence

### Phase 1: Legal catalogue release

1. Fork `nis2/2026-v1` into a new immutable compliance release definition.
2. Add all required BSIG and NIS2 provisions with bilingual citation content
   and official URLs.
3. Prove the applicability questionnaire, evaluator, entity catalogue,
   thresholds, and outcome fixtures remain behaviorally identical.
4. Register, compile, and test `nis2/2026-v2`.

### Phase 2: Relational schema

1. Add requirement/question and question/provision mapping tables.
2. Add shared questionnaire draft and draft-answer tables.
3. Add immutable assessment requirement evaluation rows.
4. Remove the requirement legal-reference JSON column for the disposable
   cutover.
5. Add restrictive foreign keys, uniqueness, checks, indexes, and server-only
   RLS.
6. Extend integrity SQL only where cross-table ownership cannot be expressed
   by a declarative constraint.
7. Generate and review a Drizzle migration according to the repository's
   migration workflow.

### Phase 3: Release types, compiler, and publisher

1. Add question legal keys to repository release types.
2. Add guided-v4 cardinality, bilingual, mapping, option, priority, and legal
   validation.
3. Resolve compatible-release legal keys during publication.
4. Publish normalized mappings transactionally.
5. Extend activation completeness.
6. Update the bounded release loader and hashes.

### Phase 4: guided-v4 content

1. Transcribe all 31 German questions and help texts exactly from the reviewed
   CSV.
2. Author and review the 31 English translations.
3. Author ten bilingual requirement titles and complete requirement texts.
4. Assign descriptive stable question keys and the five agreed option values.
5. Add exact question/category and question/provision mappings.
6. Register guided-v4 without inheriting demo-v1/v2/v3 content.

### Phase 5: Deterministic evaluation

1. Implement the pure stable-value evaluator.
2. Add canonical evaluation input hashing.
3. Persist ten evaluation rows during questionnaire submission.
4. Add completeness and pinned-evaluator guards.
5. Ensure no preliminary status reaches the workflow DTO.

### Phase 6: Draft service and contracts

1. Create/open and seed the shared draft with the assessment.
2. Add the typed draft answer PATCH contract, route, service, and client method.
3. Add If-Match handling and stable conflict errors.
4. Change submission to snapshot a draft version.
5. Add audit events and input-lock integration.

### Phase 7: Category questionnaire UI

1. Build the ten-category navigator.
2. Add autosave state, version updates, and conflict recovery.
3. Add localized progress and validation copy.
4. Update the exact-input review projection to show 31 grouped answers without
   status.
5. Verify read-only and locked behavior.

### Phase 8: Prompt and generation cutover

1. Add prompt/response contract version 5.
2. Remove status from guided-v4 model output.
3. Supply the deterministic status to the prompt for explanation.
4. Combine server status and validated model prose/evidence at persistence.
5. Retain contradiction, review, correction, source, finalization, and Action
   Plan behavior.
6. Extend AI evaluation fixtures to all ten categories.

### Phase 9: Documentation and rollout

1. Update the product workflow, database structure, release publication, and
   reset/bootstrap documents.
2. Edit the existing legal-corpus fixture/operator implementation and its
   current `db:seed:legal-corpus-fixture` entry point to seed the official
   sources required by the new NIS2 and BSIG modules.
3. Register `nis2/2026-v2` and `nis2-gap/guided-v4` in the existing compliance
   and Gap release registries so the current publish and activate scripts remain
   the canonical reseed interface.
4. Update the existing reset/bootstrap runbook and command arguments from
   guided-v3 to guided-v4 and from compliance 2026-v1 to 2026-v2. Do not add a
   parallel seed workflow.
5. Add database verification for all new relational and cardinality
   invariants.
6. Without requesting another approval, use the guarded existing clear command
   to clear the configured disposable development database, apply the schema,
   seed/approve the legal corpus, publish/activate the compliance modules, and
   publish/activate guided-v4.
7. Run automated, database-backed, and implementation smoke checks. Fix
   failures before considering the rollout complete; no separate user
   acceptance step is required.

## Suggested reviewable commits

1. `add NIS2 and BSIG risk-management provisions to 2026-v2`
2. `add normalized Gap questionnaire mapping schema`
3. `publish normalized Gap question and legal mappings`
4. `author the guided-v4 bilingual questionnaire`
5. `add deterministic category evaluation`
6. `add shared questionnaire draft autosave API`
7. `show the Gap questionnaire as ten category pages`
8. `make guided-v4 finding status server-owned`
9. `update existing reseed scripts and guided-v4 rollout documentation`

Each commit should keep typecheck and its focused tests green. Do not combine
the destructive development reset with unverified code changes. The final
implementation step performs the already-authorized reset only after the
preceding automated checks pass.

## Tests

Add or extend coverage for:

### Release and content

- guided-v4 compiles deterministically;
- guided-v4 has exactly 31 questions, ten requirements, and five options per
  question;
- all German CSV question/help copy is represented exactly;
- all English content is non-empty and independently localized;
- stable question keys and positions are unique;
- every question maps to exactly one requirement;
- category criticalities match the agreed values;
- every requirement covers both positive applicability outcomes;
- every question maps to one or more compatible legal provisions;
- unknown legal keys fail publication before commit;
- mapping or translation changes alter the appropriate hashes;
- runtime loading uses bounded queries and returns ordered localized
  categories, questions, and legal references.

### Schema and integrity

- all new columns, keys, checks, and restrictive foreign keys exist;
- a question cannot map to two requirements in one release;
- an option from another question cannot be saved in a draft;
- a requirement/question mapping cannot cross release ownership;
- a question/provision mapping cannot reference a missing provision;
- one open draft exists per assessment;
- submitted evaluation rows are immutable and unique per category;
- the former requirement legal-reference JSON column is absent after cutover;
- browser roles have no direct table grants.

### Drafts and submission

- the first draft is empty and later drafts seed from the latest submitted
  revision;
- authorized answer autosave increments the version;
- missing If-Match returns 428;
- stale If-Match returns 412 without changing the answer;
- cross-organization, wrong-release, wrong-question, and wrong-option writes
  fail safely;
- all 31 answers are required for submission;
- submission snapshots the exact requested draft version;
- idempotent replay returns the same revision;
- changed drafts create a new immutable revision;
- generation and Action Plan locks reject later draft mutation.

### Evaluator

- any `not_implemented` yields `not_fulfilled`;
- `partially_implemented` wins over `unsure` when no answer is not implemented;
- `unsure` yields `insufficient_evidence` when no worse answer exists;
- full plus not-applicable yields `fulfilled`;
- all not-applicable yields `insufficient_evidence`;
- missing, duplicate, and unknown stable values fail;
- exactly ten hidden rows are persisted atomically;
- evaluator input hashes are stable and change with any mapped answer;
- no workflow or review DTO before generation contains a status.

### Generation and review

- the guided-v4 response schema rejects a model-supplied status field;
- generation fails when deterministic category coverage is incomplete;
- persisted finding status always equals the pinned evaluation status;
- model prose, evidence sufficiency, citations, contradictions, and review
  flags remain validated;
- a document disagreement cannot silently change status;
- every finding has legal authority;
- exactly ten findings are persisted;
- manual correction still requires a reason and creates an audited immutable
  child revision;
- Action Plan generation still creates items only for final non-fulfilled
  findings.

### UI and end-to-end

- category progress is localized and ordered 1-10;
- each category displays only its mapped questions and help text;
- current-category completion gates forward navigation;
- reload restores server answers;
- concurrent browsers surface a conflict instead of overwriting;
- read-only roles cannot edit;
- no score or preliminary category status is rendered;
- the final review shows all 31 grouped answers;
- generated results show ten category findings;
- German and English flows use the exact pinned content.

Primary files likely to change or be added:

- `src/db/schema.ts`;
- a reviewed `drizzle/` migration;
- `scripts/sql/database-integrity-triggers.sql`;
- `src/server/compliance/nis2/releases/2026-v2/`;
- `src/server/compliance/publishing/release-registry.ts`;
- `src/server/gap-analysis/releases/types.ts`;
- `src/server/gap-analysis/releases/guided-v4/release.ts`;
- `src/server/gap-analysis/publishing/compile-release.ts`;
- `src/server/gap-analysis/publishing/publish-release.ts`;
- `src/server/gap-analysis/publishing/activate-release.ts`;
- `src/server/gap-analysis/publishing/release-registry.ts`;
- `src/server/gap-analysis/release-loader.ts`;
- `src/server/gap-analysis/questionnaire-service.ts`;
- a focused questionnaire draft service and deterministic evaluator module;
- `src/contracts/gap-analysis/generation.ts`;
- `src/client/gap-analysis.ts`;
- `app/api/organizations/[organizationId]/gap-analysis/`;
- `components/gap-analysis/gap-questionnaire-step.tsx`;
- `components/gap-analysis/gap-analysis-workflow.tsx`;
- `src/server/gap-analysis/prompt-contract.ts` or a versioned successor;
- `src/server/gap-analysis/generation-schema.ts`;
- `src/server/gap-analysis/generation-service.ts`;
- `src/server/operator-commands/seed-legal-corpus-fixture.ts`;
- `scripts/seed-legal-corpus-fixture.ts`;
- `scripts/clear-db.ts`;
- `scripts/publish-compliance-release.ts`;
- `scripts/activate-compliance-release.ts`;
- `scripts/publish-gap-release.ts`;
- `scripts/activate-gap-release.ts`;
- `package.json`, only where existing reseed command wiring or arguments need
  adjustment;
- relevant `tests/`, `evals/`, product, architecture, and database docs.

## Verification

Run code verification before changing the development database:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:ai
npm.cmd run check:i18n
npm.cmd run build
git diff --check
```

Run focused database verification after applying the migration/schema changes:

```powershell
npm.cmd run db:push -- --explain
npm.cmd run db:verify:server-only
npm.cmd run db:verify:integrity
npm.cmd run db:verify:localized-metadata
npm.cmd run db:verify:gap-requirements
```

Follow
[`../database/development-database-reset-and-bootstrap.md`](../../database/development-database-reset-and-bootstrap.md)
for the destructive development reset. Update that existing runbook and the
existing seed/operator implementations in place. Preserve these package-script
entry points:

- `db:clear`;
- `db:seed:legal-corpus-fixture`;
- the existing legal-corpus approval/import commands;
- `db:publish:compliance` and `db:activate:compliance`;
- `db:publish:gap` and `db:activate:gap`.

After the guarded clear and schema application, run the existing legal-corpus
seed/import/approval sequence, then use these updated publication arguments:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v2
npm.cmd run db:activate:compliance -- --release nis2/2026-v2

npm.cmd run db:publish:gap -- --release nis2-gap/guided-v4
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v4
```

Then run:

```powershell
npm.cmd run db:smoke:nis2
npm.cmd run db:smoke:gap
npm.cmd run db:smoke:authenticated-gap
npm.cmd run db:smoke:country-support
npm.cmd run db:benchmark:gap
```

Implementation smoke checks (no user sign-off checkpoint):

The implementer runs and records these checks after the complete reseed. They
are completion evidence, not a request for user verification or acceptance.

1. Complete the positive applicability path with both `important_entity` and
   `essential_entity` outcomes.
2. Start the Gap questionnaire, answer several categories, reload, and verify
   the draft resumes.
3. Edit from two browsers and verify stale writes are rejected visibly.
4. Complete all 31 questions and verify no category status appears before
   generation.
5. Select zero and several documents in separate runs as the test environment
   permits.
6. Generate and verify exactly ten findings with official legal sources.
7. Confirm deterministic status fixtures match the persisted statuses.
8. Correct one finding as Owner/Admin and verify reason, immutable revision,
   manual-change marker, and history.
9. Generate the Action Plan and verify the Gap Analysis becomes locked.
10. Repeat the questionnaire/result rendering in English.

## Acceptance criteria

- The active Gap release is `nis2-gap/guided-v4`.
- Its compatible applicability release contains the exact official BSIG and
  NIS2 provisions used by the questionnaire.
- The active questionnaire contains exactly 31 required bilingual questions
  in ten ordered categories.
- Each question has exactly the five agreed stable answer options.
- Each question maps relationally to exactly one category requirement and to
  at least one versioned legal provision.
- No active Gap requirement depends on `legal_references` JSON or demo
  placeholders.
- A shared draft survives reload and rejects stale concurrent updates.
- Submission snapshots the server draft into an immutable assessment revision.
- The deterministic evaluator persists exactly ten hidden category statuses
  using the agreed precedence.
- No preliminary status, triggering answer, score, or percentage is exposed
  before generation.
- The model cannot supply or override finding status.
- Generated results contain exactly ten findings with server-owned status,
  localized explanation/recommendation, evidence sufficiency, and validated
  legal citations.
- `important_entity` and `essential_entity` outcomes use the same questionnaire
  and category definitions.
- Existing manual correction, audit, finalization, and Action Plan locking
  behavior remains green.
- German and English flows resolve only from content revisions pinned by the
  release.
- The disposable development database can be cleared, rebuilt, republished,
  activated, and smoke-tested using documented commands.
- The existing clear, legal-corpus seed, compliance publish/activate, and Gap
  publish/activate package-script entry points perform the complete reseed; no
  guided-v4-only one-off seed path exists.
- The implementation performs the authorized development clear/reseed and all
  automated and smoke checks without waiting for an additional user approval
  or acceptance response.

## Risks and mitigations

### False legal precision

Question wording and provision references can suggest stronger legal certainty
than a questionnaire supports. Require primary-source review, retain the
orientation disclaimer, and keep the Gap result distinct from a binding
compliance certificate.

### Hidden status leakage

Adding evaluation rows makes it easy for a broad workflow projection to expose
preliminary status accidentally. Use explicit DTO allowlists and a contract
test that searches the complete pre-generation response for finding-status
values.

### Model status drift

Leaving `status` in the response schema would undermine deterministic
evaluation. Use a new strict response schema that rejects the field and inject
the server status only during persistence.

### Lost collaborative edits

Debounced last-write-wins updates can silently erase another team member's
answer. Require If-Match, increment one draft version transactionally, and
refresh on conflict.

### Duplicate sources of truth

Keeping category membership or legal references in both JSON and relational
tables invites drift. Publish the relational mappings once, remove the
requirement legal JSON in the disposable cutover, and derive runtime
projections from the joins.

### N+1 query regression

Thirty-one questions and their legal provisions can multiply translation and
mapping reads. Load mappings, provisions, and content revisions in bounded
batch queries and extend query-count tests.

### Accidental release mutation

Adding provisions to `2026-v1` or questions to `guided-v3` would violate
immutable release semantics even in development. Publish new version labels
and clear only the verified disposable database.

### Destructive reset against the wrong target

The agreed cutover permits deleting development data, not arbitrary databases.
Use the guarded reset runbook, print only non-secret target identity, stop all
writers, inspect Drizzle's plan, and never use force against an unexpected
schema diff.

## Related documents

- [`../product/gap-analysis-current-workflow.md`](../../product/gap-analysis-current-workflow.md)
- [`./gap-analysis-guided-ux-and-status-corrections.md`](gap-analysis-guided-ux-and-status-corrections.md)
- [`./gap-analysis-single-lifecycle-and-action-plan-lock.md`](gap-analysis-single-lifecycle-and-action-plan-lock.md)
- [`./gap-requirement-dictionary-normalization.md`](gap-requirement-dictionary-normalization.md)
- [`./authoritative-legal-corpus-and-grounded-ai.md`](authoritative-legal-corpus-and-grounded-ai.md)
- [`./immutable-compliance-release-architecture.md`](immutable-compliance-release-architecture.md)
- [`../database/development-database-reset-and-bootstrap.md`](../../database/development-database-reset-and-bootstrap.md)
- [`../architecture/database-structure.md`](../../architecture/database-structure.md)
- [`../../CONTEXT.md`](../../../CONTEXT.md)
