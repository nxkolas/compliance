# Country Support and Gap-Eligibility Guard

Status: implemented and environment-verified on 2026-07-25. The disposable
development database was cleared, reseeded, republished, and smoke-tested.

This plan fixes the country-support dead end documented in
[`country-support-current-behavior.md`](../product/country-support-current-behavior.md).
The current release remains explicitly Germany-only, unsupported-country
Betroffenheitscheck results remain valid deterministic artifacts, and only
positive applicability results may enter Gap Analysis.

## Outcome

After this work:

1. all EU member states and **Unsure** remain available in the
   Betroffenheitscheck;
2. Germany remains the only country with a supported national NIS2 profile;
3. a non-German organization with relevant EU activity receives the existing
   `clarification_required` outcome and `unresolved_unsupported_profile`
   reason, together with a clear country-support explanation;
4. a non-German organization without relevant EU activity may still receive
   `not_directly_in_scope`;
5. only `essential_entity` and `important_entity` satisfy the Gap prerequisite;
6. an ineligible result cannot create a Gap assessment, enqueue generation, or
   lock Betroffenheitscheck recalculation;
7. a positive result with no applicable Gap requirements fails before an AI
   run or background job is created; and
8. the connected disposable development database is cleared and fully
   reseeded only after code-level verification passes.

The fix does not classify another country provisionally from the EU core and
does not claim that EU-level rules alone provide a supported national
determination.

## Confirmed Product Decisions

### Country boundary

- Treat the current Compliance release as Germany-only.
- Keep all 27 EU country options and `unsure` in the questionnaire so the user
  can state the actual competent jurisdiction.
- Keep `clarification_required` as the domain outcome for an unsupported
  country; identify the product state through
  `unresolved_unsupported_profile`.
- Do not introduce an `unsupported_country` applicability outcome.
- Preserve `not_directly_in_scope` when `eu_activity === "no"` because that
  conclusion does not require a national profile.
- Keep unsupported guest results claimable into an organization.

### Gap eligibility

- Define positive Gap eligibility as exactly:
  - `essential_entity`;
  - `important_entity`.
- Treat `not_directly_in_scope` and every `clarification_required` result as
  ineligible.
- Retain approved artifact status as “deterministic evaluation completed.”
  Do not reinterpret `approved` as positive applicability or Gap eligibility.
- Keep the Gap page and navigation visible for ineligible organizations, but
  render an explanatory blocked state with no Gap workflow actions.
- Enforce the same policy independently at page-read, assessment-creation,
  generation-enqueue, and worker-execution boundaries.
- Use HTTP `409` and `GAP_APPLICABILITY_NOT_ELIGIBLE` for a compatible,
  approved, but non-positive result. Include the outcome, country code, and
  unresolved reason codes in structured details.
- Keep missing, incompatible-release, unapproved, and malformed artifacts as
  distinct prerequisite failures.
- Reject a positive result with zero applicable requirements through a
  separate release-integrity guard.

### Recalculation and existing data

- A valid active Gap assessment created from a positive result locks
  Betroffenheitscheck recalculation immediately because it pins that result.
- An ineligible result must never create that assessment or lock.
- Do not build a legacy-data migration or converter.
- Clear and reseed the connected disposable development database after the
  implementation is verified.

### Country prefill

- Use a persisted questionnaire answer first.
- Otherwise prefill `jurisdiction_country` from the organization country only
  when its normalized code is one of the questionnaire's offered EU options.
- Otherwise leave the question unanswered.
- Never translate a non-EU organization country into `unsure`.
- Do not force equality between organization country and NIS2 jurisdiction.
- Do not update the organization country when the questionnaire answer changes.

### Product copy and actions

- Derive supported country codes from the pinned/active applicability release
  rather than hard-coding `DE` in UI conditionals.
- Localize country names and all blocked-state copy in German and English.
- On an unsupported result, show the normal result details plus a prominent
  Germany-only support notice.
- Offer only applicability-related navigation back to the overview or to
  recalculate. Guest claim and privacy/delete controls remain available because
  the guest result is still valid and claimable.
- Never show a Gap start or retry action for an ineligible result.
- Do not promise a future support date.

### Future country support

“Country supported” means the complete product slice exists:

- national applicability profile and entity catalog;
- positive and negative classification rules;
- Gap requirements;
- primary legal sources;
- corpus families and pinned evaluated releases;
- grounding jurisdiction policy;
- German and English product copy; and
- automated and database-backed tests.

This change will document and test the current Germany bundle. A general
cross-release validator is deferred until a second supported country makes the
required metadata shape concrete.

## Current Failure to Remove

The current path is:

```text
FR + EU activity
  -> approved clarification_required artifact
  -> boolean Gap prerequisite passes
  -> Gap assessment pins the ineligible artifact
  -> Betroffenheitscheck recalculation locks
  -> requirement filtering returns []
  -> schema construction throws
  -> UI offers a retry that repeats the deterministic failure
```

The important implementation gaps are:

- [`loadGapPrerequisiteState`](../../src/server/gap-analysis/postgres-page-data.ts)
  checks only compatible release and approved status;
- [`requireApprovedApplicabilityArtifact`](../../src/server/gap-analysis/assessment-service.ts)
  applies the same incomplete test;
- `createOrOpenGapAssessment` returns an existing assessment before evaluating
  the current applicability candidate;
- [`generateGapAnalysis`](../../src/server/gap-analysis/generation-service.ts)
  filters requirements by the pinned outcome but does not reject an ineligible
  outcome before building the grounded schema;
- [`enqueueDraftGeneration`](../../src/server/gap-analysis/reassessment-service.ts)
  creates a background job before the worker reaches the generation service;
- [`getApplicabilityRecalculationLock`](../../src/server/applicability-check/service.ts)
  locks on any historical Gap assessment, regardless of assessment status or
  pinned outcome; and
- [`buildGapModelResponseSchema`](../../src/server/gap-analysis/generation-schema.ts)
  is the first current empty-set guard, so a product prerequisite problem
  becomes a generic generation failure.

## Target Domain Model

### One pure eligibility policy

Add a small pure module, for example
`src/server/gap-analysis/applicability-eligibility.ts`, that owns:

```ts
const GAP_ELIGIBLE_OUTCOMES = [
  "essential_entity",
  "important_entity",
] as const;
```

It must parse persisted results through
`parseStoredRuleEvaluationResult`; do not continue the current loose
`{ outcome?: unknown }` reads.

The module should expose a discriminated result that separates artifact
validity from business eligibility:

```ts
type GapApplicabilityPrerequisite =
  | {
      status: "eligible";
      artifactRevisionId: string;
      outcome: "essential_entity" | "important_entity";
    }
  | {
      status:
        | "missing"
        | "release_incompatible"
        | "not_approved"
        | "invalid";
    }
  | {
      status: "not_eligible";
      reason:
        | "unsupported_country"
        | "clarification_required"
        | "not_directly_in_scope";
      artifactRevisionId: string;
      outcome: "clarification_required" | "not_directly_in_scope";
      countryCode: string | null;
      unresolvedFactCodes: string[];
    };
```

Reason precedence for a non-positive result is:

1. `unsupported_country` when `unresolvedFactCodes` contains
   `unresolved_unsupported_profile`;
2. `not_directly_in_scope` for that outcome;
3. otherwise `clarification_required`.

Provide assertion helpers that translate this result into stable `ApiError`
codes. `GAP_APPLICABILITY_NOT_ELIGIBLE` details must be customer-safe
structured values, not localized sentences:

```json
{
  "outcome": "clarification_required",
  "countryCode": "FR",
  "unresolvedFactCodes": ["unresolved_unsupported_profile"]
}
```

Suggested distinct prerequisite codes are:

- `GAP_APPLICABILITY_MISSING`;
- `GAP_APPLICABILITY_RELEASE_INCOMPATIBLE`;
- `GAP_APPLICABILITY_NOT_APPROVED`;
- `GAP_APPLICABILITY_INVALID`;
- `GAP_APPLICABILITY_NOT_ELIGIBLE`.

### Release-driven supported countries

Add a pure helper beside the applicability release-domain code that:

1. parses `ruleSet.rules` through `parseRuleSetDocument`;
2. selects `countryProfiles` whose `supported` flag is true;
3. returns sorted, unique uppercase country codes.

Use this helper for applicability result projection, Gap prerequisite
projection, release-bundle tests, and copy interpolation. The current result is
`["DE"]`.

Do not infer support from the questionnaire option list: that list deliberately
contains unsupported countries.

### Reasoned Gap prerequisite projection

Replace the page's boolean-only prerequisite with a customer-safe projection:

```ts
type GapPrerequisiteView =
  | {
      satisfied: true;
      status: "eligible";
      destination: string;
    }
  | {
      satisfied: false;
      status:
        | "missing"
        | "release_incompatible"
        | "not_approved"
        | "invalid"
        | "not_eligible";
      reason?:
        | "unsupported_country"
        | "clarification_required"
        | "not_directly_in_scope";
      outcome?: string;
      countryCode?: string | null;
      supportedCountryCodes: string[];
      destination: string;
    };
```

Keep `satisfied` during the change so existing workflow navigation remains
simple, but make the discriminants authoritative for copy and actions. Do not
project raw artifact JSON or legal/audit-only release fields to the client.

## Implementation Plan

### 1. Establish the pure country-support and eligibility primitives

Files:

- `src/server/applicability-check/` — add the release supported-country helper;
- `src/server/gap-analysis/applicability-eligibility.ts` — add the pure policy,
  result type, and assertions;
- `src/server/gap-analysis/index.ts` — export only the entry points needed by
  services and tests.

Work:

1. Parse both rule-set documents and stored evaluation results with their
   existing Zod schemas.
2. Centralize the two positive outcomes.
3. Distinguish artifact validity failures from non-positive business outcomes.
4. Emit the agreed structured `409` error for non-eligibility.
5. Add table-driven tests covering every artifact status, release match, and
   applicability outcome.

This slice must not change `approved` persistence semantics.

### 2. Make country support explicit in the applicability release and result

Files:

- `src/server/compliance/nis2/releases/2026-v1/release-source.ts`;
- `src/server/applicability-check/service.ts`;
- `src/contracts/applicability-check/index.ts`;
- `components/applicability-check/applicability-result-card.tsx`;
- authenticated and guest applicability result pages;
- `lib/i18n/messages/modules.ts`.

Work:

1. Replace the jurisdiction question help text that says other states are
   “initially checked against the EU core.” Explain instead that relevant EU
   activity can be classified nationally only for the countries marked
   supported by this release.
2. Add `supportedCountryCodes` to the questionnaire/result release projection.
   Both authenticated and guest result DTOs must use the same derivation.
3. Detect the unsupported-country presentation from the stable
   `unresolved_unsupported_profile` code in `result.evidence`, never from a
   localized sentence.
4. Render a prominent localized notice in the shared result card.
5. Keep the detailed clarification evidence visible below the notice.
6. Suppress Gap-specific affordances for non-positive outcomes. Preserve guest
   claim and delete controls.

Proposed copy:

| Context | German | English |
| --- | --- | --- |
| Result title | Dieses Land wird noch nicht unterstützt | This country is not supported yet |
| Result body | Diese Version unterstützt eine nationale NIS2-Einstufung und die Gap-Analyse derzeit nur für {countries}. Ihr Ergebnis wurde gespeichert, kann aber nicht als Grundlage für eine Gap-Analyse verwendet werden. | This release currently supports national NIS2 classification and Gap Analysis only for {countries}. Your result has been saved, but it cannot be used to start a Gap Analysis. |

Country names must come from the release-derived codes and current locale.

### 3. Add organization-country prefilling without changing authority

Files:

- `src/server/applicability-check/service.ts`;
- `src/contracts/applicability-check/index.ts`;
- `components/applicability-check/applicability-questionnaire-form.tsx`;
- relevant questionnaire service/component tests.

Work:

1. Extend the authenticated questionnaire DTO with `defaultAnswers` (or an
   equivalently explicit field); do not relabel defaults as persisted
   `latestAnswers`.
2. Read the authorized organization's normalized country in the questionnaire
   service.
3. Locate `bc.jurisdiction_country` and confirm that the code exists among that
   question's offered options.
4. Return a default only when no persisted answer exists for that question.
5. Initialize the form in this order:
   `defaultAnswers`, then `latestAnswers`.
6. Return no organization default for guest checks.
7. Do not persist the default until the user submits.

Tests must cover:

- prior answer overrides organization country;
- `FR` prefills when it is offered, even though it is unsupported;
- a non-EU code produces no selection;
- `unsure` is never synthesized from a non-EU organization country; and
- guest initialization remains empty.

### 4. Turn the Gap page prerequisite into a reasoned blocked state

Files:

- `src/server/gap-analysis/postgres-page-data.ts`;
- `src/server/gap-analysis/page-reader.ts`;
- `src/server/gap-analysis/workflow-reader.ts`;
- `src/contracts/gap-analysis/generation.ts`;
- `components/gap-analysis/gap-analysis-workflow.tsx`;
- `components/gap-analysis/types.ts`;
- `lib/i18n/messages/modules.ts`.

Work:

1. Load the current applicability artifact's status, check release, and stored
   result rather than only its ID.
2. Load supported-country codes from the compatible pinned applicability
   release.
3. Evaluate the shared prerequisite policy and project only the customer-safe
   view.
4. Preserve the existing page and navigation; do not redirect or hide Gap
   Analysis.
5. Render reason-specific cards:

   | Reason | User explanation | Action |
   | --- | --- | --- |
   | Missing | Complete the Betroffenheitscheck first | Start check |
   | Unsupported country | Current release supports only the listed countries | Review or recalculate |
   | Other clarification | Resolve the listed uncertainty first | Review or recalculate |
   | Not directly in scope | The current result does not qualify for Gap Analysis | View result |
   | Release/status failure | A current approved result is required | Run/check current assessment |

6. Keep `deriveGapWorkflowNavigation` driven by `satisfied`, but add tests that
   no direct URL can reveal or start workflow steps when the prerequisite is
   blocked.
7. Update the safe-projection test to prove raw stored result data is not leaked.

### 5. Reject ineligible assessment creation

Files:

- `src/server/gap-analysis/assessment-service.ts`;
- `app/api/organizations/[organizationId]/gap-analysis/assessments/route.ts`;
- `tests/gap-assessment-prerequisite.test.ts` and service-level tests.

Work:

1. Select the current applicability artifact with `result`, `status`, and
   `checkReleaseId`.
2. Evaluate eligibility before returning an existing active Gap assessment.
   This closes the current existing-assessment bypass.
3. Create and pin an assessment only for an eligible compatible artifact.
4. Preserve idempotent replay for a previously successful eligible creation.
5. Return the stable prerequisite errors through the existing API handler.
6. Do not insert an assessment or `gap_assessment.created` audit event on
   rejection.

The route response shape for successful positive results remains unchanged.

### 6. Reject ineligible or empty generation before enqueue

Files:

- `src/server/gap-analysis/reassessment-service.ts`;
- `src/server/gap-analysis/generation-service.ts`;
- `src/server/gap-analysis/generation-schema.ts`;
- generation/job contract tests;
- `lib/i18n/messages/modules.ts` and `components/gap-analysis/gap-error.ts`.

Work:

1. Before `enqueueDraftGeneration` locks the draft or inserts
   `background_jobs`, load:
   - the active Gap assessment;
   - its pinned applicability artifact;
   - the pinned Gap release.
2. Reapply the shared positive-outcome assertion.
3. Filter requirements for the positive outcome and require at least one.
4. For an empty set, return a stable product error such as
   `GAP_REQUIREMENTS_UNAVAILABLE`, with no background job, AI processing run,
   draft lock, or retry state.
5. Repeat both assertions inside `generateGapAnalysis` as worker-side
   defense-in-depth because jobs and data may outlive a web process revision.
6. Keep the low-level non-empty assertion in `buildGapModelResponseSchema`.
   It remains an internal invariant, not the normal product guard.
7. Localize the new stable errors; never display the current raw schema error.

Tests must prove the gateway and job insert adapters are not invoked after
either preflight failure.

### 7. Make recalculation locking depend on a valid eligible assessment

Files:

- `src/server/applicability-check/service.ts`;
- `src/server/applicability-check/recalculation-lock.ts`;
- `tests/applicability-recalculation-lock.test.ts`;
- query/service tests.

Work:

1. Limit the database lookup to an active Gap assessment.
2. Load its pinned applicability artifact and Gap release compatibility.
3. Apply the shared eligibility policy.
4. Lock only when that active assessment pins an approved, compatible positive
   artifact.
5. Keep the existing `APPLICABILITY_RECALCULATION_LOCKED` API contract for a
   valid lock.
6. Fail open for recalculation when no valid eligible Gap assessment exists;
   report malformed persisted state through diagnostics rather than trapping a
   user behind the original defect.

Required cases:

- no Gap assessment: unlocked;
- active positive eligible assessment: locked;
- archived assessment: unlocked;
- clarification assessment: unlocked;
- not-directly-in-scope assessment: unlocked;
- incompatible or missing pinned artifact: unlocked.

### 8. Record the current complete Germany support bundle

Add a focused release-bundle test, for example
`tests/country-support-release-bundle.test.ts`.

For the current release it should assert:

- compiled supported country codes equal `["DE"]`;
- the DE profile is supported and has a non-empty national catalog and legal
  provisions;
- the Gap release covers both positive outcomes with at least one requirement;
- both applicability and Gap releases require the EU and DE corpus families;
- the exported grounding policy definition includes `EU` and `DE`; and
- unsupported FR fixtures remain `clarification_required` while
  `eu_activity === "no"` remains `not_directly_in_scope`.

If necessary, expose the static grounding policy definition separately from
the organization-specific policy lookup so it can be tested without a
database. This is a current-bundle regression test, not the deferred generic
multi-country validator.

### 9. Add a database-backed country-support smoke

Add a non-AI operator smoke command such as:

```text
npm.cmd run db:smoke:country-support
```

Use a synthetic organization owned by the configured smoke user and prove:

```text
organization country FR
  -> jurisdiction country defaults to FR
  -> submit FR + EU activity
  -> approved clarification_required
  -> unresolved_unsupported_profile present
  -> Gap workflow reports unsupported_country
  -> assessment creation returns 409 GAP_APPLICABILITY_NOT_ELIGIBLE
  -> no Gap assessment exists
  -> recalculation lock is false
  -> resubmit with eu_activity = no
  -> not_directly_in_scope
  -> Gap remains blocked and no assessment exists
```

The command must query persisted rows to prove absence of the assessment, job,
and lock side effects. It must not call an AI provider.

The existing `db:smoke:authenticated-gap` command remains the German positive
happy path.

### 10. Update documentation after implementation

Files:

- `docs/product/country-support-current-behavior.md`;
- `docs/architecture/end-to-end-compliance-workflow.md`;
- `docs/product/gap-analysis-current-workflow.md`;
- documentation indexes as appropriate.

Work:

1. Replace the documented broken path with the post-fix behavior and current
   verification date.
2. State explicitly that approved applicability artifacts are not necessarily
   Gap-eligible.
3. Document the positive-outcome prerequisite and reason-specific blocked
   states.
4. Record the atomic country-support definition and the deferred general
   validator.
5. Keep the full-country support checklist near the release authoring guidance.

## Delivery Sequence

Implement as independently reviewable slices:

1. pure support and eligibility helpers with table-driven tests;
2. release/result projection, copy, and country prefill;
3. reasoned Gap prerequisite read model and UI;
4. assessment-creation enforcement;
5. pre-enqueue and worker generation guards;
6. eligible recalculation locking;
7. release-bundle and database-backed smoke coverage;
8. documentation;
9. code-level verification;
10. guarded database clear, full reseed, and environment-backed smoke.

Do not clear the database before code, static release, and non-destructive test
gates pass.

## Verification

### Focused automated tests

At minimum run:

```powershell
npm.cmd test -- `
  tests/applicability-check-rules.test.ts `
  tests/applicability-recalculation-lock.test.ts `
  tests/applicability-result-localization.test.ts `
  tests/gap-assessment-prerequisite.test.ts `
  tests/gap-generation-job-contract.test.ts `
  tests/gap-workflow-safe-projection.test.ts `
  tests/gap-workflow-state.test.ts `
  tests/country-support-release-bundle.test.ts
```

Add the new questionnaire-default, result-card, and prerequisite UI test files
to this command under their final names.

Then run:

```powershell
npm.cmd run verify
npm.cmd run build
```

### Destructive development reset and reseed

After every code-level gate is green, follow
[`database-reset-and-reseed.md`](../database/database-reset-and-reseed.md)
exactly.

Operational requirements:

- verify that the configured target is the intended disposable development
  database;
- verify `DATABASE_URL` and `DRIZZLE_DATABASE_URL` resolve to the same logical
  database before any destructive action;
- use guarded `db:clear` followed by the reviewed `db:push` workflow;
- never use `db:reset`, `db:drop:legacy`, `--force`, or a post-security second
  Drizzle push;
- recreate security/integrity SQL and private storage exactly in runbook order;
- bootstrap the platform administrator;
- seed, review, evaluate, and activate both required legal-corpus families;
- publish and activate `nis2/2026-v1`;
- publish and activate `nis2-gap/guided-v3`; and
- stop at the first failed gate.

No implementation step in this plan itself authorizes running the reset before
the implementation task reaches this phase.

### Environment-backed acceptance

After reseeding:

```powershell
npm.cmd run db:smoke:nis2
npm.cmd run db:smoke:gap
npm.cmd run db:smoke:country-support
npm.cmd run db:smoke:authenticated-gap
```

Also run the security, integrity, storage, rollout, localization, and Gap
requirement verifiers listed in the reset/reseed runbook.

### Implementation record

The implementation passed `npm.cmd run verify`, worker tests, AI evals, and a
production build. The database reset restored all reviewed security and
integrity SQL, three private storage buckets, both evaluated legal-corpus
families, `nis2/2026-v1`, and `nis2-gap/guided-v3`. All environment-backed
acceptance smokes and runbook verifiers passed.

The reviewed Drizzle push encountered the documented dependency-ordering
failure while attempting to replace an option constraint. The feature has no
schema delta, so the push was not retried. The exact security, integrity, and
index SQL sequence was reapplied after the partial attempt, and the complete
server-only, remediation-integrity, storage, and rollout verifiers passed.

## Acceptance Criteria

- The active release advertises Germany as its only supported country.
- The questionnaire still offers all EU member states and `unsure`.
- Stored organization country prefills only a matching offered country and
  never overrides a previous questionnaire answer.
- FR plus EU activity persists an approved `clarification_required` result with
  `unresolved_unsupported_profile`.
- FR plus no EU activity persists `not_directly_in_scope`.
- Both results render localized, reason-appropriate product guidance.
- Unsupported guest results remain claimable.
- The Gap page remains reachable but exposes no start, prepare, generate, or
  retry action for either non-positive outcome.
- Direct assessment creation returns
  `409 GAP_APPLICABILITY_NOT_ELIGIBLE` with structured details.
- Rejected creation writes no Gap assessment or audit event.
- Direct generation and retry calls cannot bypass eligibility.
- A positive result with zero applicable requirements creates no job or AI run.
- Ineligible outcomes never lock Betroffenheitscheck recalculation.
- A valid active assessment pinned to a positive result still locks
  recalculation immediately.
- Existing Germany positive workflows continue through generation unchanged.
- German and English copy pass the repository i18n check.
- The full verification suite and build pass.
- The connected development database is cleared, reseeded, republished,
  activated, and smoke-tested through the approved runbook.

## Non-Goals

- Adding a second national NIS2 profile.
- Producing provisional positive classifications from the EU core.
- Removing unsupported countries from the questionnaire.
- Introducing a new applicability outcome.
- Enforcing equality between organization country and NIS2 jurisdiction.
- Changing deterministic result persistence away from `approved`.
- Hiding the Gap module from navigation.
- Building a legacy-data migration.
- Building the general cross-release multi-country validator before the second
  country's metadata requirements are known.
