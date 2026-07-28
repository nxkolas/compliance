# Atomic Gap Statements and Simplified Action Plan

Status: proposed on 2026-07-26 after a product-decision grilling session.

## Goal

Separate the Gap Analysis from the Action Plan both conceptually and in the
stored data.

The Gap Analysis should tell a normal user, in short language, what is missing,
only partially implemented, or still unclear. It must not contain objectives,
recommendations, deliverables, acceptance criteria, evidence requests, or
other action-plan content.

The Action Plan should be generated later, in a separate AI operation. It may
combine several gaps into one practical action or split one gap into several
ordered actions, but only within the same category.

Example target output:

```text
Access control

- MFA is missing for privileged access.
- Access rights are not reviewed regularly.
- It is unclear whether former employees' access is removed promptly.
```

```text
Access control

1. Introduce MFA for privileged access
   Result: Privileged accounts require MFA when signing in.
   Recommended evidence:
   - MFA policy
   - MFA configuration export

2. Establish regular access reviews
   Result: Access rights are reviewed and documented every quarter.
   Recommended evidence:
   - Access review procedure
   - Completed access review record
```

## Confirmed Product Decisions

### Gap Analysis

- Keep one deterministic assessment record per category.
- Keep categories in their questionnaire/release order.
- Keep fulfilled categories visible with a localized
  **No gaps identified** message.
- Every triggering questionnaire answer produces at least one and at most five
  customer-visible gaps.
- A single questionnaire answer may produce multiple gaps when it covers
  genuinely distinct control elements.
- Each gap expresses exactly one non-overlapping fact.
- Each gap remains traceable to exactly one triggering questionnaire answer.
- Satisfied and genuinely non-applicable answers produce no gaps.
- Gap text is one short, standalone sentence, ideally no more than 20 words.
- Gap text contains no legal analysis, evidentiary preamble, recommendation,
  objective, or remediation instruction.
- Preserve truthful distinctions:
  - missing: `MFA is missing for privileged access.`;
  - partial: `MFA is not used for all privileged access.`;
  - uncertain: `It is unclear whether MFA is used for privileged access.`
- The AI may name a specific missing sub-control only when the questionnaire or
  admitted organization evidence supports that specificity.
- A broad `partially_implemented` answer must not be expanded into invented
  claims about which sub-control is absent.
- Generated gap statements are immutable. A material reviewer correction
  regenerates the affected category before an Action Plan exists.
- Keep one expandable **Sources used** section per category. Do not repeat
  sources below every short gap.
- Keep exact question and evidence traceability internally.
- When contradictory admitted evidence requires review, show a separate short
  **Review required** notice. It may explain the conflict but may not contain
  remediation advice or appear as another gap.
- Remove the current fulfilled-category maintenance recommendation from the
  customer view.

### Action Plan

- Generate Action Plan content in a separate AI stage after the user selects
  **Create action plan**.
- Supply the Action Plan generator with:
  - the finalized atomic gaps;
  - the category requirement;
  - all questions and answers in that category, including satisfied controls;
  - the pinned organization-document versions and admitted relevant context;
  - the mapped legal context; and
  - the pinned result locale.
- The full category context prevents an action from contradicting a satisfied
  control, but an action may address only finalized gaps.
- A generated action may never cross a category boundary.
- Within one category, the AI may:
  - combine multiple gaps into one action; and
  - split one gap across multiple actions.
- Every non-fulfilled gap must be linked to at least one action.
- Every action must be linked to at least one gap.
- Allow at most ten generated actions per category.
- Preserve AI-proposed execution order within a category.
- Group categories in the same release order as the Gap Analysis.
- Keep priority server-owned. Every action inherits the deterministic severity
  of its source category.
- Each action contains only:
  - a short imperative title;
  - a plain-language result;
  - one or more recommended evidence items;
  - status;
  - owner;
  - due date; and
  - execution notes.
- Remove the visible and persisted source recommendation, objective,
  deliverables, and acceptance criteria.
- Generated action title, result, evidence, gap links, category, priority, and
  order are immutable after successful plan creation.
- Status, owner, due date, and execution notes remain editable and audited with
  optimistic concurrency.
- Uncertain gaps produce verification-first actions. Any remediation language
  must be conditional on verification finding a deficiency.
- A suitable simple result for uncertain work is:
  `MFA coverage is documented, and any identified deficiencies are corrected.`
- The AI may split uncertain work into ordered verification and conditional
  remediation actions when useful.
- A successful generation immediately activates the Action Plan; there is no
  preview or approval screen.
- A failed or cancelled generation creates no partial plan and may be retried.

### Release and database reset

- Publish a new immutable `nis2-gap/guided-v6` release.
- Add a new Gap prompt/response contract version for the reseeded guided-v6
  release.
- Pin the new Action Plan prompt/response contract in the Gap release so a plan
  can be reproduced from its source revision.
- Preserve the deterministic category evaluator, questionnaire, question to
  category mappings, evidence-admission policy, legal mapping policy, and
  category severity rules unless a failing test exposes a defect.
- The connected database is expendable. The implementation may clear it
  completely and replace the schema in place.
- Do not create migration code, backfills, compatibility columns, dual reads,
  old-schema converters, or legacy runtime branches.
- Remove old Gap/Action Plan persistence and generation logic after the new
  path replaces it. Do not keep dead behavior solely to read rows that will be
  deleted by the reset.
- Edit the existing clear, schema-push, legal-corpus seed/approval,
  Gap-release publish/activate, corpus-binding, and verification scripts so the
  normal full reseed workflow produces the new schema and guided-v6 release.
- Do not add a one-off guided-v6 bootstrap script. The existing scripts remain
  the reusable source of truth for every future reset and reseed.
- Prove the reset path from an empty database before considering the work
  complete.

## Non-Goals

- Do not let the AI choose category status, triggering questions, gap kind,
  category severity, priority, or category membership.
- Do not let the AI create gaps for satisfied questions.
- Do not let the AI create actions unrelated to finalized gaps.
- Do not group one action across several categories, even if the controls are
  related.
- Do not add manual editing of generated gaps or generated action content.
- Do not add a plan preview, plan-content editor, or post-activation
  regeneration flow.
- Do not add automatic follow-up actions after a verification action is
  completed.
- Do not expose raw answer IDs, gap IDs, citation IDs, retrieval scores,
  prompt metadata, or model provenance as visible customer content.
- Do not weaken the existing evidence, citation, locale, contradiction,
  staleness, review, idempotency, audit, or lifecycle guarantees.
- Do not retain unused guided-v5/v6 response handling, database projections, or
  tests merely for backward compatibility with the cleared database.

## Current Implementation Diagnosis

### One category record currently contains both products

`gap_findings` is correctly unique by Gap revision and requirement/category,
but it currently stores:

- `rationale`;
- `recommendation`;
- `objective`;
- `deliverables`;
- `acceptance_criteria`; and
- `suggested_evidence`.

The Gap results UI renders all of those fields. This is why the Gap Analysis
already looks like an Action Plan.

### Trigger-level work is flattened

The guided-v5/v6 contract already supplies the model with exact triggering
questions and receives one `workPackages[questionStableKey]` object per
trigger. Normalization then flattens those packages into category-wide arrays.
The customer therefore sees one large category explanation rather than
several atomic gaps.

### Plan cardinality is fixed to one category

`buildActionPlanItems()` currently copies every non-fulfilled category finding
into exactly one item. `action_plan_items` has one `source_finding_id`, and a
unique index on `(action_plan_id, source_finding_id)` prevents multiple actions
for one category.

There is no relation between a plan item and an individual gap because
individual gaps are not persisted yet.

### Plan creation is synchronous and deterministic

`POST /api/organizations/:organizationId/action-plan` currently approves the
Gap revision and creates the plan in one database transaction without an AI
call. The client expects `201` and immediately navigates to the Action Plan.

The new design requires a separate background generation job, a `202`
response, job polling, retry behavior, and exactly-once final persistence.

### Customer ordering is not yet category-first

Gap cards are currently sorted by status before release position, and the
default `all` filter excludes fulfilled categories. Action items are sorted
globally by priority. Both conflict with the confirmed category-first
presentation.

## Target Domain Model

Use three distinct concepts:

```text
Category Finding
  deterministic assessment of one category in one Gap revision

Atomic Gap
  one short missing, partial, or uncertain fact derived from one trigger

Action
  one practical task that addresses one or more Atomic Gaps in one category
```

Their relationships are:

```text
Category Finding 1 ─── * Atomic Gap
Category Finding 1 ─── * Action
Atomic Gap       * ─── * Action
```

The category finding owns assessment state and sources. Atomic gaps own the
customer-visible Gap Analysis prose. Actions own the customer-visible Action
Plan prose.

## Target Generation Flow

### Gap generation

```text
pinned questionnaire, documents, legal release
                    |
                    v
deterministic category evaluation and trigger policy
                    |
                    v
grounded Gap AI operation
  - no action fields
  - 1..5 statements per trigger
  - no statements for satisfied questions
  - optional concise review notice
                    |
                    v
schema + policy + grounding + locale + style validation
                    |
                    v
persist category finding, atomic gaps, sources, and provenance
```

### Action Plan generation

```text
user selects Create action plan
                    |
                    v
validate current Gap revision and enqueue one background job
                    |
                    v
load finalized gaps and full pinned context per category
                    |
                    v
grounded Action Plan AI operation
  - 1..10 ordered actions per category
  - many-to-many gap references
  - title + result + recommended evidence
                    |
                    v
coverage + category + uncertainty + locale + style validation
                    |
                    v
atomic transaction:
  approve/accept Gap revision
  create active plan
  create actions and gap links
  record run/job/audit provenance
                    |
                    v
job succeeds and UI opens active plan
```

If the source revision has no gaps, skip the provider call and create an empty
active Action Plan deterministically.

## Target Data Model

Exact table names may follow repository conventions, but the following
semantics and constraints are required.

### `gap_findings`

Keep this as the category-level assessment record:

- `id`;
- `artifact_revision_id`;
- `requirement_version_id`;
- deterministic `status`;
- `evidence_sufficiency`;
- deterministic `severity`;
- versioned `statement_basis`;
- `statement_basis_hash`;
- nullable `review_notice`;
- `generation_run_id`;
- audit-only assumptions;
- `requires_review`; and
- timestamps.

Remove the mixed guidance/action fields:

- `guidance_mode`;
- `rationale`;
- `recommendation`;
- `objective`;
- `deliverables`;
- `acceptance_criteria`; and
- `suggested_evidence`.

Keep the unique category identity on
`(artifact_revision_id, requirement_version_id)`.

Add checks:

- `statement_basis` is the expected versioned object;
- fulfilled findings have zero child gaps;
- non-fulfilled findings receive complete trigger coverage in service
  validation;
- `requires_review=true` requires a nonblank `review_notice`;
- `requires_review=false` requires `review_notice` to be null.

The child-count rules cannot be expressed safely as row checks; enforce them
in the persistence service inside the same transaction and cover them with
integration tests.

### `gap_items`

Add one row per atomic customer-visible gap:

- `id`;
- `finding_id`;
- `source_assessment_answer_id`;
- `question_stable_key`;
- server-owned `kind`: `missing`, `partial`, or `uncertain`;
- localized `statement`;
- one-based `position` within the category;
- timestamps.

Constraints and indexes:

- foreign key to the parent `gap_findings` row;
- foreign key to the exact assessment answer;
- unique `(finding_id, position)`;
- unique `(finding_id, id)` for composite downstream references;
- nonblank one-line statement;
- index on `source_assessment_answer_id`.

The service must prove that:

- the answer belongs to the assessment revision pinned by the Gap revision;
- the question belongs to the parent requirement/category;
- the question is a server-owned trigger;
- `kind` matches the effective answer/correction policy;
- each trigger owns between one and five rows;
- no satisfied question owns a row; and
- model array order becomes deterministic stored position.

For an all-`not_applicable` category, retain the current policy that treats
each question as an uncertainty trigger.

### Per-gap traceability

Keep `gap_finding_evidence` as the deduplicated category source set shown by
the UI.

Add `gap_item_evidence`:

- `gap_item_id`;
- `gap_finding_evidence_id`;
- primary key across both IDs.

Use composite foreign keys or service validation to ensure that the linked
evidence belongs to the same parent finding as the gap.

Every gap must link to its questionnaire-answer evidence. Additional admitted
document or legal citations may be linked when they support the statement's
specificity. The customer read model continues to collapse these into one
category-level **Sources used** list.

### `action_plans`

Keep the current active-plan lifecycle and source Gap revision.

Add:

- nullable `generation_run_id`, populated for non-empty generated plans;
- `generation_job_id`, non-null and unique for job-generated plans.

The empty-plan path may have a null AI run but must still reference its
successful generation job.

### `action_plan_items`

Keep:

- `id`;
- `action_plan_id`;
- `source_finding_id` as the owning category;
- generated `title`;
- deterministic `priority`;
- editable `status`;
- editable `owner_user_id`;
- editable `due_date`;
- editable `execution_notes`;
- optimistic-concurrency version; and
- timestamps.

Replace the current generated guidance fields with:

- `result`, nonblank text;
- `suggested_evidence`, non-empty JSON array of short strings;
- `position`, one-based within its category.

Remove:

- `measure_type`;
- `source_recommendation`;
- `objective`;
- `deliverables`; and
- `acceptance_criteria`.

Remove the unique `(action_plan_id, source_finding_id)` constraint so a
category may contain several actions. Replace it with:

- unique `(action_plan_id, source_finding_id, position)`;
- unique `(id, source_finding_id)` for composite link integrity; and
- useful indexes for plan/category ordering and status.

### `action_plan_item_gaps`

Add the many-to-many relation:

- `action_plan_item_id`;
- `gap_item_id`;
- `source_finding_id`.

Use composite foreign keys:

- `(action_plan_item_id, source_finding_id)` references the action's category;
- `(gap_item_id, source_finding_id)` references the gap's category.

This makes cross-category links impossible at the database boundary.

Use `(action_plan_item_id, gap_item_id)` as the primary key and index
`gap_item_id` for coverage queries.

### AI and job provenance

Add `action_plan_generation` to `ai_operation_kind`.

Extend `background_job_results` with `action_plan_id`, its foreign key and
index, and include it in the exactly-one-result check. Extend
`toJobResultValues()` with the `action_plan` result kind.

Add a partial unique index that permits only one queued/running/cancelling
`action-plan-generation` job per organization.

Pin Action Plan prompt metadata on the immutable Gap release:

- prompt name;
- prompt version;
- prompt template hash; and
- response schema version.

Record the source assessment revision, document-version inputs, pinned Gap
release/corpus set, locale, model, rendered input hash, and admitted grounding
context through the existing AI processing-run provenance tables.

## Prompt and Response Contracts

### Gap contract v7

Create new immutable modules, for example:

- `src/server/gap-analysis/prompt-contract-v7.ts`;
- `src/server/gap-analysis/generation-schema-v7.ts`; and
- `src/server/gap-analysis/releases/guided-v6/release.ts`.

After guided-v6 owns the reset database, delete superseded runtime branches
and contract adapters that are no longer referenced by the reseeded release
registry. Historical development rows and their old response shapes do not
need to remain readable.

The model response remains one strict object per category, but actionable
categories return arrays keyed by the exact server-supplied trigger keys:

```ts
type GapResponse = {
  findings: Record<
    RequirementCode,
    {
      gaps?: Record<
        TriggerQuestionStableKey,
        Array<{
          statement: string;
          citations: CitationId[];
        }>
      >;
      evidenceSufficiency: "sufficient" | "partial" | "none";
      reviewNotice?: string;
      assumptions: string[];
      citations: CitationId[];
      contradictions: string[];
      requiresReview: boolean;
      legalCitation: CitationId;
    }
  >;
};
```

The response must not include status, gap kind, work kind, priority,
recommendations, objectives, deliverables, acceptance criteria, or suggested
evidence.

Build the schema dynamically from the server policy:

- fulfilled category: no `gaps` field;
- non-fulfilled category: exact trigger keys only;
- each trigger array: minimum 1, maximum 5;
- no unknown or satisfied question key;
- statement citations drawn only from that category's admitted context;
- missing organization evidence still forces
  `evidenceSufficiency=none`;
- unresolved contradiction forces `requiresReview=true` and a review notice;
- no review notice when review is not required; and
- legal citation remains in the mapped primary-authority set.

Emit each atomic gap as its own binding grounded claim. Do not validate the
whole category gap array as one bundled prose claim.

### Gap style validator

Centralize deterministic style checks in one pure module and reuse it for
initial generation and correction/regeneration:

- trim surrounding whitespace;
- exactly one nonblank line;
- one sentence;
- at most 20 lexical words and a conservative character ceiling;
- no bullets or headings;
- no URLs or citation IDs;
- no evidentiary preambles such as “No independently admitted evidence...”;
- no recommendation verbs or “should/must implement” language;
- missing, partial, and uncertain wording agrees with the server-owned kind;
- uncertain wording must not claim absence; and
- localized prose passes the existing language policy.

Use prompt rules and grounded-claim evaluation for semantic requirements that
cannot be proven by syntax, especially non-overlap and unsupported
specificity. Add manual evaluation rubrics for those properties.

### Action Plan contract v1

Add a dedicated module boundary, for example:

- `src/server/action-plans/prompt-contract.ts`;
- `src/server/action-plans/generation-schema.ts`; and
- `src/server/action-plans/generation-service.ts`.

The query for each category supplies opaque model-facing gap keys rather than
database IDs:

```ts
type ActionPlanResponse = {
  categories: Record<
    RequirementCode,
    {
      actions: Array<{
        title: string;
        result: string;
        suggestedEvidence: string[];
        gapKeys: GapKey[];
        citations: CitationId[];
      }>;
    }
  >;
};
```

Array order is the AI-proposed execution order. The server assigns stored
positions and priority.

Build a category-specific schema:

- exact category keys;
- empty actions only when the category has no gaps;
- 1–10 actions for a category with gaps;
- 1 or more allowed gap keys per action;
- no gap key from another category;
- every gap key appears in at least one action;
- duplicate use of a gap across actions is allowed;
- every action cites only admitted context;
- all generated prose is in the pinned locale.

For actions linked to uncertain gaps:

- title and result start from verification rather than assumed absence;
- remediation is conditional on a deficiency being confirmed;
- if the AI splits verification and remediation, ordering places verification
  first and the later action remains explicitly conditional.

### Action style validator

Use one shared pure validator:

- title: one short imperative line, no category preamble;
- result: one or two plain-language sentences describing the completed state;
- suggested evidence: one or more short names of concrete artifacts;
- no legal analysis;
- no assessment rationale;
- no acceptance-criteria labels;
- no repeated gap explanation;
- no raw identifiers; and
- pinned-locale validation.

Initial safety ceilings should be explicit constants covered by tests, for
example:

- title: 12 words / 120 characters;
- result: 40 words / 320 characters;
- suggested evidence: 1–5 entries, each 12 words / 120 characters.

## Server Modules and Interfaces

### Atomic Gap generation

Refactor the existing `generateGapGuidance()` seam into an atomic-gap
generation seam. The public result should resemble:

```ts
type ValidatedCategoryGapResult = {
  requirementCode: string;
  statementBasis: GapStatementBasis;
  statementBasisHash: string;
  evidenceSufficiency: EvidenceSufficiency;
  gaps: Array<{
    questionStableKey: string;
    sourceAssessmentAnswerId: string;
    kind: "missing" | "partial" | "uncertain";
    statement: string;
    citationIds: string[];
  }>;
  reviewNotice: string | null;
  assumptions: string[];
  citationIds: string[];
  requiresReview: boolean;
  legalCitationId: string;
};
```

The server derives `kind` from the effective trigger answer:

- `not_implemented` -> `missing`;
- `partially_implemented` -> `partial`;
- `unsure` or all-not-applicable verification -> `uncertain`.

The AI does not return or choose it.

### Action generation

Expose one deep service:

```ts
generateActionPlanContent(input: {
  actor: { userId: string };
  organizationId: string;
  sourceGapRevisionId: string;
  outputLocale: "de" | "en";
  jobId: string;
  idempotencyKey: string;
}): Promise<ValidatedActionPlanContent>
```

The service owns:

- loading the immutable source revision and pinned release;
- loading category findings, atomic gaps, and all category answers;
- loading the exact selected document versions;
- constructing full-category grounded queries;
- the action response schema;
- category and coverage validation;
- uncertainty policy;
- style and locale validation;
- AI run provenance; and
- normalized immutable action content.

Keep persistence in a separate transaction seam:

```ts
activateGeneratedActionPlan(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
  jobId: string;
  runId: string | null;
  content: ValidatedActionPlanContent;
}): Promise<ActionPlan>
```

The persistence seam must recheck:

- source revision is still current;
- sources are not stale or archived;
- release and output locale still match;
- no review blocker remains;
- no active plan exists;
- this job is the active generation reservation;
- normalized content covers exactly the persisted gaps; and
- the job/run has not already materialized another plan.

It then approves and accepts the Gap revision and creates the plan, actions,
and links atomically.

### Exactly-once job behavior

Add an `action-plan-generation` worker handler and register it in
`src/worker/runtime.ts`.

Store `generation_job_id` on the plan. On a worker retry after persistence but
before generic job completion, return the already-created plan for that same
job instead of creating another plan.

While the job is queued, running, or cancelling, treat the source Gap revision
as temporarily reserved:

- block category correction;
- block gap regeneration;
- block reassessment activation; and
- block a second Action Plan generation job.

Release that transient reservation automatically when the job fails or is
cancelled. The Gap Analysis becomes permanently locked only when the active
plan is successfully created.

## API and Client Changes

Change `POST /api/organizations/:organizationId/action-plan`:

- keep manager/activation permission and request idempotency;
- validate the current Gap revision, staleness, review blockers, and absence of
  another plan/job;
- enqueue `action-plan-generation`;
- store the idempotency result as `backgroundJobId`;
- return `202` with the job DTO and `reused`;
- replay the same job for the same idempotency command.

The worker result exposes the generated `actionPlanId` through the authorized
job endpoint. A failed job returns only safe error information.

Update:

- `src/contracts/action-plans/index.ts`;
- `src/client/action-plans.ts`;
- the Gap result finalization dialog;
- job polling and retry behavior; and
- route tests.

The UI should keep the user on the Gap Analysis while generation runs, show
progress, allow a safe retry after terminal failure, and navigate to the
Action Plan after the job reports the plan result.

## Read Models and UI

### Gap results

Change the customer projection to return:

```ts
{
  finding: {
    id;
    status;
    severity;
    requiresReview;
    reviewNotice;
    gaps: Array<{ id; statement }>;
  };
  requirement: { title; position };
  sources;
}
```

Do not expose the old rationale, recommendation, objective, deliverables,
criteria, evidence arrays, answer IDs, gap kind, or citation IDs.

Update `FindingCard`:

- category title and status remain;
- render the atomic statements as the primary bullet list;
- render **No gaps identified** for fulfilled categories;
- render the concise review notice only when required;
- keep correction controls and one category-level source section;
- remove every action-guidance section.

Change category ordering to release position only. Status filters continue to
count and filter categories, but do not reorder them. The default **All**
filter includes fulfilled categories.

Rename customer copy such as **Regenerate guidance** to **Regenerate gaps**.

### Action Plan

Return a category-grouped read model in release order:

```ts
{
  categories: Array<{
    requirementVersionId;
    title;
    position;
    actions: ActionItem[];
  }>;
}
```

Within each category, order by stored action position. Do not globally sort by
priority.

Each action card renders:

- generated title;
- priority badge;
- **Result**;
- **Recommended evidence**;
- editable status, owner, due date, and notes.

Do not render source recommendation, measure type, objective, deliverables, or
acceptance criteria. Gap links stay audit-only for now.

### Downstream readers

Update narrow column projections and types in:

- dashboard service;
- action-plan service;
- report snapshot/render dependencies;
- page and workflow readers;
- manual evaluation scripts;
- lifecycle evaluations; and
- Drizzle schema verification tests.

The dashboard may continue to report category finding counts and action item
counts. Do not silently change a category count into an atomic-gap count
without a separate product decision.

Update:

- `docs/product/gap-analysis-current-workflow.md`;
- `CONTEXT.md` terminology if needed; and
- German and English module dictionaries.

## Corrections and Revision Copying

Preserve category-level reviewer corrections.

For a material correction or explicit pre-plan regeneration:

1. load the source category and its effective trigger policy;
2. run the v7 atomic-gap generator for that category;
3. validate all atomic statements and sources;
4. create the new immutable Gap revision atomically;
5. persist the regenerated category finding, gap rows, and evidence links;
6. copy unchanged category findings and their children;
7. remap copied gap-to-evidence links by stable citation identity; and
8. advance the current revision only after the complete copy succeeds.

The correction API continues to accept only structured assessment facts and
review reasons. It never accepts customer-authored gap text.

If any Action Plan generation job currently reserves the source revision, the
correction/regeneration command fails with a safe conflict. Once a plan is
active, preserve the permanent Gap lock.

## Server-Side Invariants

1. Category status remains deterministic and server-owned.
2. Category severity and action priority remain server-owned.
3. Triggering and satisfied questions remain server-owned.
4. Every trigger owns 1–5 atomic gaps.
5. Satisfied questions own zero gaps.
6. Every gap belongs to exactly one trigger and one category.
7. Gap kind is derived from the effective answer, never selected by the AI.
8. Each gap is one short plain-language fact with no action content.
9. Partial answers do not produce unsupported specific deficiency claims.
10. Uncertain answers never produce confirmed-absence wording.
11. Fulfilled categories have no gaps and show deterministic empty copy.
12. Category sources remain grounded, mapped, and customer-safe.
13. Unresolved contradictory evidence blocks plan generation and has a
    concise separate review notice.
14. Action generation uses the exact current, non-stale Gap revision.
15. An action cannot link to a gap from another category.
16. Every gap is linked to at least one action.
17. Every action is linked to at least one gap.
18. One category contains at most ten actions.
19. Action order comes from validated response array order.
20. Actions inherit source-category severity.
21. Uncertain-gap actions verify first and express remediation conditionally.
22. Gap content and action content are generated in separate AI runs.
23. No Action Plan AI output is stored on `gap_findings` or `gap_items`.
24. Failed/cancelled action generation creates no plan or plan items.
25. Successful persistence creates one active plan exactly once per job.
26. Generated gap and action content is immutable.
27. Only action status, owner, due date, and execution notes are mutable.
28. All generated text uses the pinned result locale.
29. Raw identifiers and model diagnostics remain outside customer read models.

## Implementation Sequence

Each phase should be a small reviewable commit or short commit series. Keep
schema, domain rules, persistence, and UI changes compiling together where a
temporary state would otherwise be invalid.

### Phase 1: Lock the new contracts with failing pure tests

Add tests for:

- one to five gaps for every trigger;
- zero gaps for satisfied questions;
- rejection of unknown question keys;
- rejection of six gaps for one trigger;
- missing/partial/uncertain kind derivation;
- one-sentence and 20-word gap limits;
- rejection of recommendation/evidentiary prose in a gap;
- review-notice consistency;
- exact mapped citation rules;
- Action Plan many-to-many coverage;
- allowed combine and split cases;
- rejection of uncovered gaps and orphan actions;
- rejection of cross-category links;
- rejection of eleven actions in a category;
- action style limits;
- server-owned priority/order normalization; and
- verification-first uncertain actions.

Prefer pure contract/policy tests before database or route tests.

### Phase 2: Introduce the new schema

- Add atomic gap, traceability, and action-gap link tables.
- Replace mixed `gap_findings` and `action_plan_items` columns.
- Add action generation run/job provenance.
- Extend background job result support.
- Add composite integrity constraints and indexes.
- Delete old-schema columns, checks, query projections, builders, and
  compatibility paths rather than migrating their data.
- Update Drizzle schema tests, RLS allowlists, destructive clear ordering, and
  integrity verification.
- Update the existing `src/server/operator-commands/clear-db.ts` path and
  related scripts so all new tables are cleared in foreign-key-safe order.
- Clear the expendable database, review the Drizzle preview, and push the
  replacement schema directly.

### Phase 3: Publish the guided-v6 Gap contract

- Add prompt contract v7 and its strict response schema.
- Add the atomic Gap style validator.
- Normalize model output into server-owned gap kinds and source answer IDs.
- Emit one grounded claim per atomic gap.
- Add the immutable guided-v6 release definition and registry entry.
- Extend release publication/verification for the pinned Action Plan prompt
  metadata.
- Remove old prompt/schema dispatch and release-registry entries that are no
  longer part of the supported reseed. Keep only code that the new reset
  baseline actually publishes or verifies.

### Phase 4: Persist and read atomic gaps

- Replace structured action guidance persistence with category plus child-gap
  persistence.
- Load child gaps and traceability in batched page queries.
- Update review blockers, correction, regeneration, revision copying, history,
  safe projection, and staleness behavior.
- Update the Gap UI and i18n copy.
- Ensure fulfilled categories appear in the default view.

### Phase 5: Add separate Action Plan generation

- Add the Action Plan prompt/schema/style modules.
- Build full-category generation context from the pinned source revision.
- Add job enqueue, handler, retry, cancellation, provenance, and exactly-once
  persistence.
- Split enqueue-time validation from worker-time revalidation.
- Add the transient source-revision reservation to lifecycle guards.
- Change the API from synchronous `201` plan creation to asynchronous `202`
  job creation.
- Remove `buildActionPlanItems()` and the deterministic copy path.

### Phase 6: Persist and display simplified actions

- Persist title, result, evidence, position, category, and gap links.
- Group plan reads by category/release position.
- Render the simplified action cards.
- Preserve editable workflow fields and audit payloads.
- Update dashboard, reports, client contracts, safe projections, and all
  generated-column selections.

### Phase 7: End-to-end QA and rollout

- Update the existing
  `evals/manual-gap-action-plan-evaluation.ts` evaluator in place for atomic
  gaps and independent Action Plan generation. Keep
  `scripts/manual-gap-action-plan-evaluation.ts` as its operator entrypoint.
- Add a stable package command such as `eval:gap-action-plan-manual` that runs
  that existing evaluator; do not create a disconnected replacement harness.
- Update the post-finalization lifecycle evaluation.
- Add English and German cases that cover:
  - fully mature categories;
  - one question split into multiple gaps;
  - several gaps combined into one action;
  - one gap split into ordered actions;
  - partial answers with no invented specificity;
  - uncertain verification-first work;
  - contradictory documents and review blocking;
  - generation retry/idempotency; and
  - failure after AI success but before generic job completion.
- Have the evaluator execute the real worker path for both AI stages:
  - Gap generation;
  - Action Plan generation.
- Capture the exact provider-produced, validated output and persisted customer
  projection for every case, including:
  - category status and review notice;
  - every atomic gap with its source question and hidden citation trace;
  - every action title, result, recommended-evidence list, category, order,
    priority, and linked gap keys;
  - both AI run IDs and pinned prompt/schema/provider metadata;
  - job, retry, idempotency, and finalization results.
- Write those artifacts to a timestamped
  `docs/qa/gap-action-plan-manual-evaluation-*` directory, preserving the
  existing manifest/report pattern.
- Generate a manual-review checklist/report that requires a human to inspect
  the actual AI prose rather than accepting structural assertions alone.
- Manually inspect every produced gap and action in both locales for:
  - plain, readable language;
  - atomic and non-overlapping gaps;
  - truthful missing/partial/uncertain wording;
  - no action content in the Gap Analysis;
  - no unsupported specificity;
  - sensible action combining and splitting;
  - same-category gap coverage;
  - clear results and concrete evidence names;
  - verification-first uncertain work; and
  - no reappearance of objective/deliverable/acceptance-criteria verbosity.
- Record pass/fail judgments and concrete excerpts in the QA report. A script
  exit code or schema pass is not a substitute for this manual content review.
- Run unit, integration, route, worker, schema, i18n, safe-projection, and
  manual content-quality checks.
- Clear and rebuild the expendable database only through the updated existing
  reset/reseed scripts.
- Seed and approve the pinned legal corpus through the existing reusable
  scripts.
- Update
  `docs/database/development-database-reset-and-bootstrap.md`,
  `docs/database/supabase-security-runbook.md`, and the current-workflow
  documentation so their reusable commands and release references describe
  guided-v6 rather than guided-v5.
- Publish guided-v6 without activating it.
- Run the complete guided-v6 QA evidence suite against the exact published
  prompt/schema/provider metadata.
- Activate only after an unconditional pass.

## Required Verification

At minimum:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:i18n
npm.cmd run test:worker
npm.cmd run test:routes
npm.cmd run db:verify:integrity
npm.cmd run db:verify:server-only
```

Add the updated existing manual evaluator to the required verification:

```powershell
npm.cmd run eval:gap-action-plan-manual
```

The evaluator must produce inspectable JSON/Markdown artifacts. Review and
sign off those artifacts manually before activation, then include them in the
release evidence manifest.

The clean-database rollout should update and reuse the complete workflow in
`docs/database/development-database-reset-and-bootstrap.md`. In summary, it
must:

1. run the confirmation-guarded existing `db:clear`;
2. preview and apply the replacement Drizzle schema with the existing
   `db:push -- --explain` and `db:push` commands;
3. reapply the existing idempotent operator SQL and storage setup;
4. bootstrap the existing Auth user as Platform Administrator;
5. run the existing legal-corpus seed, worker, inspection, human approval,
   evaluation, and activation flow;
6. publish and activate the compatible compliance release;
7. run the existing Gap-to-corpus provision binding command;
8. publish guided-v6 through the existing Gap publication command;
9. verify guided-v6's requirement and mapped-authority coverage;
10. activate guided-v6 through the existing activation command; and
11. run the full database, storage, release, smoke, application, and manual AI
    verification gates.

Adjust the existing scripts when the new tables, release metadata, or seed
order require it. Do not introduce migration or legacy-compatibility steps
into this sequence. Run two independent clear-and-reseed cycles to prove it
remains a dependable workflow rather than succeeding only against incidental
state from the first run.

Do not activate the release until:

- every triggering answer has valid gap coverage;
- every generated gap passes plain-language review;
- every gap has Action Plan coverage;
- combine/split behavior remains within one category;
- uncertain actions are verification-first;
- no Gap customer payload contains action-plan prose;
- no Action Plan customer payload contains the removed detailed fields;
- retry and concurrency tests prove exactly-once plan creation; and
- the captured German and English AI outputs have both received an explicit
  human content-review pass.

## Acceptance Criteria

The change is complete when:

1. A category can display several atomic gaps.
2. One questionnaire answer can produce 1–5 distinct gaps.
3. A typical visible gap reads like `MFA is missing for privileged access.`
4. Gap cards contain no recommendation, objective, deliverables, acceptance
   criteria, or recommended evidence.
5. Fulfilled categories remain visible with **No gaps identified**.
6. Action generation makes a separate, provenance-recorded AI call.
7. One action can cover several same-category gaps.
8. One gap can be covered by several same-category actions.
9. Database constraints prevent cross-category action links.
10. Every gap is covered and every action is grounded in a gap.
11. Each action shows only title, result, recommended evidence, priority, and
    the existing editable workflow fields.
12. Categories and actions appear in the confirmed order.
13. Uncertain work never pretends a missing control is already confirmed.
14. Failed generation leaves no partial plan and can be retried.
15. Successful retry cannot create a duplicate plan.
16. Corrections regenerate immutable gap statements before plan creation.
17. Customer-safe projections expose neither raw grounding details nor hidden
    generation metadata.
18. The exact published guided-v6 release passes automated and manual QA in
    both supported locales before activation.
19. The database can be cleared and fully reseeded with the updated existing
    scripts, without migrations, backfills, or old runtime logic.
20. The updated existing manual Gap/Action Plan evaluator captures the real AI
    outputs for both generation stages and produces a human-reviewed QA report.
