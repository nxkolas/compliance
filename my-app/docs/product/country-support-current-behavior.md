# Current Country Support in Betroffenheitscheck and Gap Analysis

Status: code-backed findings verified on 2026-07-24.

## Summary

Germany is the only country with a supported national NIS2 profile in the
current Compliance release. The Betroffenheitscheck nevertheless offers all
27 EU member states plus **Unsure**. A user selecting another EU country can
complete the check, but an EU-active organization receives
`clarification_required`. That result is stored as an approved artifact and
currently satisfies the Gap Analysis prerequisite, even though it cannot
produce any applicable Gap requirements.

| Situation | Observed behavior |
| --- | --- |
| Germany | Uses the German national entity catalog and can produce a positive or negative determination. |
| Other EU country with EU activity | Uses the EU-core catalog and produces `clarification_required` with `unresolved_unsupported_profile`. |
| No relevant EU activity | Produces `not_directly_in_scope` before country-profile support is considered. |
| Gap Analysis after a non-German result | Can be opened because the prerequisite checks approved status and release compatibility, not the outcome. |
| Gap generation | Resolves zero applicable requirements and fails with `At least one requirement code is required`. |
| Later Betroffenheitscheck recalculation | Is locked as soon as any Gap assessment exists, including one created from an ineligible result. |

## Betroffenheitscheck country behavior

The questionnaire's country list contains the 27 EU member-state codes and
then appends `unsure`
([release source](../../src/server/compliance/nis2/releases/2026-v1/release-source.ts#L211-L227)).
The release itself defines exactly one national profile: `de_nis2` for `DE`,
with `supported: true` and `allowNegativeConclusion: true`
([release definition](../../src/server/compliance/nis2/releases/2026-v1/release.ts#L520-L532)).

The evaluator reads the self-reported `jurisdiction_country` fact and resolves
a profile by that code. If the organization has EU activity but the profile is
missing or unsupported, evaluation remains `clarification_required` and adds
`unresolved_unsupported_profile`. The `eu_activity === "no"` branch is
evaluated first and therefore still returns `not_directly_in_scope`
([evaluation rules](../../src/server/applicability-check/rules.ts#L61-L104)).

Entity-catalog selection is enforced on both sides:

- The client selects `country:<code>` when that catalog exists and otherwise
  falls back to `eu_core`
  ([questionnaire form](../../components/applicability-check/applicability-questionnaire-form.tsx#L80-L99)).
- The shared catalog helper applies the same national-or-EU-core rule
  ([catalog helper](../../src/server/applicability-check/entity-catalog.ts#L12-L31)).
- Server validation recomputes the permitted options for the submitted country
  and rejects a value outside that catalog
  ([submission validation](../../src/server/applicability-check/service.ts#L1010-L1021)).

The organization's stored `country` is a separate field. It defaults to `DE`
and accepts any normalized two-character value
([organization contract](../../src/contracts/organizations/index.ts#L3-L7),
[normalization](../../src/server/organizations/service.ts#L647-L656),
[database schema](../../src/db/schema.ts#L322-L340)). The applicability
evaluator instead uses the questionnaire's `jurisdiction_country` fact. There
is no prefill, restriction, or equality check between those two values in the
current applicability flow, so they can diverge.

## Gap Analysis failure path

Every successfully evaluated Betroffenheitscheck result is persisted with
artifact status `approved`, regardless of whether its outcome is
`essential_entity`, `important_entity`, `not_directly_in_scope`, or
`clarification_required`
([result persistence](../../src/server/applicability-check/submission-persistence.ts#L487-L509)).
Here, `approved` means that deterministic evaluation completed; it does not
mean that the organization is positively in scope.

Both Gap prerequisite checks currently require only the compatible Compliance
release and `approved` status. Neither reads or validates the applicability
outcome
([page prerequisite](../../src/server/gap-analysis/postgres-page-data.ts#L39-L65),
[assessment prerequisite](../../src/server/gap-analysis/assessment-service.ts#L15-L37),
[candidate query](../../src/server/gap-analysis/assessment-service.ts#L71-L91)).
Consequently, a non-German `clarification_required` artifact can be pinned to a
new Gap assessment.

Gap requirements are defined as applicable only to `essential_entity` or
`important_entity`
([requirement type](../../src/server/gap-analysis/releases/types.ts#L17-L31)).
Generation filters requirements by the pinned outcome, so
`clarification_required` produces an empty requirement set
([generation filter](../../src/server/gap-analysis/generation-service.ts#L95-L107)).
The grounded output schema then rejects that empty set with
`At least one requirement code is required`
([schema construction](../../src/server/gap-analysis/generation-service.ts#L243-L255),
[schema guard](../../src/server/gap-analysis/generation-schema.ts#L41-L48)).
The review action is not disabled by a zero requirement count, and the failure
state offers retry, which repeats the same deterministic failure
([review action](../../components/gap-analysis/gap-review-step.tsx#L174-L200)).

Creating the Gap assessment also locks the Betroffenheitscheck. The lock query
checks only whether any assessment with a Gap release exists; it does not
filter by applicability outcome, generation status, or successful Gap
revision
([recalculation lock](../../src/server/applicability-check/service.ts#L445-L462)).

Finally, grounded Gap generation is currently configured for the
`nis2-eu-primary` and `nis2-de-primary` corpus families and the `EU` and `DE`
jurisdictions. Supporting another national profile therefore requires more
than adding country-specific applicability rules
([grounding policy](../../src/server/ai/grounding/policy.ts#L6-L13)).

## Risks

- Unsupported-country users can enter a workflow that cannot complete.
- `approved` is overloaded as execution success and Gap eligibility.
- A failed, ineligible Gap attempt can prevent the user from correcting the
  Betroffenheitscheck.
- A generic generation failure obscures the actual product limitation.
- Adding a national applicability profile without matching requirements and
  legal-corpus policy would leave country support incomplete.

## Recommended remediation

1. Require an applicability outcome of `essential_entity` or
   `important_entity` when loading the Gap page, creating the assessment, and
   starting generation.
2. Reject an empty applicable-requirement set before creating or queueing a
   generation job, with a product-specific explanation.
3. Do not create a Gap assessment, or lock applicability recalculation, for an
   outcome that is not Gap-eligible.
4. Choose and document the unsupported-country product behavior: stop with an
   explicit country-support message, or support provisional EU-core positive
   determinations.
5. Treat a new country's national profile, Gap requirements, legal sources,
   corpus pins, grounding policy, UI copy, and tests as one support unit.
6. Add an integration test for
   `non-DE -> clarification_required -> Gap prerequisite rejected`.

## Verification

The release, evaluator, catalog-selection, persistence, Gap prerequisite,
requirement-filtering, generation-schema, locking, and grounding-policy paths
were reviewed directly in source. The compiled release was also evaluated with
France for both a large electricity supplier and `none_of_these`; both cases
returned `clarification_required`.

The targeted automated suites passed:

```text
npm.cmd test -- tests/applicability-check-rules.test.ts tests/entity-catalog.test.ts tests/gap-assessment-prerequisite.test.ts

Test Files  3 passed (3)
Tests      21 passed (21)
```

The existing suites cover evaluator outcomes, catalog fallback, and the
approved-status prerequisite
([applicability rules tests](../../tests/applicability-check-rules.test.ts),
[entity catalog tests](../../tests/entity-catalog.test.ts),
[Gap prerequisite tests](../../tests/gap-assessment-prerequisite.test.ts)).
They do not cover the full
`clarification_required -> Gap creation -> zero requirements -> generation
failure` path.
