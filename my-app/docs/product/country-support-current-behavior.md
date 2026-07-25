# Current Country Support in Betroffenheitscheck and Gap Analysis

Status: implemented behavior verified in code on 2026-07-25.

## Summary

The current Compliance release supports a national NIS2 determination and Gap
Analysis for Germany only. The Betroffenheitscheck still offers all 27 EU
member states plus **Unsure**, because the competent jurisdiction is a fact the
user must report accurately.

| Situation | Implemented behavior |
| --- | --- |
| Germany | Uses the supported German national profile and can produce positive or negative outcomes. |
| Other EU country with relevant EU activity | Persists an approved `clarification_required` result with `unresolved_unsupported_profile` and a Germany-only support notice. |
| No relevant EU activity | Persists `not_directly_in_scope` before national-profile support matters. |
| Gap page for a non-positive result | Remains reachable, but displays a reason-specific blocked state with no Gap workflow action. |
| Direct assessment or generation request | Returns a stable `409` prerequisite error before an assessment, job, draft lock, or AI run is created. |
| Betroffenheitscheck recalculation | Locks only when an active Gap assessment pins a compatible, approved, positive applicability result. |

An approved applicability artifact means deterministic evaluation completed.
It does not mean positive NIS2 applicability or Gap eligibility.

## Country selection and support

Country support is derived from the pinned release rule set by parsing
`countryProfiles` and selecting profiles with `supported: true`. The current
compiled result is `["DE"]`; UI code does not hard-code that list.

The organization country and NIS2 jurisdiction remain separate:

- a persisted questionnaire answer wins;
- otherwise an authenticated questionnaire defaults the jurisdiction to the
  normalized organization country only when that code is one of the offered
  EU options;
- a non-EU organization country creates no default and is never translated to
  `unsure`;
- guest questionnaires have no organization default; and
- submitting a jurisdiction never changes the organization country.

For an unsupported country, the shared result card detects
`unresolved_unsupported_profile` from stable evidence, shows localized
release-derived country support copy, and keeps the normal clarification
details visible. Guest results remain valid, claimable, and deletable.

## Gap eligibility

Exactly two outcomes are Gap-eligible:

- `essential_entity`
- `important_entity`

The shared policy parses stored result JSON with
`parseStoredRuleEvaluationResult` and keeps validity failures distinct from
business ineligibility:

- missing artifact;
- incompatible release;
- unapproved artifact;
- malformed artifact; and
- valid but non-positive outcome.

The page-read, assessment-creation, generation-enqueue, and worker-generation
boundaries all apply that policy independently. A valid non-positive result
returns `GAP_APPLICABILITY_NOT_ELIGIBLE` with customer-safe structured details:

```json
{
  "outcome": "clarification_required",
  "countryCode": "FR",
  "unresolvedFactCodes": ["unresolved_unsupported_profile"]
}
```

For a positive result, generation also requires at least one applicable Gap
requirement. An empty set returns `GAP_REQUIREMENTS_UNAVAILABLE` before
queueing or calling an AI provider. The response-schema non-empty assertion
remains as an internal invariant.

## Recalculation locking

Only an active Gap assessment whose pinned artifact is approved, compatible,
well-formed, and positive locks the Betroffenheitscheck. Archived assessments,
non-positive results, missing pinned artifacts, incompatible releases, and
malformed states fail open for recalculation. Malformed persisted states are
reported through server diagnostics.

## Atomic country-support bundle

A country is supported only when the complete product slice exists:

- national applicability profile and entity catalog;
- positive and negative classification rules;
- Gap requirements for both positive outcomes;
- primary legal provisions;
- required corpus families and pinned evaluated releases;
- grounding jurisdiction policy;
- German and English product copy; and
- automated and database-backed tests.

The current Germany bundle is covered by
`tests/country-support-release-bundle.test.ts`. A generic cross-release
validator is deferred until a second country makes its metadata requirements
concrete.

## Verification

The non-AI operator smoke is:

```text
npm.cmd run db:smoke:country-support
```

It creates a synthetic FR organization, verifies questionnaire prefilling,
persists both unsupported and no-EU-activity outcomes, checks the reasoned Gap
blocked states and stable creation rejection, and queries the database to prove
that no Gap assessment, job, AI run, or recalculation lock was created.
