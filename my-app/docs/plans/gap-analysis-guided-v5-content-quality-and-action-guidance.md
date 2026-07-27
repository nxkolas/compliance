# Gap Analysis Guided-v5 Content Quality and Action Guidance

Status: proposed on 2026-07-26 after review of
[`manual-review-report.md`](../qa/gap-action-plan-manual-evaluation-2026-07-26Tmanual-qa/manual-review-report.md)
and a product-decision interview.

## Goal

Turn the structurally correct but conditionally acceptable `guided-v4` Gap
Analysis into customer-ready guidance without weakening its deterministic
status, citation, review, or single-lifecycle guarantees.

The new `nis2-gap/guided-v5` release must:

1. generate guidance from the exact questionnaire answers that caused work;
2. distinguish uncertain evidence from a confirmed missing control;
3. exclude unrelated organization documents before they reach the model;
4. prefer mapped operative legal provisions over broad contextual chunks;
5. regenerate all dependent guidance after a material human correction; and
6. create execution-ready action-plan items without a second AI call at plan
   finalization.

The connected development database is disposable. Implementation may clear,
push, and fully reseed it through the existing guarded commands. Do not add a
legacy backfill, dual-read path, compatibility converter, or a one-off
`guided-v5` seed command.

## Confirmed Product Decisions

### Release and rollout

- Implement all six recommendations in one coordinated, staged plan.
- Publish a new immutable `nis2-gap/guided-v5` release. Do not mutate the
  published `guided-v4` prompt, schema, or release definition.
- Use a new prompt/response contract version for `guided-v5`; do not overload
  v5 of the prompt contract that is already pinned by `guided-v4`.
- Retain the existing explicit-argument operator interface:

  ```powershell
  npm.cmd run db:publish:gap -- --release nis2-gap/guided-v5
  npm.cmd run db:activate:gap -- --release nis2-gap/guided-v5
  ```

- Update and reuse the existing clear, schema-push, legal-corpus seed,
  corpus-approval, release-publication, release-activation, and verification
  paths.
- Do not add a separate v5-only seed or bootstrap path.
- Require a clean-database expanded QA run with an unconditional pass before
  activating this release in any non-disposable target environment.

### Status, guidance, and AI ownership

- Requirement status remains deterministic and server-owned.
- The server derives one finding-level guidance mode:
  - `maintain_and_document` for `fulfilled`;
  - `control_remediation` for `partially_fulfilled` and `not_fulfilled`;
  - `evidence_verification` for `insufficient_evidence`.
- The model never chooses or changes status or guidance mode.
- The server identifies each triggering question and assigns its work kind:
  - `remediate` for `partially_implemented` or `not_implemented`;
  - `verify` for `unsure` or an all-`not_applicable` uncertainty;
  - no work package for `fully_implemented`;
  - no work package for `not_applicable` when another applicable answer
    determines a non-uncertain result.
- A finding may have a `control_remediation` mode while containing both
  `remediate` and `verify` work packages. This covers a category with one
  confirmed deficiency and another uncertain answer without treating the
  uncertain answer as absent.
- The AI authors localized rationale, recommendation, objective, deliverables,
  acceptance criteria, and suggested evidence only within the server-owned
  policy.
- Validation must reject work attached to satisfied questions or remediation
  language structurally assigned to `verify` work.

### Fulfilled findings

- A fulfilled finding keeps a rationale and a concise
  `maintain_and_document` recommendation.
- The wording must distinguish self-reported implementation from independent
  document verification.
- Missing organization evidence must not turn the recommendation into a
  mandatory remediation task.
- Fulfilled findings have no execution guidance and create no action-plan
  item.

### Uncertain findings

- `insufficient_evidence` means the current state is unknown; it does not mean
  the control is absent.
- Its generated measure must begin with owner assignment, state verification,
  and evidence collection.
- Each verification work package has two completion paths:
  - evidence confirms the control is implemented; or
  - evidence confirms a deficiency, which is then remediated and evidenced.
- This remains one fixed action-plan item. It does not require later plan
  reconciliation or automatic item creation.

### Evidence sufficiency and document relevance

- Organization-document retrieval is fail-closed.
- A versioned policy tied to embedding provider, model, dimensions, and
  chunking version decides whether each candidate is relevant enough to enter
  grounding.
- The policy uses evaluation-calibrated semantic and combined-score floors,
  retains only a small bounded result set, and returns zero organization
  evidence when no candidate qualifies.
- It never supplies an unrelated top-ranked chunk merely because no better
  document is available.
- Questionnaire assertions and legal citations do not increase documentary
  evidence sufficiency.
- With no admitted organization-document citation, the server forces
  `evidenceSufficiency=none`.
- With admitted organization evidence, the model may choose `partial` or
  `sufficient`, but the output must cite at least one admitted organization
  chunk.
- Relevant contradictory evidence remains admissible, can support
  `partial`/`sufficient`, and must retain the existing `requiresReview`
  behavior. Relevance is not agreement.

### Legal citations

- Every finding retains a valid legal citation.
- The primary `legalCitation` must be an eligible official primary-authority
  chunk linked to an operative provision mapped from the questions that form
  the finding's guidance basis.
- For `maintain_and_document`, use the requirement's mapped question
  provisions because there are no triggering deficiencies.
- Broad provisions, neighboring clauses, recitals, official guidance, and
  other relevant material may appear only as secondary context when a mapped
  operative chunk is available.
- If the release declares a mapped operative provision but the pinned corpus
  cannot supply an eligible chunk for it, fail closed with a safe diagnostic.
  Do not silently promote a broad contextual chunk.

### Corrections and regeneration

- Owners and administrators continue to correct findings only before action
  plan creation.
- A correction is limited to structured facts and reasons. Reviewers do not
  manually edit AI-generated rationale or action guidance.
- A material correction is one that changes status, evidence sufficiency, or
  the review resolution in a way that changes the guidance basis.
- A material correction automatically invokes a second, single-finding AI
  generation using the corrected server-owned facts and original pinned
  sources.
- There is no preview or confirmation step. A valid regenerated result and
  the corrected immutable revision are saved atomically, then displayed.
- If retrieval, AI generation, language validation, grounding validation, or
  persistence fails, no corrected revision becomes current.
- A pre-plan **Regenerate guidance** action may rerun the constrained
  single-finding generation and atomically create another immutable revision.
- The regenerate action does not permit manual generated-content editing and
  is unavailable after the action plan exists.
- Initial and corrected findings record the AI run that authored their current
  guidance. Unchanged findings copied into a corrected revision preserve their
  original guidance-run lineage.

### Action plan

- Preserve exactly one generated action-plan item per non-fulfilled finding.
- Preserve the finding recommendation as an immutable source summary.
- Every actionable finding and generated action-plan item must contain:
  - guidance/measure type;
  - objective;
  - deliverables;
  - acceptance criteria; and
  - suggested evidence.
- Deliverables, criteria, and evidence remain traceable to triggering question
  keys and work kinds internally.
- Generated action content becomes immutable when the plan is created.
- Status, owner, due date, and separate execution notes remain editable with
  optimistic concurrency and audit history.
- Plan finalization remains deterministic and makes no AI call.

## Non-Goals

- Do not change the deterministic category evaluator or severity mapping
  unless a failing test proves an existing defect.
- Do not split one finding into multiple generated action-plan items.
- Do not add action-plan reconciliation, replacement plans, or post-lock Gap
  regeneration.
- Do not let selected documents change the deterministic finding status.
- Do not let the model choose triggering questions, guidance mode, work kind,
  priority, or plan cardinality.
- Do not expose raw excerpts, citation IDs, retrieval scores, stable question
  keys, prompt diagnostics, or model provenance in the customer read model.
- Do not offer manual editing of generated rationale, recommendations, or
  structured execution guidance.
- Do not perform an independent legal-content expansion beyond ensuring that
  the existing mapped provisions resolve to eligible pinned-corpus chunks.
- Do not mutate historical `guided-v4` rows or try to make existing
  development findings compatible with the new schema.

## Current Implementation Diagnosis

### Category status is deep; guidance policy is shallow

`src/server/gap-analysis/deterministic-evaluator.ts` correctly owns category
status. However, the generated guidance is based on a broad requirement query
plus questionnaire excerpts. No server module tells the model:

- which answers triggered work;
- which answers are already satisfied;
- whether each trigger needs verification or remediation; or
- which mapped provision is primary for that work.

The model consequently reconstructs this policy from prose and often expands
back to the whole category.

### Evidence retrieval always fills the context

`src/server/documents/retrieval.ts` orders selected-document chunks by hybrid
score and returns the top rows without a relevance floor.

`src/server/ai/grounding/organization-retrieval.ts` maps every returned row
into grounding context. When one unrelated document is selected, every
requirement still receives its best unrelated chunks.

The model is asked to assess evidence sufficiency, but the server has already
made the unrelated document look like admissible evidence.

### Legal retrieval knows rank but not declared mapping preference

`src/server/ai/grounding/legal-retrieval.ts` performs broad hybrid retrieval,
then applies authority-tier quotas. It carries `provisionCode` in metadata but
does not accept the release's mapped legal-provision IDs as a preferred set.

`src/server/gap-analysis/release-loader.ts` already loads the relational
question-to-provision mapping, but currently projects only localized
reference keys, labels, and URLs at requirement level.

### Evidence sufficiency is unconstrained model output

`src/server/gap-analysis/generation-schema.ts` permits `sufficient`,
`partial`, or `none` for every finding regardless of admitted document
context. Citation validation proves IDs are permitted but does not enforce:

- `none` when no organization document was admitted; or
- an organization-document citation for `partial`/`sufficient`.

### Corrections copy stale guidance

`src/server/gap-analysis/review-service.ts` copies the source rationale and
recommendation whenever the correction payload does not replace them. A
status or evidence-sufficiency correction can therefore leave structured
fields and prose inconsistent.

The current correction contract even permits direct client-authored rationale
and recommendation, although the present UI generally submits only status and
reasons.

### Action items flatten the finding

`src/server/action-plans/service.ts` currently maps:

```text
title       = requirement title
description = finding recommendation
priority    = finding severity
status      = open
```

`action_plan_items` has no objective, structured deliverables, closure
criteria, suggested evidence, measure type, or execution-notes field.

## Target Flow

### Initial generation

```text
pinned questionnaire answers
        |
        v
deriveGapGuidancePolicy()
  - deterministic status
  - guidance mode
  - triggering questions
  - per-trigger work kind
  - preferred legal provisions
        |
        +------------------------+
        |                        |
        v                        v
admit organization       retrieve mapped legal
document evidence        authority first
        |                        |
        +-----------+------------+
                    v
        generate constrained prose
                    |
                    v
     validate policy + citations + locale
                    |
                    v
       persist immutable finding guidance
```

### Material correction

```text
reviewer submits corrected facts and reason
                    |
                    v
verify current editable revision and pinned inputs
                    |
                    v
derive corrected guidance policy
                    |
                    v
single-finding grounded AI regeneration
                    |
                    v
validate all dependent guidance
                    |
                    v
atomically create and advance corrected revision
```

The AI call occurs before the correction transaction commits. The transaction
must recheck that the source revision is still current and that no action plan
exists. A concurrent finalization may win; in that case correction persistence
fails without advancing the revision.

### Plan finalization

```text
accepted validated findings
        |
        v
buildActionPlanItems()
  - skip maintain_and_document
  - copy immutable structured guidance
  - derive priority and open status
        |
        v
atomic approval + one fixed plan
```

## Module and Interface Design

The implementation should concentrate policy behind four deep modules. Tests
use these interfaces rather than reaching into prompt assembly or persistence
internals.

### 1. Guidance-policy module

Suggested location:
`src/server/gap-analysis/guidance-policy.ts`.

Interface:

```ts
deriveGapGuidancePolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: Array<{
    stableKey: string;
    text: string;
    stableValue: GapAnswerValue;
    legalProvisions: Array<{
      id: string;
      key: string;
      provisionCode: string;
    }>;
  }>;
}): GapGuidancePolicy
```

The returned policy contains:

- derived `guidanceMode`;
- ordered triggering-question facts;
- ordered satisfied-question keys;
- per-trigger server-owned `workKind`;
- preferred legal-provision IDs/keys;
- a canonical policy hash.

Invariants:

- guidance mode exactly matches the determined status;
- every work package refers to exactly one mapped questionnaire question;
- no fully implemented question appears in the triggering set;
- `unsure` never produces `workKind=remediate`;
- `partially_implemented` and `not_implemented` never produce
  `workKind=verify`;
- output ordering follows the pinned questionnaire mapping, not database row
  or model order;
- the same pinned input produces the same policy hash.

### 2. Organization-evidence admission module

Suggested location:
`src/server/ai/grounding/organization-evidence-policy.ts`.

Interface:

```ts
admitOrganizationEvidence(input: {
  operation: "gap_analysis";
  provider: string;
  model: string;
  dimensions: number;
  chunkingVersion: string;
  candidates: OrganizationEvidenceCandidate[];
}): {
  policyVersion: string;
  admitted: OrganizationEvidenceCandidate[];
  rejected: OrganizationEvidenceDecision[];
}
```

The module owns thresholds, maximum admitted count, deterministic tie-breaking,
and safe diagnostics. `retrieveDocumentEvidence()` remains the general search
adapter; Gap grounding applies the admission policy after retrieving a larger
candidate pool and before building model context.

Do not scatter threshold comparisons across SQL, the grounding gateway, and
generation validation. One interface must produce the complete admission
decision and be the test surface.

### 3. Constrained-guidance generation module

Suggested location:
`src/server/gap-analysis/guidance-generation.ts`.

Interface:

```ts
generateGapGuidance(input: {
  actor: { userId: string };
  organizationId: string;
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirement: LoadedGapRequirement;
  policy: GapGuidancePolicy;
  selectedDocumentVersionIds: string[];
  outputLocale: Locale;
  idempotencyKey: string;
}): Promise<ValidatedGapGuidance>
```

This becomes the shared seam for:

- each requirement during initial generation;
- materially corrected single findings; and
- the explicit pre-plan regenerate-guidance command.

Its implementation may batch all requirements for initial provider efficiency,
but callers and validators must observe the same per-requirement contract.
Initial generation and correction must not maintain separate prompt rules.

The module owns:

- query-unit construction;
- admitted organization evidence;
- mapped legal retrieval preferences;
- the status-specific response schema;
- evidence-sufficiency constraints;
- triggering-question coverage;
- primary/secondary citation validation;
- contradiction/review validation;
- output-locale validation; and
- normalized guidance and provenance output.

### 4. Corrected-revision module

Keep the revision-copying and transaction behavior in the Gap review domain,
but give the orchestration one small interface:

```ts
regenerateAndCorrectGapFinding(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  findingId: string;
  correctedStatus?: GapFindingStatus;
  correctedEvidenceSufficiency?: EvidenceSufficiency;
  requiresReview?: boolean;
  reason: string;
  resolutionReason?: string;
  retryNonce?: string;
}): Promise<GeneratedArtifactRevision>
```

The interface does not accept rationale, recommendation, objective,
deliverables, acceptance criteria, or suggested evidence from the client.

An internal persistence seam accepts only validated regenerated guidance and
performs the current-revision/action-plan checks under the artifact lock.

## Target Data Model

Exact names may follow existing schema conventions, but the persisted
semantics must remain explicit.

### Enums

Add:

```text
gap_guidance_mode
  maintain_and_document
  control_remediation
  evidence_verification

gap_work_kind
  remediate
  verify

action_plan_measure_type
  control_remediation
  evidence_verification
```

`gap_work_kind` may remain a validated TypeScript/JSON enum rather than a
Postgres enum if it exists only inside versioned JSON guidance. Guidance mode
and action-plan measure type should be database enums because they are
top-level persisted fields with cross-column invariants.

### `gap_findings`

Add:

- `guidance_mode`, non-null;
- `guidance_basis`, versioned JSONB, non-null;
- `guidance_basis_hash`, non-null;
- `objective`, nullable text;
- `deliverables`, JSONB array, non-null with `[]` default;
- `acceptance_criteria`, JSONB array, non-null with `[]` default;
- `suggested_evidence`, JSONB array, non-null with `[]` default;
- `guidance_run_id`, non-null foreign key to `ai_processing_runs`.

Keep:

- status;
- evidence sufficiency;
- severity;
- rationale;
- recommendation;
- assumptions;
- review flag; and
- evidence rows.

Use a check constraint to enforce:

- `fulfilled` pairs with `maintain_and_document`;
- `partially_fulfilled`/`not_fulfilled` pair with
  `control_remediation`;
- `insufficient_evidence` pairs with `evidence_verification`;
- `maintain_and_document` has no objective or execution arrays;
- actionable modes have a nonblank objective and non-empty execution arrays.

`guidance_basis` contains only immutable policy facts needed for audit and
validation, for example:

```json
{
  "version": 1,
  "triggeringQuestions": [
    {
      "stableKey": "gap.iam.multi_factor_authentication",
      "answerValue": "not_implemented",
      "workKind": "remediate",
      "preferredLegalProvisionKeys": [
        "de_bsig.section_30_2_10",
        "eu_nis2.article_21_2_j"
      ]
    }
  ],
  "satisfiedQuestionStableKeys": [
    "gap.iam.least_privilege",
    "gap.iam.joiner_mover_leaver"
  ]
}
```

Do not copy localized question text into this JSON; the pinned assessment and
release remain authoritative for display text.

### Structured guidance shape

Persist ordered objects rather than unrelated string arrays so each generated
statement remains traceable:

```ts
type GapDeliverable = {
  questionStableKey: string;
  workKind: "remediate" | "verify";
  text: string;
};

type GapAcceptanceCriterion = {
  questionStableKey: string;
  workKind: "remediate" | "verify";
  text: string;
  completionPath?: "confirmed_implemented" | "confirmed_deficient";
};

type GapSuggestedEvidence = {
  questionStableKey: string;
  text: string;
};
```

For every triggering question:

- at least one deliverable is required;
- at least one suggested-evidence entry is required;
- remediation requires at least one closure criterion;
- verification requires both `confirmed_implemented` and
  `confirmed_deficient` completion paths.

No structured entry may reference a satisfied or unknown question key.

### `action_plan_items`

Replace the ambiguous generated `description` use with explicit immutable
snapshots:

- `measure_type`, non-null;
- `source_recommendation`, non-null text;
- `objective`, non-null text;
- `deliverables`, non-null JSONB array;
- `acceptance_criteria`, non-null JSONB array;
- `suggested_evidence`, non-null JSONB array;
- `execution_notes`, non-null text with an empty-string default.

Keep:

- one `source_finding_id`;
- localized title;
- deterministic priority;
- status;
- owner;
- due date;
- timestamps; and
- optimistic-concurrency version.

Because the database is cleared before the new shape is pushed, no
description-column backfill or dual read is required. Review the Drizzle
preview carefully and accept the intended replacement only against the
verified disposable target.

Add database checks for nonblank source recommendation/objective and non-empty
structured arrays.

### Grounding provenance

Extend `ai_processing_run_context` so admitted evidence can reproduce why it
entered the model context:

- retrieval-policy version;
- allowlisted score details, including lexical, semantic, and combined score;
- preferred-mapped-provision flag or selection role;
- the mapped legal-provision ID/key where applicable.

Use typed columns for fields needed in query predicates and a small versioned
JSONB snapshot for diagnostic details. Do not persist arbitrary provider
objects.

Add `gap_guidance_regeneration` to `ai_operation_kind`. Correction and explicit
regeneration runs must have independent idempotency keys and complete
grounding/language provenance.

## Server-Side Invariants

1. A model cannot choose or return a finding status.
2. A model cannot choose guidance mode or work kind.
3. Every generated work entry references an exact server-supplied triggering
   question.
4. Every triggering question has complete deliverable, closure, and evidence
   coverage.
5. No satisfied question appears in an actionable work entry.
6. An `unsure` answer is never described structurally as a confirmed missing
   control.
7. A fulfilled finding has no action guidance and creates no plan item.
8. No admitted organization document means
   `evidenceSufficiency=none`.
9. `partial` or `sufficient` requires at least one admitted and cited
   organization-document chunk.
10. Contradictory admitted evidence cannot change deterministic status and
    must set `requiresReview=true`.
11. A primary legal citation belongs to the preferred mapped operative set
    whenever that set is available.
12. Missing expected mapped authority fails closed.
13. A client cannot submit generated prose or execution guidance through a
    correction route.
14. Material correction creates no revision unless regenerated guidance
    passes schema, grounding, language, and consistency validation.
15. Correction persistence rechecks that the source revision is current and
    no action plan exists.
16. Explicit guidance regeneration changes no structured assessment facts.
17. Unchanged findings in a corrected revision preserve guidance and
    guidance-run lineage.
18. Action-plan generation makes no provider call.
19. Every non-fulfilled finding creates exactly one item, and every fulfilled
    finding creates none.
20. Generated plan content is immutable after creation.
21. Execution notes, status, owner, and due date remain independently
    editable and audited.
22. All customer read models continue to exclude raw policy keys, scores,
    excerpts, citation IDs, assumptions, and model diagnostics.

## Implementation Plan

### Phase 1: Lock the guided-v5 behavior with policy tests

Add failing tests before changing production behavior.

Create `tests/gap-guidance-policy.test.ts` covering:

- all fully implemented -> `maintain_and_document`, no triggers;
- one partial among fulfilled -> `control_remediation`, only the partial
  question;
- one missing among fulfilled -> `control_remediation`, only the missing
  question;
- one unsure among fulfilled -> `evidence_verification`, only the unsure
  question;
- missing plus unsure -> finding-level remediation with separate remediate and
  verify triggers;
- partial plus unsure -> finding-level partial status with both trigger kinds;
- all not applicable -> evidence verification with an explicit state-verification
  basis;
- stable ordering and policy hashing;
- provision preference derived only from work-driving questions; and
- fulfilled maintenance policy using the full mapped provision set.

Extend `tests/gap-deterministic-evaluator.test.ts` only to prove the new policy
consumes, but does not alter, evaluator output.

Create generation-schema tests that initially fail for:

- satisfied-question work;
- missing trigger coverage;
- verify work without two completion paths;
- action guidance on fulfilled findings;
- non-`none` sufficiency with no admitted organization evidence;
- non-`none` sufficiency without a cited admitted chunk; and
- a primary legal citation outside the preferred mapped set.

### Phase 2: Implement the deep guidance-policy module

Add `src/server/gap-analysis/guidance-policy.ts` with the pure interface
described above.

Update the release-loader projection so each loaded question/requirement can
provide:

- stable question key;
- stable answer value;
- localized question text;
- legal-provision ID;
- legal-provision key;
- provision code;
- mapping position.

Do not infer this mapping from localized text or JSON legal-reference labels.
Use the existing relational `gap_question_legal_provisions` rows.

Refactor initial Gap generation to build one guidance policy per applicable
requirement before constructing query units. Keep the deterministic evaluation
row as the source of status.

Expose only the policy object and its hash to later generation code. Avoid
passing independent arrays of status, answers, and mappings that callers must
reconcile themselves.

### Phase 3: Add versioned fail-closed document admission

Create the organization-evidence admission module and policy definition.

Start with a named version such as
`gap_org_evidence_relevance_v1`. Its definition pins:

- embedding provider;
- embedding model;
- dimensions;
- chunking version;
- minimum cosine similarity;
- minimum combined score;
- optional minimum lexical score for exact-control vocabulary;
- maximum admitted chunks per query unit; and
- deterministic tie-breaking.

Do not choose final thresholds from intuition. Add a calibration fixture set
containing:

- exact policy/process evidence for multiple categories;
- semantically adjacent but insufficient evidence;
- the contradictory restore-testing record;
- unrelated backup text queried against all other categories;
- generic security language;
- bilingual German/English document samples; and
- empty/very short chunks.

Add a calibration test or script that prints score distributions and asserts
the selected policy:

- admits the exact and contradictory relevant samples;
- rejects every unrelated category/sample pair; and
- remains stable for the pinned embedding configuration.

Update `retrieveOrganizationContext()` to:

1. retrieve a bounded candidate pool;
2. pass candidates through the policy;
3. map only admitted candidates to grounding context;
4. attach policy version and score components to provenance metadata; and
5. return an empty list when all candidates are rejected.

Keep selected document versions in immutable run/artifact input lineage even
when none of their chunks is admitted or cited.

Extend `tests/document-retrieval.test.ts` or add
`tests/gap-organization-evidence-policy.test.ts` to test the module interface,
including provider/model mismatch and deterministic ordering.

### Phase 4: Prefer mapped operative legal authority

Extend legal retrieval input with preferred mapped legal-provision IDs and
keys from `GapGuidancePolicy`.

Update `src/server/ai/grounding/legal-retrieval.ts` to:

1. join/select `legal_sources.legal_provision_id`;
2. identify eligible chunks linked to preferred mapped provisions;
3. rank exact mapped primary authority ahead of semantic context;
4. retain the existing effective-date, corpus-pin, language, translation, and
   authority checks;
5. return preferred candidates with an explicit selection role;
6. retrieve broader context only after preferred coverage; and
7. report which expected mapped provisions had no eligible chunk.

Do not replace retrieval with string matching against `provisionCode`. Use the
relational legal-provision identity wherever available.

The status-specific response-schema builder receives:

- permitted citation IDs;
- preferred primary legal citation IDs; and
- secondary permitted IDs.

The model's `legalCitation` enum must use the preferred primary IDs. If the
preferred set should exist but is empty, fail before the provider call with a
safe error such as `GAP_MAPPED_LEGAL_AUTHORITY_MISSING`.

Add tests for every guided-v5 requirement proving that at least one eligible
mapped primary-law chunk is available after a fully seeded bootstrap.

### Phase 5: Define prompt/response contract v6

Add a new immutable contract, for example:

- `src/server/gap-analysis/prompt-contract-v6.ts`;
- prompt version `6`;
- response schema version `6`.

Keep `prompt-contract-v5.ts` unchanged for `guided-v4`.

The system instruction must explicitly state:

- status, guidance mode, triggers, and work kinds are supplied facts;
- satisfied controls must be acknowledged but excluded from remediation;
- verify work must not assume absence;
- each verify package needs implemented and deficient completion paths;
- only admitted document evidence may affect evidence sufficiency;
- primary legal citation must come from the supplied preferred set;
- contradictions cannot change status and require review; and
- all prose must use the pinned locale.

Build a strict per-requirement response schema from `GapGuidancePolicy`.
Prefer a keyed `workPackages` object whose keys are exactly the triggering
question keys. This structurally prevents omitted, invented, or satisfied
question work.

Example actionable model shape:

```json
{
  "evidenceSufficiency": "none",
  "rationale": "...",
  "recommendation": "...",
  "objective": "...",
  "workPackages": {
    "gap.iam.multi_factor_authentication": {
      "deliverables": ["..."],
      "acceptanceCriteria": ["..."],
      "suggestedEvidence": ["..."]
    }
  },
  "assumptions": [],
  "citations": [],
  "contradictions": [],
  "questionnaireDisagreements": [],
  "requiresReview": false,
  "legalCitation": "LEGAL:..."
}
```

The server reattaches the known question key and work kind during
normalization. The model does not emit or choose `workKind`.

For `maintain_and_document`, the schema omits objective/work packages and
requires evidence-aware maintenance wording through the prompt and
evaluation suite.

Add pure normalization/validation functions that receive policy plus admitted
context. Make this interface the main test surface; avoid tests that assert
incidental prompt JSON formatting.

### Phase 6: Integrate constrained guidance into initial generation

Refactor `src/server/gap-analysis/generation-service.ts` around the shared
guidance-generation module.

Responsibilities retained by the orchestration:

- authorization and lifecycle guards;
- pinned assessment/release/applicability loading;
- deterministic evaluation loading;
- idempotency;
- all-requirement provider batching where supported;
- immutable source/run linkage; and
- transactional artifact persistence.

Responsibilities moved behind the generation interface:

- query-unit content;
- document admission;
- mapped legal preference;
- response schema construction;
- normalized action guidance;
- sufficiency/citation validation; and
- generated prose extraction.

Correct the run metadata so persisted prompt and response versions reflect
the active release contract rather than hard-coded grounding-v4 labels.
Historical runs remain unchanged.

Before inserting a finding, validate:

- status/guidance-mode consistency;
- guidance-basis hash;
- structured work coverage;
- evidence-sufficiency ceiling;
- primary citation preference;
- contradiction/review consistency; and
- current language validation.

Persist `guidanceRunId` on every initial finding.

Update the safe finding projection and result UI to show:

- rationale;
- recommendation;
- objective for actionable findings;
- grouped deliverables;
- grouped acceptance criteria; and
- suggested evidence.

Do not expose internal stable keys/work kinds. Use localized headings and
accessible list semantics.

### Phase 7: Make corrections regenerate dependent guidance

Replace the current client-authored correction shape in
`src/contracts/gap-analysis/generation.ts`.

The correction request may contain:

- finding ID;
- corrected status;
- corrected evidence sufficiency;
- requires-review transition;
- correction reason;
- resolution reason; and
- retry nonce for explicit regeneration.

It must reject rationale, recommendation, assumptions, objective,
deliverables, acceptance criteria, suggested evidence, guidance mode, and
work kind.

Refactor `src/server/gap-analysis/review-service.ts`:

1. load the source finding, pinned assessment revision, release, evidence
   selection, and mapped requirement;
2. derive corrected status and guidance policy;
3. decide whether the request is a factual correction or guidance-only
   regeneration;
4. invoke the shared single-finding guidance-generation interface;
5. validate corrected evidence sufficiency against admitted/cited evidence;
6. enter the existing artifact-lock transaction;
7. recheck current revision, no plan, reasons, coverage, and evidence;
8. create the complete immutable child revision;
9. use regenerated guidance for the target finding;
10. copy unchanged findings with their original guidance-run IDs;
11. copy pinned source/evidence rows;
12. record review resolution and correction/regeneration audit events;
13. associate the successful regeneration run with the new revision; and
14. advance the current revision pointer.

The regeneration run should use `gap_guidance_regeneration` operation kind and
the same provider policy, corpus pins, locale enforcement, claim validation,
and provenance path as initial generation.

If the correction changes `evidenceSufficiency`, the regenerated rationale
must describe the corrected value consistently. The provider does not get to
replace it. Build the status-specific schema with the corrected sufficiency as
a literal when the reviewer supplied it, subject to the server evidence
ceiling.

Clarify correction semantics:

- a reviewer may lower sufficiency even when documents are present;
- a reviewer may raise sufficiency only when admitted/cited organization
  evidence permits it;
- a regenerate-only request changes no status, sufficiency, or review facts;
- a regenerate-only request still requires an attributable reason;
- repeated regeneration produces a new immutable revision and AI run.

Update `components/gap-analysis/gap-results-step.tsx`:

- keep structured status/reason/resolution inputs;
- remove any generated-content editing capability;
- explain that saving a material correction regenerates guidance;
- show the existing busy/error behavior while the call runs;
- refresh directly to the automatically saved revision;
- add **Regenerate guidance** before plan creation; and
- prevent duplicate submission while a correction/regeneration is active.

Retain synchronous request orchestration for the single-finding call initially,
because it preserves the current simple correction interface and atomic
current-revision check. Add a background job only if measured provider latency
exceeds the deployment request budget. Do not preemptively introduce a
correction-draft lifecycle.

### Phase 8: Persist and generate execution-ready action items

Update `src/db/schema.ts` with the finding, plan-item, provenance, and operation
changes described above.

Update `buildActionPlanItems()` so it accepts validated actionable guidance
and returns exactly one item per non-fulfilled finding:

```text
sourceFindingId    = finding.id
title              = localized requirement title
measureType        = finding guidance mode
sourceRecommendation = finding recommendation
objective          = finding objective
deliverables       = finding deliverables
acceptanceCriteria = finding acceptance criteria
suggestedEvidence  = finding suggested evidence
priority           = finding severity
status             = open
executionNotes     = ""
```

The builder must throw if a non-fulfilled finding lacks valid structured
guidance. Finalization must fail and roll back instead of creating a partial
or flattened item.

Update all explicit Drizzle column projections, including:

- action-plan readers;
- dashboard readers;
- report readers/renderers;
- finalization;
- historical Gap readers;
- tests and fixtures.

Extend the action-plan update contract and service with `executionNotes`.
Continue optimistic concurrency and include before/after notes in the audit
event. Do not accept updates to generated guidance fields.

Update `components/action-plans/action-plan-workflow.tsx` to render:

- measure-type label;
- source recommendation summary;
- objective;
- grouped deliverables;
- grouped acceptance criteria;
- suggested evidence;
- editable execution notes;
- existing priority, status, owner, and due date.

Use localized, accessible headings and list markup. Preserve the current result
locale indicator so generated German/English content is not relabeled by the
viewer's UI locale.

### Phase 9: Publish the immutable guided-v5 release

Add a dedicated `src/server/gap-analysis/releases/guided-v5/release.ts`.

The questionnaire and category meaning remain equivalent to guided-v4, but
the new release must independently pin:

- release label `guided-v5`;
- requirement-set/version identities;
- prompt version 6;
- response schema version 6;
- unchanged deterministic evaluator kind/version;
- compatible check release;
- required corpus families; and
- immutable content hashes.

Do not modify `guided-v4` content or hashes. Prefer an explicit guided-v5
snapshot over a shared mutable definition that could silently change both
historical releases. Add regression tests proving the repository definition
and compiled aggregate hash for guided-v4 remain unchanged.

Update the existing release machinery:

- `src/server/gap-analysis/publishing/release-registry.ts`;
- guided-release validation in `compile-release.ts`;
- guided-release activation checks in `activate-release.ts`;
- release compiler/loader/localization tests;
- `scripts/publish-gap-release.ts` and
  `scripts/activate-gap-release.ts` only where validation/help text needs to
  recognize guided-v5;
- rollout verifiers that currently require guided-v4;
- smoke/benchmark fixtures with hard-coded release expectations; and
- current workflow/runbook documentation.

Generalize the current `isGuidedV4` checks into a named supported guided-release
contract rather than adding another chain of version comparisons. The
interface should declare expected question count, requirement count, option
contract, legal mapping completeness, evaluator version, and response schema.

### Phase 10: Update the existing seed/bootstrap path

Keep these package-script entry points canonical:

- `db:clear`;
- `db:push`;
- `db:bootstrap:platform-admin`;
- `db:seed:legal-corpus-fixture`;
- the existing corpus inspect/approve/evaluate flow;
- compliance release publish/activate;
- `db:publish:gap`;
- `db:activate:gap`;
- rollout and server-only verification.

Update the existing legal-corpus fixture/operator implementation where needed
so every guided-v5 mapped operative provision resolves to:

- the correct relational `legal_provision_id`;
- an eligible primary-authority legal source;
- a reviewed processing generation;
- an official rendition where required;
- a published pinned corpus member; and
- at least one retrievable embedded chunk.

Add a verifier to the existing reset/bootstrap sequence that enumerates all
guided-v5 question-to-provision mappings and fails if preferred legal
authority coverage is incomplete. Reuse or extend
`db:verify:gap-requirements`; do not add a guided-v5-only seed.

Update
`docs/database/development-database-reset-and-bootstrap.md` with the
guided-v5 publication/activation arguments and the new coverage/relevance
verification commands.

Update `src/server/operator-commands/verify-api-corpus-rollout.ts` and related
runbooks to expect the active guided-v5 release after cutover.

### Phase 11: Expand automated and manual evaluations

Update `scripts/manual-gap-action-plan-evaluation.ts` to understand:

- prompt/response contract 6;
- guidance modes and bases;
- structured execution guidance;
- automatic correction regeneration;
- per-finding guidance-run lineage;
- action-plan source snapshots; and
- primary mapped legal citation assertions.

Preserve the five original scenarios and add deterministic checks:

#### Case 1: mature baseline

- all statuses and severities unchanged;
- all guidance modes are `maintain_and_document`;
- no action guidance or plan items;
- no mandatory remediation wording;
- wording distinguishes self-report from document verification.

#### Case 2: absent controls

- all statuses, severities, and ten-item cardinality unchanged;
- only non-implemented questions appear in work packages;
- every item has objective, deliverables, criteria, and evidence;
- no verify work unless an input is actually uncertain.

#### Case 3: mixed maturity

- governance addresses oversight only;
- risk addresses update-cadence verification only;
- IAM addresses MFA only;
- backup addresses restore testing only;
- every satisfied question is absent from structured work;
- recommendation prose matches the structured basis.

#### Case 4: all unsure, German

- all statuses and severities unchanged;
- all modes are `evidence_verification`;
- every work package begins with verification;
- each trigger has both implemented and deficient completion paths;
- no unconditional implementation claim;
- all generated prose remains German.

#### Case 5: contradictory backup document

- backup status remains server-owned before correction;
- exact contradictory evidence is admitted and cited;
- review blocks finalization;
- unrelated categories receive no citation from the backup document;
- unrelated categories remain `evidenceSufficiency=none`;
- the legal primary citation is mapped operative authority;
- material correction invokes a distinct regeneration run;
- regenerated rationale/sufficiency/guidance agree;
- final plan contains exactly one structured backup item.

Add adversarial retrieval cases:

- one unrelated selected document queried against every requirement;
- generic “security policy” language with no control-specific content;
- semantically adjacent but wrong control;
- relevant contradiction;
- relevant evidence in German for English output and vice versa;
- multiple selected documents where only one is relevant; and
- no candidate above threshold.

Add action-plan tests proving:

- exactly one item per non-fulfilled finding;
- structured snapshots match the source finding;
- missing structure aborts finalization;
- generated fields cannot be patched;
- execution notes can be patched with optimistic concurrency;
- reports and dashboard projections still work; and
- action-plan locking still rejects later correction/regeneration.

### Phase 12: Documentation and release evidence

Update:

- `docs/product/gap-analysis-current-workflow.md`;
- relevant Gap/action-plan plans that are treated as current operational
  references;
- API/service contract documentation;
- database structure documentation for the new columns/enums;
- reset/bootstrap runbook;
- operator rollout runbook; and
- localized UI copy in `lib/i18n/messages/modules.ts`.

Create a new dated QA artifact directory containing:

- manifest;
- raw per-case JSON;
- runner stdout/stderr;
- threshold calibration summary;
- exact release/prompt/schema/provider metadata;
- automatic comparison results;
- manual content judgments; and
- a final report with overall result **Pass**.

The report must distinguish product-behavior validation from independent legal
advice, as the current report does.

## Database Cutover

Run code-level tests before touching the connected database.

### 1. Verify the target without printing credentials

Follow
[`development-database-reset-and-bootstrap.md`](../database/development-database-reset-and-bootstrap.md)
and
[`drizzle-workflow.md`](../database/drizzle-workflow.md).

Confirm host, port, and database name from
`DRIZZLE_DATABASE_URL ?? DATABASE_URL`. Stop if it is not the intended
disposable development target.

### 2. Preview the schema

```powershell
npm.cmd run db:push -- --explain
```

Review every enum, column, foreign key, check, index, and intended
`action_plan_items.description` replacement. Reject any unrelated drop or RLS
change.

### 3. Clear and push

Use the existing guarded clear command with its documented confirmation value,
then run:

```powershell
npm.cmd run db:push
npm.cmd run db:verify:server-only
npm.cmd run db:push -- --explain
```

The final explain must show zero drift.

### 4. Reseed through existing commands

Use the existing runbook to:

1. bootstrap the platform administrator;
2. seed/import the legal corpus fixture;
3. run the worker to process required jobs;
4. inspect and approve the corpus through existing governance commands;
5. publish/evaluate/activate the required corpus releases;
6. publish/activate the compatible compliance release;
7. publish `nis2-gap/guided-v5`;
8. run mapped-authority coverage verification;
9. activate `nis2-gap/guided-v5` on the disposable database; and
10. run rollout, RLS, integrity, smoke, and expanded manual QA.

Do not bypass corpus review/evaluation merely because the database is
disposable.

### 5. Activation rule

Activation on the disposable development database is part of the rehearsal.
Do not activate guided-v5 in any persistent reviewed environment until the
rehearsal artifacts show an unconditional pass.

## Verification

### Fast gates

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:i18n
```

### AI and grounding gates

```powershell
npm.cmd run test:ai
```

Add focused commands or test selections for:

- guidance-policy invariants;
- response-schema invariants;
- document relevance;
- mapped legal ranking;
- correction regeneration;
- action-plan structured snapshots; and
- safe projection.

### Build and worker gates

```powershell
npm.cmd run build
npm.cmd run worker:typecheck
npm.cmd run test:worker
npm.cmd run test:routes
```

### Database gates

Run:

- server-only RLS verification;
- database-integrity verification;
- mapped guided-v5 legal-authority coverage;
- corpus rollout verification;
- authenticated Gap smoke;
- country-support smoke;
- Gap workflow benchmark assertions; and
- expanded manual Gap/action-plan evaluation.

## Automated Acceptance Matrix

| Area | Required assertion |
| --- | --- |
| Determinism | Existing 50/50 statuses and severities remain exact |
| Triggering | Structured work contains every and only work-driving questions |
| Uncertainty | `unsure` always maps to verify work, never confirmed absence |
| Fulfilled wording | Maintenance/documentation wording is optional and non-remedial |
| Document relevance | Unrelated selected documents are rejected before grounding |
| Sufficiency | No admitted document forces `none`; higher values cite admitted evidence |
| Contradiction | Relevant conflict is cited, review-blocking, and status-preserving |
| Legal authority | Primary citation belongs to the mapped operative set |
| Correction | Material change creates a distinct valid AI run and consistent revision |
| Regeneration | Guidance-only retry changes no assessment facts |
| Plan cardinality | One item per non-fulfilled finding, zero per fulfilled finding |
| Plan structure | Every item has non-empty objective, deliverables, criteria, and evidence |
| Plan immutability | Generated fields cannot be patched after finalization |
| Execution | Status, owner, due date, and notes remain editable and audited |
| Language | All generated prose stays in the pinned English/German locale |
| Safety | Customer projections expose no raw evidence or policy diagnostics |
| Lifecycle | Plan creation still permanently locks Gap correction/regeneration |
| Rollout | Existing seed/publish/activate commands complete a clean bootstrap |

## Manual QA

1. Generate a mature no-document English result and verify every fulfilled
   card uses maintenance/documentation wording.
2. Verify no fulfilled card contains objective, deliverables, or plan items.
3. Generate the absent-controls case and inspect all ten structured items.
4. Confirm every work package maps to an actually absent question.
5. Generate the mixed case and verify governance, risk, IAM, and backup
   exclude satisfied controls.
6. Generate the all-unsure German case.
7. Verify each item first asks for an owner, state verification, and evidence.
8. Verify both completion paths are visible and understandable.
9. Select only the contradictory backup document.
10. Verify the document appears only on directly relevant findings.
11. Verify unrelated findings show no organization-document support and
    `none` sufficiency.
12. Attempt finalization with the unresolved contradiction and verify it is
    blocked.
13. Correct the backup finding and verify guidance regeneration starts
    automatically.
14. Verify no preview or confirmation UI appears.
15. Verify the new revision displays corrected, internally consistent
    guidance.
16. Trigger **Regenerate guidance** and verify a new revision/run is recorded
    without changing status or sufficiency.
17. Resolve all blockers and generate the plan.
18. Verify plan generation performs no AI call.
19. Verify the plan contains exactly one backup item in the contradiction
    case.
20. Verify objective, deliverables, criteria, and evidence match the accepted
    finding.
21. Verify generated plan fields are read-only.
22. Edit execution notes, status, owner, and due date.
23. Verify optimistic-concurrency failure and audit metadata.
24. Attempt correction and regeneration after plan creation and verify both
    are rejected.
25. Repeat relevant UI checks in German and English, including keyboard,
    focus, busy, failure, empty, and screen-reader list behavior.

## Suggested Commit Sequence

Keep commits small and independently verifiable:

1. `test: define guided-v5 guidance policy`
2. `feat: derive gap guidance from triggering answers`
3. `test: define organization evidence admission`
4. `feat: filter unrelated gap document evidence`
5. `feat: rank mapped operative gap citations first`
6. `schema: persist structured gap guidance and provenance`
7. `feat: add gap prompt and response contract v6`
8. `refactor: share constrained gap guidance generation`
9. `feat: regenerate guidance on finding correction`
10. `feat: add pre-plan guidance regeneration`
11. `schema: make action items execution ready`
12. `feat: render structured action guidance`
13. `feat: publish the guided-v5 gap release`
14. `test: expand gap content quality evaluations`
15. `ops: update existing guided-v5 bootstrap workflow`
16. `docs: record guided-v5 workflow and QA evidence`

Do not combine database cutover/reseed evidence with earlier code commits.
Complete code review and fast gates first, then perform the authorized
disposable-database rollout.

## Definition of Done

- `nis2-gap/guided-v5` has an immutable prompt/response contract and leaves
  guided-v4 unchanged.
- The server, not the model, owns status, guidance mode, triggering questions,
  work kind, plan cardinality, and priority.
- Mixed categories remediate only deficient controls.
- Uncertain answers produce verification-first conditional work.
- Unrelated documents never enter grounding or increase evidence sufficiency.
- Primary legal citations use mapped operative authority.
- Material corrections automatically regenerate all dependent guidance and
  cannot save inconsistent prose.
- Reviewers cannot manually edit generated content but can request
  pre-finalization regeneration.
- Action plans contain one execution-ready item per non-fulfilled finding.
- Generated plan content is immutable; execution metadata remains editable.
- Plan finalization makes no AI call and retains atomic locking behavior.
- The existing guarded clear/seed/publish/activate workflow can reproduce the
  complete environment with guided-v5.
- All lint, type, unit, route, worker, AI, build, database, smoke, and
  localization gates pass.
- The expanded fresh-database QA report records an unconditional **Pass**.

