# Framework Change and Extension Effort

Status: current implementation assessment as of 2026-07-28.

## Purpose

This note estimates the engineering effort for two changes:

1. publishing a slightly changed version of the current NIS2 framework; and
2. adding a genuinely separate compliance framework alongside NIS2.

It focuses on application engineering. Legal research, framework interpretation,
questionnaire authoring, translations, corpus acquisition, and subject-matter
approval are additional work unless stated otherwise.

## Summary

| Scenario | Engineering effort | Character |
| --- | ---: | --- |
| Wording, help text, tooltip, or option-label changes in NIS2 | 2–5 engineer-days | Small immutable release |
| NIS2 question, mapping, threshold, or rule changes within the current evaluator model | 1–3 weeks | Medium release and regression effort |
| NIS2 evaluator semantics or result-shape changes | 2–4 weeks | Evaluator and persistence change |
| Second framework with substantially similar applicability semantics | 4–8 weeks | Large cross-cutting feature |
| Second framework with different applicability or workflow semantics | 8–12+ weeks | New framework capability |

These ranges assume one experienced engineer who knows the repository. They do
not include the time required to establish that the compliance content is
legally correct.

## Releasing a Slightly Changed NIS2 Version

### Current support

The current architecture is well suited to this scenario. Framework,
questionnaire, rule-set, content, legal, scope-model, threshold, profile, and
aggregate-release records are versioned. Published versions are treated as
immutable, and activation is represented by a separate mutable pointer.

The release source is authored under
[`src/server/compliance/nis2/releases/`](../../src/server/compliance/nis2/releases/).
The compiler, publisher, and activator live under
[`src/server/compliance/publishing/`](../../src/server/compliance/publishing/).

A slight change should therefore be a new release version, not an update to
published database rows.

### Normal work

For a wording-only or similarly small release:

1. Create a new release definition, normally by deriving it from the previous
   NIS2 release.
2. Assign a new release version label and component version labels where
   required.
3. Add the release to the repository release registry.
4. Update localized content while preserving stable identities where the
   underlying concept has not changed.
5. Compile the release and review the generated validation and content hashes.
6. Run compiler fixtures, release tests, runtime tests, and NIS2 smoke tests.
7. Publish without activating, inspect the persisted release, and then activate
   it through the reviewed rollout procedure.

The publisher creates new content revisions and component versions, so unchanged
historical assessments continue to resolve their pinned release.

### Changes that increase the effort

Question or option changes require more than editing labels:

- each question must still map correctly to a fact;
- visibility dependencies must reference earlier questions;
- fact options and question options must remain consistent;
- national and EU entity catalog ownership must remain valid; and
- the current NIS2 release validator expects the established question, fact,
  entity, profile, and jurisdiction contracts.

Threshold, entity, national-profile, or deterministic-rule changes require
updated golden fixtures and broader regression testing. If the existing
`nis2_scope_v2` or `nis2_scope_v3` evaluator cannot express the new rule, the
change becomes an evaluator change rather than a data-only release.

### Gap-analysis compatibility

A compliance release and a Gap Analysis release are connected by an exact
`compatible_check_release_id`; compatibility is not inferred merely from the
framework code.

If organizations will produce applicability results using the new compliance
release and must then start a Gap Analysis, a compatible Gap Analysis release
must also be published and activated. Its questionnaire and requirements may be
unchanged, but it must pin the new compliance release. Otherwise, the
applicability prerequisite rejects the new result as incompatible.

This compatibility release normally adds approximately 1–3 engineer-days,
including regression and rollout checks, when no Gap questions, requirements,
prompts, or evaluator behavior change.

### Rollout considerations

- Publish first and activate separately.
- Use a new release ID. Published bundles are cached by release ID and are
  intentionally assumed to be immutable.
- Existing assessments and results remain pinned to their original release.
- Starting work under a newly active Gap release can archive an older active Gap
  assessment for the same organization.
- Activating a new Gap release can make an unfinished generated Gap result
  outdated and prevent Action Plan finalization. Rollout should therefore check
  for in-progress organization workflows.
- Production publication and activation should use a reviewed operator or admin
  procedure rather than direct updates to release tables.

### Practical estimate

For a small, reviewed NIS2 wording release that keeps the same evaluator and Gap
questionnaire:

- compliance release work: 2–5 engineer-days;
- compatible Gap release and rollout checks: 1–3 engineer-days if required;
- legal/content review: separate.

## Adding a Separate Compliance Framework

### What is already reusable

The database foundation is mostly framework-neutral:

- `compliance_frameworks` and `compliance_framework_versions`;
- framework-owned modules and questionnaires;
- immutable content revisions and translations;
- aggregate compliance and Gap releases;
- active-release pointers and activation history;
- assessments and artifacts that pin their source releases; and
- generic legal corpus families with framework and jurisdiction codes.

The runtime release reader also accepts a `checkCode` and can assemble a
published database release generically.

This foundation reduces the amount of new database design, but it does not make
the current application multi-framework.

### Current NIS2-specific boundaries

The following areas must be changed for a genuine second framework:

1. **Release definition and validation**
   - The release type accepts only the NIS2 check code and NIS2 evaluator kinds.
   - Validation assumes the current NIS2 question count, entity catalogue,
     facts, profiles, jurisdiction ordering, and German implementation details.
   - The publisher contains NIS2-specific scope-model and release assumptions.

2. **Evaluator and result contracts**
   - Rule-set parsing and evaluation support `nis2_scope_v2` and
     `nis2_scope_v3`.
   - Stored evaluation-result schemas and localization are NIS2-specific.
   - Applicability persistence writes a `nis2_result_projections` row.

3. **Runtime selection**
   - Applicability services always request the fixed `NIS2_CHECK_CODE`.
   - Organization workflows do not accept a framework or check-code parameter.
   - Latest-assessment and current-result queries explicitly filter for NIS2.

4. **Product and organization model**
   - The UI states that the framework is fixed for the current product.
   - There is no organization-level enabled-framework or selected-framework
     model.
   - Navigation, dashboards, reports, result copy, and public guest flows assume
     NIS2.

5. **Gap Analysis and Action Plans**
   - Gap workflows default to `nis2-gap`.
   - Gap publication resolves its compatible release through the NIS2
     repository registry.
   - Gap prompt and evaluator contracts use NIS2 identities.
   - AI grounding is fixed to the NIS2 EU and German corpus families.
   - The current Action Plan lifecycle permits only one plan per organization,
     rather than one per organization and framework.

6. **Operations and verification**
   - Release registries, corpus bootstrap utilities, smoke tests, benchmarks,
     and rollout verification are NIS2-specific.

Inserting a new `compliance_frameworks` row without addressing these boundaries
would create dormant data. The current application would neither select nor
evaluate it.

### Required engineering work

A maintainable implementation should introduce the following seams:

1. A framework registry that connects a framework/check code to its release
   parser, evaluator, result parser, localizer, and optional result projection.
2. A generic release envelope with framework-specific payload validation,
   replacing the NIS2-only publisher input type.
3. Framework-aware applicability service methods and API contracts.
4. An organization framework model and framework-aware routing or selection.
5. Generic result persistence or an explicit projection strategy per framework.
6. Framework-scoped artifact, report, Gap Analysis, and Action Plan lookup.
7. A grounding-policy registry keyed by workflow release or framework instead
   of the fixed NIS2 corpus policy.
8. Framework-specific release, evaluator, corpus, Gap, and end-to-end fixtures.
9. UI and localization work for framework selection, navigation, dashboards,
   results, reports, and empty/error states.

The exact design depends on whether the second framework has an applicability
decision similar to NIS2. A controls-oriented standard such as one that starts
directly with a Gap Analysis may need a workflow that does not require a
compatible applicability result. The current Gap release schema and lifecycle
assume that prerequisite exists.

### Practical estimate

For a second framework that can reuse the current questionnaire-to-facts model,
deterministic result lifecycle, and Gap/Action Plan concepts, the engineering
effort is approximately 4–8 weeks.

For a framework with materially different scoping rules, result shape,
jurisdiction model, or no applicability phase, the effort is approximately
8–12+ weeks. The upper range includes establishing the reusable framework
interfaces rather than implementing the new framework as NIS2-specific
conditionals.

The following remain additional:

- legal and subject-matter research;
- questionnaire and requirement design;
- DE/EN translation and review;
- official legal corpus ingestion and provision bindings;
- golden-case creation and compliance validation; and
- AI prompt and output evaluation for framework-specific Gap Analysis.

## Recommendation

Treat a small change to NIS2 as an ordinary immutable release and keep using the
existing publish-then-activate architecture.

Before adding a second framework, first extract a framework/evaluator registry
and make applicability, result persistence, Gap release selection, grounding,
and Action Plan ownership explicitly framework-scoped. This avoids spreading a
second set of hard-coded framework branches through the current NIS2 services.
