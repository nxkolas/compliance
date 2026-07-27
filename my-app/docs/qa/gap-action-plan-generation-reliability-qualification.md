# Gap and Action Plan generation reliability qualification

Date: 2026-07-28

Release: `nis2-gap/reliability-v1`

- Database release ID: `62fce32d-803e-44fa-b6ba-66bd6300dfdd`
- Status: published
- Active pointer: activated on 2026-07-28 (Europe/Berlin)
- Gap contract: prompt/response v8
- Action Plan contract: prompt/response v2

## Automated and live evidence

The five-scenario live matrix completed for mature English, absent-control
English, mixed English, uncertainty-heavy German, and contradictory document
evidence. The matrix exercised correction, review-blocker resolution,
single-finding regeneration, and Action Plan activation. Later qualification
runs used the corrected release-aware harness; every recorded automated check
in those runs passed.

Final provider-schema sample:

| Locale | Workflows | Initial categories | First-pass rate | Successful jobs | Stale job errors | Gap p95 | Action p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| English | 5 | 100 | 100% | 10/10 | 0 | 22.0s | 28.4s |
| German refresh | 2 | 40 | 100% | 4/4 | 0 | 24.4s | 30.5s |

The German refresh followed an earlier 100-category, five-workflow German
v8/v2 sample. Further live repetition was stopped at the user's request.

Provider telemetry for the final provider-schema sample:

| Locale | Phase | Runs | Average latency | p95 latency | Input tokens | Output tokens | Cached input tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| English | initial | 100 | 11.9s | 18.5s | 1,083,002 | 80,682 | 13,824 |
| English | repair | 0 | n/a | n/a | 0 | 0 | 0 |
| German | initial | 40 | 13.6s | 22.8s | 456,695 | 37,233 | 4,864 |
| German | repair | 0 | n/a | n/a | 0 | 0 | 0 |

All sampled jobs completed on their first job attempt. Category concurrency is
bounded to three and is covered by coordinator tests.

## Fault evidence

- A real concurrent-load test crossed the provider TPM limit and exercised
  HTTP 429 plus `Retry-After`. Bounded retries exhausted under sustained
  overload, and no partial Gap revision or Action Plan was persisted.
- That test exposed a v8 Gap job retry budget of one. The v8 budget is now
  three while v7 retains its historical value; successful category provider
  runs are recovered by stable idempotency keys.
- Active Action generation cancellation was requested only after an
  `ai_processing_run` entered `processing`. The final job reached `cancelled`
  in 1,132ms, classified `GENERATION_CANCELLED`, and persisted zero plans.
- Timeout, terminal-input, cancellation, repair exhaustion, 429 retry,
  category recovery, concurrency, stable ordering, and safe diagnostics have
  deterministic test coverage.

## Persistence and compatibility

- Final repository verification passed lint, TypeScript checking, all 586 tests
  across 105 files, and the i18n guard.
- `git diff --check` passed; the reported line-ending notices are the
  repository's existing Windows checkout conversion behavior.
- Database integrity verification passed 10 constraints, 9 deferred triggers,
  four rejected invalid transactions, and one valid transaction.
- Typed result triggers and active-job uniqueness cover legacy and versioned
  Gap/Action job kinds.
- Historical Gap v7 and Action Plan v1 loading remains supported.
- Successful job DTOs clear and suppress stale safe errors.
- The release was initially published without changing the active pointer.
  It was subsequently activated at the user's direction. The activation
  history records `guided-v6` as the previous release.
- The post-activation Gap smoke test passed for `reliability-v1`, including
  release metadata, mapping coverage, RLS, storage, triggers, and workflow
  consistency.

## Content review

English gaps were concise, confirmed-kind wording was traceable to exact
questionnaire triggers, and English actions covered their source gaps.

German gap wording was readable and correctly preserved uncertainty. The
German Action sample exposed three issues that automated checks had missed:

- a backup-restoration example leaked into unrelated categories;
- some verification results restated uncertainty instead of the completed
  verification outcome; and
- lowercasing the first German remediation word damaged noun capitalization.

The runtime now rejects copied example subjects outside the continuity
category, requires a completed verification result, and preserves German noun
capitalization. Focused regressions cover all three.

## Release decision

`reliability-v1` is active. The user explicitly requested activation after
reviewing the qualification outcome. Two previously recorded content-review
caveats remain part of the audit trail:

- the final German semantic backstops were not live-requalified after the
  content-review fix; and
- an independent English/German reviewer did not sign off before activation.
