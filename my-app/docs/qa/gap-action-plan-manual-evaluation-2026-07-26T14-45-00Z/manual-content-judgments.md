# Guided-v5 manual content judgments

Date: 2026-07-26  
Reviewer: Codex execution agent  
Overall content judgment: **Pass**

## Review method

I reviewed the final raw artifacts for all five scenarios after the automatic
checks completed. The review considered status/guidance consistency, scope of
the structured work, uncertainty language, evidence relevance, legal-source
role, correction lineage, action-plan usability, locale, and customer-facing
safety.

The automatic comparison is in
[`automatic-comparison-results.json`](automatic-comparison-results.json).
Exact release and model provenance is in
[`exact-release-prompt-schema-provider-metadata.json`](exact-release-prompt-schema-provider-metadata.json).

## Case judgments

### Case 1 — mature baseline, English

Artifact:
[`case-1-mature-baseline-en.json`](case-1-mature-baseline-en.json)

Judgment: **Pass**

- All ten findings remain `fulfilled` with low severity and
  `maintain_and_document` mode.
- Each recommendation now explicitly states that questionnaire responses
  report implementation. It frames the text as maintenance and evidence
  readiness for independent verification, not as a finding that the control
  is missing.
- No finding has an objective, deliverables, acceptance criteria, suggested
  evidence, triggering work package, or action-plan item.
- Recommendations remain category-specific while avoiding a false claim that
  independent documentary verification already occurred.

### Case 2 — absent controls, English

Artifact:
[`case-2-absent-controls-en.json`](case-2-absent-controls-en.json)

Judgment: **Pass**

- All ten statuses and severities match the deterministic expected result.
- The plan contains exactly ten items: one for each non-fulfilled finding.
- Every trigger is a `not_implemented` questionnaire answer with
  `workKind=remediate`; satisfied or merely uncertain questions are not
  introduced.
- Every item contains a usable objective, deliverables, acceptance criteria,
  suggested evidence, source recommendation, measure type, and priority.
- Recommendations and structured work agree; no verification-only work is
  mislabeled as remediation.

### Case 3 — mixed maturity, English

Artifact:
[`case-3-mixed-maturity-en.json`](case-3-mixed-maturity-en.json)

Judgment: **Pass**

- The plan contains exactly four items.
- Governance work is limited to management oversight.
- Risk work is limited to verifying the risk-analysis update cadence and uses
  both implemented and deficient completion paths.
- IAM work is limited to multi-factor authentication.
- Continuity work is limited to restore testing.
- The six fulfilled categories have no structured execution guidance and use
  the explicit self-report/independent-verification maintenance framing.
- No satisfied question leaks into deliverables, criteria, evidence, or
  recommendation scope.

### Case 4 — uncertain evidence, German

Artifact:
[`case-4-uncertain-evidence-de.json`](case-4-uncertain-evidence-de.json)

Judgment: **Pass**

- All ten findings remain `insufficient_evidence` with
  `evidence_verification` mode; uncertainty is not presented as confirmed
  absence.
- All triggering work packages use `workKind=verify`.
- Each trigger starts with the deterministic German instruction to assign an
  accountable owner, verify the current implementation state, and collect
  evidence.
- Each trigger has separate acceptance paths for evidence confirming
  implementation and evidence confirming a deficiency that is then
  remediated and evidenced.
- Objectives, recommendations, work content, diagnostics, and result locale
  remain German. No unconditional implementation claim was found.
- The plan contains exactly ten fixed verification items.

### Case 5 — contradictory backup evidence, English

Artifact:
[`case-5-contradictory-backup-evidence-en.json`](case-5-contradictory-backup-evidence-en.json)

Judgment: **Pass**

- The deterministic initial backup status remains `fulfilled`; the selected
  document does not directly overwrite server-owned status.
- The control-specific backup contradiction is admitted and cited only for
  `NIS2-BC-05`. It raises documentary sufficiency and `requiresReview`.
- Unrelated requirements receive no backup-document citation and retain
  `evidenceSufficiency=none`.
- The unresolved contradiction blocks finalization.
- The accepted material correction changes backup to `not_fulfilled` and
  creates a distinct `gap_guidance_regeneration` run.
- An explicit guidance-only regeneration creates another immutable revision
  and distinct run without changing assessment facts.
- The final plan contains exactly one structured backup-remediation item, and
  its objective, deliverables, criteria, evidence, recommendation snapshot,
  priority, and measure type match the accepted finding.

## Cross-case judgments

### Evidence relevance

Judgment: **Pass**

The calibrated policy admits exact, contradictory, and bilingual relevant
fixtures while rejecting an adjacent wrong control, unrelated content,
generic security-policy language, and very short content. The final policy is
`gap_org_evidence_relevance_v1`, with semantic floor `0.55`, combined floor
`0.35`, and a maximum of three admitted chunks. See
[`threshold-calibration-summary.json`](threshold-calibration-summary.json).

### Legal authority and provenance

Judgment: **Pass**

Every finding cites a `mapped_primary` official legal chunk connected to its
guidance basis. The active guided-v5 release pins the evaluated EU and German
corpus releases, and the mapped-authority verifier reports complete coverage.
All seven final model runs used prompt 6, response schema 6, OpenAI
`gpt-4.1`, and only the pinned legal corpus releases.

### Correction, regeneration, and plan lifecycle

Judgment: **Pass**

The final live lifecycle probe confirms:

- generated plan fields reject patches;
- status, owner, due date, and execution notes are editable;
- the execution update records attributable before/changes audit metadata;
- a stale version fails with HTTP 412;
- correction after plan creation fails with
  `GAP_LOCKED_BY_ACTION_PLAN`; and
- guidance regeneration after plan creation fails with the same permanent
  lock.

See
[`post-finalization-lifecycle.json`](post-finalization-lifecycle.json).

### UI and accessibility contract

Judgment: **Pass**

Source and server-rendered UI review confirms:

- English and German generated-output locale indicators remain independent of
  the surrounding UI locale.
- Structured objectives, deliverables, acceptance criteria, and evidence use
  labeled sections and semantic lists.
- Correction/regeneration and execution inputs use native focusable controls;
  buttons and inputs are disabled during busy or read-only states.
- Validation fields expose `aria-invalid`, workflow announcements use an
  `aria-live` region, and empty, failure, stale, review-blocked, and
  action-plan-locked states have visible copy.
- Regeneration has no generated-content editor or preview/confirmation step.

The render and localization contracts are covered by the repository tests;
the live service lifecycle was separately exercised against the disposable
database.

## Scope boundary

This is product-behavior and content-quality validation of how Complyx
generates and manages guidance. It is not an independent legal opinion, a
legal-accuracy certification, or advice about any organization's NIS2
obligations.
