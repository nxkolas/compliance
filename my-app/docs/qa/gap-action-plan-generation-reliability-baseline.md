# Gap and Action Plan generation reliability baseline

Baseline date: 2026-07-27

This baseline records the final v7/v1 manual QA cycle before the reliability
contracts were introduced. The immutable source artifacts remain under
`docs/qa/gap-action-plan-manual-evaluation-2026-07-26-final-cycle2`.

| Scenario | Locale | Final outcome | Attempts | Observed issue |
|---|---|---:|---:|---|
| Mature baseline | en | completed | 1 | none |
| Absent controls | en | completed | 1 | none |
| Mixed maturity | en | completed | 2 | whole workflow regenerated |
| Uncertain evidence | de | completed | 4 | whole workflow regenerated; about 249 seconds |
| Contradictory backup evidence | en | completed | 1 | none |

The observed complete-workflow first-attempt rate was 60% (3/5). The sample is
too small to estimate the production category pass rate. The two retried cases
also retained `safeErrorCode: "JOB_FAILED"` after success in the archived
cycle-2 artifacts.

This baseline is descriptive, not a qualification result. Reliability-v1 must
be evaluated independently with at least 100 category generations per locale,
multiple complete 10-category workflows, timeout/429 simulations, and
cancellation during an active provider call before activation.
