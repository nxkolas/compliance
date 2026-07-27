# Gap Analysis and Action Plan Generation Reliability

Status: proposed on 2026-07-27 after a product-decision grilling session.

## Goal

Make Gap Analysis and Action Plan generation reliably complete without weakening
the safety, grounding, language, or audit requirements.

The current output is good when generation succeeds. The problem is the failure
boundary: one invalid field can reject a complete multi-category result, wait
before retrying, and regenerate all categories. The target design keeps hard
validation for correctness and safety while repairing presentation defects and
isolating AI generation by category.

Target outcomes:

- at least 98% first-pass validation per category;
- at least 99% end-to-end completion without user intervention;
- p95 generation time below 60 seconds for a standard 10-category assessment;
- active provider calls aborted within 3 seconds of cancellation;
- no whole-workflow retry caused only by a repairable style defect; and
- complete, safe diagnostics for every rejected category.

## Current Evidence

The repository's final manual QA cycle reproduces the reported behavior:

- `case-3-mixed-maturity-en.json` completed on attempt 2;
- `case-4-uncertain-evidence-de.json` completed on attempt 4;
- the German case ran from `2026-07-26T21:26:11.116Z` to
  `2026-07-26T21:30:19.701Z`, approximately 249 seconds;
- its final successful provider call took approximately 30 seconds; and
- both successful jobs retained `safeErrorCode: "JOB_FAILED"` from an earlier
  attempt.

The exact rules that rejected the failed candidates cannot be reconstructed
from the stored artifacts. Production-safe errors collapse most failures to
`JOB_FAILED`, while detailed schema issues are emitted only in non-production
debug mode.

Relevant current behavior:

- Action Plan jobs allow five whole-job attempts.
- Generic job failures wait 30 seconds before another attempt.
- Provider structured generation uses `maxRetries: 0`.
- language mismatch validation may make a second complete provider call;
- Gap generation is performed as one multi-category batch;
- Action Plan generation is performed as one multi-category batch;
- important style and semantic rules are implemented in Zod `superRefine`
  callbacks and are therefore not enforceable provider JSON Schema rules;
- the model selects citations even when mandatory provenance is already known
  by the server; and
- cancellation is checked by the job lifecycle but is not propagated into the
  active provider request.

The focused unit tests prove that current validators reject prohibited output.
They do not measure first-pass generation reliability, retry cost, or false
rejection rates.

## Agreed Product Decisions

1. Hard blockers remain for safety, correctness, language, grounding, and
   provenance.
2. Presentation defects are normalized or repaired instead of discarding the
   entire result.
3. Gap Analysis and Action Plan generation are isolated by category.
4. Two or three category calls may run concurrently.
5. Final Gap revisions and Action Plans remain atomically persisted.
6. Mandatory questionnaire and legal citations are assigned by the server.
7. Uncertain actions use structured verification and conditional-remediation
   fields rather than free-prose regex inference.
8. Each triggering answer creates exactly one atomic gap by default.
9. Multiple gaps for one answer require an explicit splittable-question policy
   in the immutable release.
10. Validation retries repair only the affected category and receive exact
    validation feedback.
11. Provider retries are limited to transient failures.
12. Gap prompt v8 and Action Plan prompt v2 are new immutable contracts.
13. Historical v7/v1 results remain readable under their pinned metadata.

## Target Generation Flow

```text
Pinned deterministic input snapshot
             |
             v
     Build independent category tasks
             |
             v
  Run with bounded concurrency (default 3)
             |
             v
 Provider-visible structural validation
             |
             v
   Safe deterministic normalization
             |
             v
 Safety, grounding, and language validation
             |
       +-----+-----+
       |           |
     valid      repairable
       |           |
       |     repair this category once
       |           |
       +-----+-----+
             |
             v
 Atomically persist the complete revision/plan
```

Successful categories are recoverable by their idempotency keys. If a worker
loses its lease or encounters a transient provider failure, it must reuse
already validated category outputs instead of regenerating them.

## Validation Policy

### Hard blockers

These conditions must never be normalized into acceptance:

- an unexpected or missing category key;
- an unexpected gap key or cross-category gap reference;
- missing gap coverage;
- an action with no source gap;
- an unsupported or cross-category supporting citation;
- a grounded claim without the required authority or organization source;
- generated prose in the wrong pinned locale;
- a confirmed-absence statement for an uncertain input;
- unconditional remediation attached to an uncertain gap;
- legal analysis in customer-visible operational action prose;
- output that conflicts with the immutable source snapshot; and
- stale release, revision, permission, or generation-reservation state.

A content hard blocker is eligible for one targeted category repair. An input,
permission, release, or reservation blocker is terminal immediately.

### Safe normalization

The server may normalize these defects without another provider call:

- leading and trailing whitespace;
- repeated spaces;
- harmless line wrapping where a field is defined as one line;
- duplicate citation IDs;
- duplicate gap keys;
- duplicate suggested-evidence names after locale-aware normalization; and
- a missing final period when adding it cannot change meaning.

Every normalization must be deterministic, covered by tests, and recorded in
generation diagnostics.

### Targeted content repair

These defects require a category repair rather than blind truncation:

- title, result, statement, or evidence text over its word or character limit;
- too many sentences;
- unclear or malformed operational prose;
- incomplete category gap coverage;
- invalid uncertain-action structure;
- a confident output-language mismatch; and
- unsupported optional organization-document citations.

The repair prompt receives:

- the original pinned category input;
- the rejected candidate category;
- stable issue codes and field paths;
- the same response schema and locale; and
- an instruction to change only the rejected category.

The repair path gets one attempt. A second content validation failure ends the
job with a specific safe failure code rather than entering a generic retry
loop.

## Gap Contract v8

### Responsibilities

The deterministic evaluator continues to own:

- category status;
- severity;
- triggering and satisfied questions;
- source assessment answer IDs;
- atomic gap kind (`missing`, `partial`, or `uncertain`);
- mapped legal provisions; and
- whether a question may produce more than one statement.

The model owns only customer-visible gap wording, evidence interpretation fields
that cannot be derived deterministically, and material contradiction reporting.

### Category response

Conceptual provider response:

```ts
type GapCategoryResponseV8 = {
  requirementCode: string;
  gaps: Record<
    QuestionStableKey,
    Array<{
      statement: string;
      supportingOrganizationCitationIds: string[];
    }>
  >;
  evidenceSufficiency: "sufficient" | "partial" | "none";
  reviewNotice: string | null;
  assumptions: string[];
  contradictions: string[];
  requiresReview: boolean;
};
```

`requirementCode` may be omitted from the provider payload if the category is
already encoded as the only schema key. It must never be freely generated.

Mandatory citations do not appear in the provider response:

- each statement automatically receives its exact questionnaire-answer
  citation;
- the category automatically receives its preferred mapped primary legal
  citation; and
- the model may select only optional organization-document citations admitted
  for that category.

### Statement cardinality

The default response schema requires exactly one statement for each triggering
question.

An immutable release may mark a question as splittable and provide a bounded
maximum. The schema then exposes that exact bound. The model never decides
whether a question is splittable.

### Provider-visible constraints

Express structural constraints directly in JSON Schema wherever supported:

- exact category and trigger properties;
- required properties;
- `additionalProperties: false`;
- enum values;
- array minimum and maximum sizes;
- string `minLength` and `maxLength`; and
- optional supporting citation enums.

Word counts, semantic kind consistency, and sentence meaning remain
server-validated. The prompt and schema descriptions must describe the same
rules and use locale-specific examples.

## Action Plan Contract v2

### Server-owned values

The server owns:

- requirement/category identity;
- priority;
- final action position;
- mandatory questionnaire and legal citations;
- source finding and gap database IDs;
- output locale;
- status, owner, due date, and execution notes; and
- final persistence metadata.

The model may group several same-category gaps into one action or split one
confirmed gap across ordered actions. Every gap must remain covered.

### Discriminated action response

Conceptual provider response:

```ts
type ActionPlanCategoryResponseV2 = {
  actions: Array<
    | {
        mode: "remediation";
        gapKeys: GapKey[];
        title: string;
        result: string;
        suggestedEvidence: string[];
        supportingOrganizationCitationIds: string[];
      }
    | {
        mode: "verification";
        gapKeys: GapKey[];
        verificationTitle: string;
        verificationResult: string;
        conditionalRemediation: string | null;
        suggestedEvidence: string[];
        supportingOrganizationCitationIds: string[];
      }
  >;
};
```

Rules:

- an action linked to an uncertain gap must use `mode: "verification"`;
- a verification action cannot contain unconditional remediation;
- confirmed missing or partial gaps use `mode: "remediation"`;
- uncertain gaps cannot be grouped with confirmed gaps in the same action;
- `conditionalRemediation` contains only the remediation content, not the
  condition itself; and
- the server renders the localized condition, for example:
  `If verification identifies a deficiency, ...`.

This structure makes the central uncertainty safety rule enforceable without
depending on a broad German/English regex.

### Citation projection

For each action, the server derives mandatory provenance from its `gapKeys`:

- exact questionnaire citations from the covered gaps; and
- the preferred mapped primary legal citation for the category.

Optional organization-document citations remain restricted to category context
and are validated before projection.

## Category Coordinator

Add a shared coordinator used by both workflows.

Responsibilities:

- receive one immutable source snapshot;
- create stable category task IDs;
- execute tasks with a configurable concurrency limit, defaulting to 3;
- stop scheduling work after terminal failure or cancellation;
- recover previously validated category outputs;
- normalize and validate each category;
- invoke at most one targeted content repair per category;
- aggregate token usage, duration, and repair diagnostics;
- verify complete category coverage before persistence; and
- return ordered normalized content without writing partial customer artifacts.

Idempotency should include:

- workflow operation;
- immutable source revision or draft ID;
- release and prompt contract versions;
- output locale;
- category code;
- generation phase (`initial` or `repair`); and
- provider attempt where required for transient retry uniqueness.

Validated category outputs may use the existing AI processing-run recovery
mechanism or a small category-attempt persistence model. The chosen design must
allow a retried worker to reuse completed categories.

## Retry Classification

Introduce an explicit generation failure taxonomy.

| Failure class | Examples | Behavior |
|---|---|---|
| `repairable_style` | length, punctuation, sentence count | normalize or repair category once |
| `repairable_content` | coverage, language mismatch, uncertain structure | repair category once |
| `transient_provider` | timeout, 429, temporary 5xx, connection reset | retry provider up to two times |
| `terminal_input` | stale revision, unsupported contract, missing pinned source | fail immediately |
| `terminal_policy` | permission or provider-policy denial | fail immediately |
| `cancelled` | user cancellation | abort active work and finalize cancellation |

Transient retry rules:

- honor provider `Retry-After` when present;
- otherwise use short exponential backoff with jitter;
- do not apply the generic 30-second content-validation delay;
- ensure provider and job retry layers do not multiply each other; and
- retain exactly-once materialization checks.

The top-level job may be retried only for transient infrastructure/provider
failures. Content repair happens inside the category coordinator.

## Cancellation

Create a job execution context containing an `AbortSignal`.

The worker must:

- monitor cancellation state at least frequently enough to meet the 3-second
  target;
- abort the shared controller when cancellation is requested;
- stop launching additional category tasks;
- combine job cancellation with the provider timeout signal;
- pass the combined signal into `generateObject`;
- treat the resulting abort as cancellation rather than generic failure; and
- preserve the current rule that no partial Gap revision or Action Plan is
  activated.

Cancellation checks before persistence remain required even after provider
abort support is added.

## Prompt Improvements

Gap v8 and Action Plan v2 prompts should:

- describe only the fields the model actually controls;
- remove duplicated grounding instructions;
- state that mandatory citations are server-owned;
- state exact category and statement cardinality;
- include separate German and English examples selected by output locale;
- use consistent terms across prompt, schema descriptions, validators, and UI;
- identify satisfied controls as immutable context that must not become work;
- avoid asking the model to repeat server-owned status or metadata; and
- keep repair instructions separate from initial-generation instructions.

The Action Plan prompt must not give English-only title starters for German
output. The German contract should provide natural German verification examples
and the English contract should provide English examples.

## Observability

Persist a safe structured diagnostic for every category attempt:

```ts
type GenerationDiagnostic = {
  stage:
    | "provider"
    | "schema"
    | "normalization"
    | "language"
    | "grounding"
    | "content"
    | "persistence";
  categoryCode: string;
  phase: "initial" | "repair";
  disposition:
    | "accepted"
    | "normalized"
    | "repair_requested"
    | "rejected"
    | "cancelled";
  issues: Array<{
    code: string;
    path: Array<string | number>;
  }>;
  durationMs: number;
};
```

Do not persist rejected generated prose in user-visible errors or logs.
Diagnostic issue codes and paths must be allowlisted.

Required metrics:

- category first-pass validation rate by contract, locale, model, and provider;
- normalized-category rate;
- repair-attempt and repair-success rate;
- failure rate by stage and issue code;
- provider latency and total workflow latency;
- input, cached-input, and output tokens;
- category count and gap count;
- cancellation acknowledgement and abort latency; and
- recovered-category reuse rate.

When a job succeeds:

- clear `safeErrorCode` and `safeErrorMessage`;
- expose no stale failure state in the authorized job DTO; and
- keep prior attempt diagnostics separately for operators.

## Persistence and Compatibility

Historical contracts remain immutable:

- Gap prompt/schema v7 remains readable;
- Action Plan prompt/schema v1 remains readable; and
- existing artifacts keep their original prompt hashes and versions.

New generation requires a newly published and activated Gap Analysis release
that pins:

- Gap prompt v8;
- Gap response schema v8;
- Action Plan prompt v2; and
- Action Plan response schema v2.

Do not mutate the hashes or contents of existing release contracts.

The final persistence transaction continues to verify:

- the source revision is current;
- pinned inputs remain available;
- release and locale match;
- review blockers are resolved;
- the job still owns the generation reservation;
- every source gap has valid action coverage;
- no unknown or cross-category gap is referenced;
- no active Action Plan already exists; and
- this job has not already materialized a result.

## Implementation Phases

### Phase 1: Diagnostics and baseline

- Add typed generation stages and stable issue codes.
- Preserve category, validation path, duration, and retry reason.
- Clear stale job errors after success.
- Add baseline reports for current v7/v1 QA scenarios.
- Add tests proving diagnostics never expose source excerpts or generated prose.

This phase should not change accepted output behavior.

### Phase 2: Failure-aware runtime

- Add terminal versus transient failure classification.
- Restrict generic job retry to transient failures.
- Honor `Retry-After` and use bounded backoff.
- Add the job cancellation signal and provider abort propagation.
- Add cancellation latency and retry-classification tests.

### Phase 3: Gap v8

- Add the v8 prompt, schema, normalization, and validation modules.
- Move mandatory questionnaire and legal citations out of model output.
- Require one statement per trigger by default.
- Add explicit release metadata for splittable questions.
- Add category-scoped Gap generation and recovery.
- Keep final Gap revision persistence atomic.

### Phase 4: Action Plan v2

- Add the v2 prompt and discriminated action schema.
- Project mandatory citations from covered gaps.
- Replace free-prose uncertainty inference with verification mode.
- Add category-scoped Action Plan generation and recovery.
- Preserve same-category grouping and ordered action splitting.
- Keep Action Plan activation atomic.

### Phase 5: Targeted repair and normalization

- Add the allowlisted safe normalizers.
- Add stable category repair prompts.
- Permit one repair attempt per rejected category.
- Ensure successful categories are never regenerated because another category
  failed validation.
- Add repair-loop exhaustion and recovery tests.

### Phase 6: Release qualification

- Publish the new immutable release without activating it.
- Run side-by-side v7/v1 and v8/v2 live evaluations.
- Perform independent English and German content review.
- Verify database integrity and historical projection.
- Activate only after all acceptance gates pass.

## Test Plan

### Unit tests

- provider-visible schemas contain all representable limits;
- exact category and trigger keys;
- one-gap default and explicit splittable bounds;
- deterministic mandatory citation projection;
- optional citation allowlists;
- safe normalization behavior and idempotence;
- hard blockers remain hard;
- discriminated remediation and verification actions;
- uncertain and confirmed gaps cannot be mixed in one action;
- complete action coverage;
- failure classification;
- issue-code allowlisting;
- stale job errors cleared after success; and
- combined timeout/cancellation abort behavior.

### Integration tests

- one invalid category repairs without rerunning valid categories;
- a failed repair leaves no partial revision or plan;
- worker retry recovers validated categories;
- concurrent category execution preserves release order;
- cancellation stops queued and active category work;
- transient provider retry does not duplicate persistence;
- terminal input errors do not retry;
- language mismatch repairs only the affected category;
- Gap and Action Plan finalization remain exactly once; and
- historical v7/v1 artifacts remain readable.

### Live qualification

Use at least:

- mature English baseline;
- absent-control English baseline;
- mixed missing, partial, and uncertain English inputs;
- uncertainty-heavy German inputs;
- contradictory organization evidence;
- long German compound-word and punctuation cases;
- mixed satisfied and triggering controls in one category;
- explicit splittable-question fixtures;
- provider timeout and 429 simulations; and
- cancellation during an active provider call.

The qualification sample must contain at least 100 category generations per
locale and multiple complete 10-category workflows. Production rollout metrics
must confirm the same targets over a larger observation window.

## Acceptance Gates

### Reliability

- at least 98% of categories pass initial validation;
- at least 99% of complete workflows finish without user intervention;
- no repairable style issue causes a whole-workflow retry;
- no valid category is regenerated because another category failed;
- successful recovery creates no duplicate artifact, revision, plan, or action;
  and
- successful jobs expose no stale failure code.

### Performance

- p95 complete generation below 60 seconds for the standard 10-category
  qualification fixture;
- validation-repair scheduling begins without the generic 30-second delay;
- category concurrency never exceeds its configured bound;
- cancellation aborts active provider work within 3 seconds; and
- token and latency results are reported separately for initial and repair
  attempts.

### Safety and content

- every Gap statement remains traceable to its source assessment answer;
- every category retains mapped primary legal authority;
- every Action Plan gap is covered;
- no action references a gap from another category;
- uncertain gaps never produce unconditional remediation;
- generated prose matches the pinned locale;
- no unsupported citation reaches persisted customer output;
- independent English and German review finds no material quality regression;
  and
- no partial customer artifact is visible after failure or cancellation.

## Expected Trade-offs

Category isolation increases provider request count and may repeat some prompt
prefix tokens. Bounded concurrency, provider prompt caching, category recovery,
and much smaller outputs should reduce tail latency and wasted regeneration.
Qualification must measure both total tokens and elapsed time.

Structured uncertainty may make some actions slightly more templated. That is
intentional: the condition is a safety invariant and should be server-enforced,
while the model still writes the verification and remediation content.

The design favors reliable, explainable completion over unconstrained prose
flexibility. It does not relax grounding, provenance, language, or immutable
release controls.
