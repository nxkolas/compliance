# Manual AI Gap-Analysis and Action-Plan Evaluation

Date: 2026-07-26  
Environment: configured development database and real application services  
Gap release: `nis2-gap/guided-v4`  
Release prompt/response contract: v5/v5  
AI provider/model: OpenAI `gpt-4.1`  
Overall result: **Conditional pass**

## Executive conclusion

The deterministic parts of the workflow are reliable in these five cases:

- All 50 expected requirement statuses matched.
- All 50 severities matched.
- Every finding had legal-source coverage.
- All 25 expected action-plan items were created, with the correct source
  finding, priority, title, description, and initial `open` status.
- English/German output pinning worked.
- The contradictory document was detected, cited, and blocked from
  finalization until human review.
- All 213 automatic comparisons passed.

The generated content is less consistently ready for customer use. The
rationales are generally coherent and grounded, but recommendations are often
written for the entire category instead of the particular failed answer. For
`insufficient_evidence`, the model sometimes treats “unknown” as “not
implemented.” An unrelated selected document also changed eight findings from
`none` to `partial` evidence sufficiency merely because it was retrieved.

The current result is therefore structurally accurate but only conditionally
acceptable for substantive guidance. It is strongest for a completely absent
control and for explicit contradictory evidence. It is weakest for mixed
categories and uncertain answers.

This was a product-behavior evaluation against the active release and corpus,
not an independent legal opinion on the completeness of the NIS2/BSIG model.

## Result summary

| Case | Expected | Actual | Content judgment |
| --- | --- | --- | --- |
| 1. Mature baseline, EN | 10 fulfilled; 0 items | Exact match | Pass with wording caution |
| 2. Absent controls, EN | 10 not fulfilled; 10 items | Exact match | Pass; measures are broad |
| 3. Mixed maturity, EN | 6 fulfilled; 4 actionable findings/items | Exact match | Partial; 3 of 4 recommendations are insufficiently targeted |
| 4. All unsure, DE | 10 insufficient evidence; 10 items | Exact match; German detected at 98.9% confidence | Partial; unknown state is sometimes presented as missing control |
| 5. Contradictory document, EN | Keep deterministic status, cite conflict, require review; after correction create 1 backup item | Core expectation met; 2 review flags; final 1 high-priority item | Pass for conflict handling; partial for document relevance |

## Case 1 — Mature baseline, English

Raw output: [case-1-mature-baseline-en.json](./case-1-mature-baseline-en.json)

Organization: `a442a223-ae0e-4bee-b15a-3f585c319ced`  
Generated revision: `1b3014b2-57f6-455d-a5c1-2072d47a5a00`  
Action plan: `cf3f544c-04f6-4432-a052-70b0cafc7756`

### What it should say

All questionnaire assertions say that the controls are implemented. The
deterministic status should therefore be `fulfilled` for all ten requirements.
Because no organization documents were selected, the prose should distinguish
“self-reported as fulfilled” from “independently verified.” No remediation
item should be created.

### What it actually said

All ten findings were `fulfilled`, all severities were `low`, all evidence
sufficiency values were `none`, and the plan correctly contained zero items.
The model consistently explained that the implementation was asserted but not
independently evidenced.

Typical recommendation:

> Provide documentation showing assignment of information security
> responsibility, evidence of management approval and oversight, and proofs
> of management's participation in recurring cybersecurity risk-management
> training.

### Comparison

The outcome and evidence distinction are correct. The wording can nevertheless
look internally inconsistent to a customer: a card says `fulfilled`, then the
rationale says the evidence base is insufficient and the recommendation asks
for proof. A clearer formulation would be:

> Self-reported as implemented. No independent organization evidence was
> selected, so the result is not document-verified. Preserve the existing
> status and optionally attach current responsibility, oversight, and training
> records.

Judgment: **Pass with wording caution.**

## Case 2 — Absent controls, English

Raw output: [case-2-absent-controls-en.json](./case-2-absent-controls-en.json)

Organization: `6af53394-6ed3-4b24-9b87-e66ecaac4e4d`  
Generated revision: `aec75912-2ca9-4fa0-ba1d-a8f6b48f2526`  
Action plan: `01efa1f2-58f1-4cd8-849d-92efe6c640d6`

### What it should say

Every category should be `not_fulfilled`. The eight high-criticality
requirements should produce high-priority items; awareness and protection
should produce medium-priority items. Each recommendation should state the
missing control in actionable terms.

### What it actually said

The result matched exactly: ten `not_fulfilled` findings, eight high and two
medium severities, ten plan items, and correct recommendation-to-description
copying.

Good examples include:

- IAM: implement least privilege, strong authentication, and personnel-change
  access handling.
- Backup/continuity: implement secure backups, recovery plans, and restore
  testing.
- Supply chain: identify and assess suppliers, add contract requirements, and
  prepare for provider incidents and exit.

### Comparison

The recommendations match the missing controls and make sense as first-pass
measures. They are still category-sized work packages rather than
implementation-ready tasks: there are no explicit deliverables, acceptance
criteria, sequence, or suggested evidence. That is consistent with the current
data model, but it limits the practical usefulness of the “action plan.”

Judgment: **Pass.**

## Case 3 — Mixed maturity, English

Raw output: [case-3-mixed-maturity-en.json](./case-3-mixed-maturity-en.json)

Organization: `92947386-b668-402c-a0e6-0dd0783ceaac`  
Generated revision: `1be8b4b5-9f2e-4b3b-8785-e5252d86cf17`  
Action plan: `d7fe3b22-ef16-4d3d-b468-a390e9b86faa`

### Expected versus actual

| Requirement | Input that should drive the gap | Expected recommendation | Actual assessment |
| --- | --- | --- | --- |
| Governance | Management oversight only partially implemented; owner and training fully implemented | Complete and document management approval/oversight cadence and decisions | Correctly identifies oversight, but also asks for responsibility assignment and training already marked complete |
| Risk | Risk-analysis updates are unsure; written analysis, dependencies, and inventory are fully implemented | Verify and document the update cadence and review after changes/incidents | Treats the whole risk-analysis evidence set as absent and asks for the full analysis/inventory |
| IAM | MFA not implemented; least privilege and leaver handling fully implemented | Implement MFA for sensitive, admin, and remote access | Correctly targets MFA, although it repeats least privilege as a secondary instruction |
| Backup/continuity | Restore testing only partially implemented; other backup controls fully implemented | Schedule, execute, and document recurring end-to-end restore tests | Requests documentation for all backup controls and records of tests, but does not clearly instruct the organization to complete the partially implemented testing process |

### Comparison

The deterministic aggregation is correct:

- Governance: `partially_fulfilled`, medium
- Risk: `insufficient_evidence`, high
- IAM: `not_fulfilled`, high
- Backup/continuity: `partially_fulfilled`, medium
- Six other categories: `fulfilled`

All four action items were created correctly. The weakness is recommendation
precision. The model understands which answer caused each category status in
its rationale, but the recommendation often expands back to every control in
the category. This creates unnecessary work and obscures what must change to
close the finding.

Judgment: **Partial pass.**

## Case 4 — Evidence uncertainty, German

Raw output: [case-4-uncertain-evidence-de.json](./case-4-uncertain-evidence-de.json)

Organization: `42542779-eb81-44a7-8c9d-588182adaacc`  
Generated revision: `303c2a34-3b9d-4d17-875f-922bebf704d0`  
Action plan: `3b77fb29-562b-40f0-a586-ca1f89403090`

### What it should say

Every status should be `insufficient_evidence`. Recommendations should first
ask an owner to determine the real state and collect evidence. Only after that
verification should they prescribe implementation for controls confirmed to
be absent.

A suitable pattern would be:

> Assign an owner to verify whether the control exists, collect the current
> policy/process/records, assess them against the stated requirement, and
> create a remediation task only for confirmed deficiencies.

### What it actually said

All statuses, severities, action items, and German output matched expectations.
The rationales correctly say that the questionnaire answers are uncertain and
no reliable evidence is available.

Several recommendations then jump directly from uncertainty to implementation:

> Es sollte umgehend eine umfassende Risikoanalyse erstellt ...

> Die Organisation muss relevante Lieferanten identifizieren und bewerten ...

> Schutzmaßnahmen ... sind einzuführen und nachzuweisen.

### Comparison

Those recommendations may be correct if the controls are truly absent, but
the inputs do not establish absence. The action plan may therefore duplicate
existing work or tell the organization to rebuild controls that only lack
evidence. The distinction between an evidence-collection task and a
control-remediation task should be preserved in the generated measure.

Language pinning itself passed: all generated prose was German, with no
detected English fragments beyond enum-like status terms such as
`insufficient_evidence`.

Judgment: **Partial pass.**

## Case 5 — Contradictory backup evidence, English

Raw output:
[case-5-contradictory-backup-evidence-en.json](./case-5-contradictory-backup-evidence-en.json)

Organization: `f9e1cc03-46eb-49c0-bb5c-895f36eaf1d8`  
Generated revision: `ddc26a29-b7ad-4b39-8233-5370e9f07cf2`  
Final reviewed revision: `8fa376b2-3bae-4001-a11d-684502df0224`  
Action plan: `48663c50-c00b-4f9b-a620-5938740f5e9a`

### What it should say

The server-owned status must remain `fulfilled` because all questionnaire
answers say fully implemented. The AI must not silently change it. It should
cite the synthetic record saying restoration has never been tested, identify
the contradiction, require human review, and block finalization.

After a reviewer accepts the document as the more specific current record and
changes backup continuity to `not_fulfilled`, the plan should contain one
high-priority restore-testing item.

### What it actually said

The core behavior matched:

- The generated backup status remained `fulfilled`.
- The exact organization document excerpt was cited.
- `requiresReview` was set.
- Finalization returned `GAP_REVIEW_UNRESOLVED`.
- The recommendation directly addressed restore testing and ownership.
- The recorded human correction changed backup continuity to
  `not_fulfilled`, high severity.
- The final plan contained exactly one high-priority backup item.

The generated recommendation was strong:

> Conduct and document backup recovery tests, define and assign restore
> testing responsibilities, review and evidence restoration objectives, and
> retain proof of business continuity plan execution and effectiveness.

### Additional findings

The same document also triggered a review blocker for effectiveness review
(`NIS2-ASSURE-08`). This is defensible because missing restore testing can
indicate incomplete control-effectiveness review, but it is broader than the
document’s direct assertion and can create double remediation for one issue.
The reviewer resolved it as covered by the backup action.

More importantly, the single backup document was retrieved and cited for all
ten requirements. For eight unrelated categories, the model correctly said
the document did not address that category, yet changed evidence sufficiency
from the no-document baseline of `none` to `partial`. An unrelated document
should not increase evidence sufficiency.

The manual correction also exposed a consistency gap: structured
`evidenceSufficiency` was corrected to `sufficient`, but the copied AI
rationale still ends with “Evidence sufficiency is none.” The correction
workflow permits structured fields and prose to disagree.

Judgment: **Pass for contradiction handling; partial pass for retrieval,
evidence scoring, and correction consistency.**

## Action-plan creation assessment

Action-plan creation itself behaved exactly as implemented:

```text
fulfilled -> no item
partially_fulfilled -> item
not_fulfilled -> item
insufficient_evidence -> item

item title       = localized requirement title
item description = source finding recommendation
item priority    = source finding severity
item status      = open
```

This boundary passed in all cases. It also means action-plan quality cannot be
better than recommendation quality. The action-plan service does not add
specificity, split category-sized recommendations, or distinguish
evidence-gathering from control remediation.

## Citation and grounding assessment

Every finding had at least one permitted legal citation, and the contradictory
document was cited with the exact indexed excerpt. Citation IDs were valid and
restricted to supplied context.

Semantic citation precision was mixed in spot checks. Relevant primary-law
chunks were present, but some selected citation lists also included broad
recitals, neighboring provisions, or provisions with weak direct support for
the generated sentence. Presence/ID validation therefore passed; the test does
not establish that every selected legal excerpt is the best authority for the
claim.

## Recommended product changes

1. **Generate recommendations from deficient questions, not only the category.**
   Pass the precise triggering answers into a recommendation rule or require
   the model to state which controls are already satisfied and exclude them
   from remediation.

2. **Separate evidence work from remediation work.** For
   `insufficient_evidence`, default to “verify and collect evidence,” followed
   by conditional remediation. Do not infer that an unknown control is absent.

3. **Apply a document-relevance threshold per requirement.** Do not cite an
   unrelated selected document merely because it is the only available
   document, and do not increase evidence sufficiency because unrelated text
   was retrieved.

4. **Improve legal-citation ranking.** Prefer the mapped operative provision
   over broad contextual chunks as the primary legal citation.

5. **Validate correction consistency.** When status or evidence sufficiency
   changes, require an updated rationale or automatically mark the prose as
   stale. Structured fields and explanatory text should not contradict one
   another in an accepted revision.

6. **Make action items execution-ready.** Preserve the current source
   recommendation, but add a concrete objective, deliverables/acceptance
   criteria, and suggested evidence. A single category title is too broad for
   reliable ownership and closure.

## Saved artifacts

- [Manifest](./manifest.json)
- [Runner stdout](./runner.stdout.log)
- [Runner stderr](./runner.stderr.log)
- [Reproducible evaluation runner](../../../scripts/manual-gap-action-plan-evaluation.ts)

The stderr log records the first case-5 finalization halt when the additional
`NIS2-ASSURE-08` review blocker was discovered. The runner was resumed against
the same organization, all blockers were explicitly resolved, and the
manifest/final case JSON contain the completed accepted revision and plan.

Each case JSON includes the questionnaire inputs, optional document content,
model/provider metadata, token usage, validated raw model output, supplied
grounding context, normalized findings and evidence, generated and reviewed
revision metadata, final action-plan rows, and automatic expected-versus-actual
checks.
