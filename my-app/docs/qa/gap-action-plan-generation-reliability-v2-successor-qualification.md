# Gap and Action Plan objective-contract successor qualification

Date: 2026-07-29

Status: `reliability-v7` active; post-activation structural and live smoke passed.

## Immutable release chain

| Release          | Database ID                            | Gap | Action | Aggregate hash                                                     | Outcome                              |
| ---------------- | -------------------------------------- | --- | ------ | ------------------------------------------------------------------ | ------------------------------------ |
| `reliability-v2` | `f2fd084d-957b-4302-81d8-af6e4d119b74` | v9  | v3     | `1a6ca39c2ffbd2a71f0894607e5a2a72b646869075a7ddd207f1712e498786a8` | Failed inactive qualification        |
| `reliability-v3` | `1124ff53-6d5e-4dc8-ac06-b0b2aae7daed` | v10 | v3     | `8291b3dc509a95687eddb2ce1c9dd3df5b2b3f5f1fe90cbbc67233fb5b3b4125` | Failed inactive qualification        |
| `reliability-v4` | `f6aca6f1-8323-402f-99b8-b5fdc1549bbf` | v10 | v4     | `82b4f972918858d7698b910fb42e8fe3f32d9793188f5435d96e8bfb189123d9` | Failed inactive qualification        |
| `reliability-v5` | `678fd41f-bfe3-42dc-bcac-ec5819cb9ed4` | v11 | v4     | `13e4e553e6b35c115ee70ead9a689828006c4d32b43ceb97423d147d84e9e99c` | Failed inactive qualification        |
| `reliability-v6` | `7c1d17e1-fe63-4b2d-b6bf-7e99b3c5a4be` | v11 | v5     | `bcc20f4dce1fd31580e1eb78d9ac6a211d1ca49a769579db24ad1788bec51b98` | Failed inactive qualification        |
| `reliability-v7` | `2b3c029a-88a6-4dd7-8835-713495ea29ce` | v11 | v6     | `d396f46243f967c12a7ee6ff2fa8747db545a2f0251dbf1fb8f41ee9233e8d21` | Active; structural/live smoke passed |

Contract template hashes:

- Gap v9: `ebb02c45c5d6b4eda24b0032582a187220ffa578020d5a34eb88a7b8c7714fde`;
- Gap v10: `9568858fa35f45d80e03ea924d1d323ff6ac57d996523fd0e9ae904eade2441a`;
- Gap v11: `05316ed25080b776a2718df24f4b88a2191e7aba512a31c1b0450224a8231494`;
- Action Plan v3: `ccfeeedfe67fc5af40682c1729cc50161313f0f42657b7f4370f57a5ebd2afce`;
- Action Plan v4: `ebd4f3a2040629ed3bb03706e2db4b2e3d6fb7a9452fb07366a87f3e0e24639b`.
- Action Plan v5: `7f331cf2191dae2c25e7166e9430d16bd20392392ad1e4b011ea5dba80e85fd1`.
- Action Plan v6: `b977318ddbe274dc29555ee24c971d1802f9f8c29159a73621135a016b6d8627`.

The active v8/v2 compatibility locks remain:

- Gap v8 bilingual template hash:
  `273b99d88b5ecc2b0ee90d8b95cdc9a7c4289e1192b441a83162d669766812bc`;
- Action Plan v2 bilingual template hash:
  `fd2d934826d92a98f98941e63e9dc038264006e3e5ed507731e300190e1dc184`;
- Gap v8 response-schema fixture hash:
  `455f8903dfd519d012e3d362281f9c1a5c453ef5c8aea86596aeba7e2806a43f`;
- Action Plan v2 response-schema fixture hash:
  `8940546a1924dcb6af14cea2cb2a947d99e1d71aacf6f25a11dd4facdc2a15fb`.

No v8 assessment, reassessment draft, generated revision, or audit history was
migrated, repinned, or retried under a successor contract.

## Qualification findings

`reliability-v2` was never activated. Live qualification found an objective
URL/raw-identifier safety rejection that v9 reported only as generic
`content_invalid`, so the single repair could not target the unsafe field.
Gap v10 was published as an immutable successor with targeted `url_forbidden`
and `raw_identifier` diagnostics and repair guidance.

`reliability-v3` was never activated. English absent-controls qualification
then found that Action Plan v3 correctly rejected a raw identifier, but its
repair prompt omitted the meaning of `action_raw_identifier`. One repaired
category succeeded; another exhausted its repair. Active siblings were
cancelled and settled in 106 ms, and the primary repair-exhaustion error was
preserved. Action Plan v4 was published as an immutable successor with the
missing objective initial and repair guidance.

The focused `reliability-v4` absent-controls rerun passed Gap v10 and Action
Plan v4 end to end. Gap generation used one accepted objective
`review_notice_state` repair; superseded candidate runs were closed before
success. All ten Action Plan categories passed their initial attempt.

The complete v4 matrix was stopped after its English absent-controls artifact
failed the offline content gate: several Gap statements exceeded 20 words and
continuity statements included legal exposition. The runtime correctly
accepted that structurally valid prose; activation was blocked by offline
qualification instead. Gap v11 was published as a prompt-only immutable
successor with explicit concision, direct-fact, and no-legal-exposition writing
constraints. Its focused absent-controls rerun passed all 96 automated checks,
with 31 atomic gaps, 26 actions, and zero terminal-parent processing children.

The v11/v4 focused artifact then failed manual Action content review because
several results named statutes, directives, articles, and sections and were
substantially longer than the preferred operational result. The runtime again
correctly accepted structurally valid prose; offline qualification blocked
activation. Action Plan v5 was published as a prompt-only immutable successor
with explicit operational-only, title, result, evidence, and no-legal-
exposition writing constraints. Its focused absent-controls artifact passed all
automated checks and manual bounds: no legal exposition, no title above 12
words, no result above 40 words or two sentences, complete coverage, and zero
terminal-parent processing children.

The v11/v5 bilingual run was stopped after its English uncertainty artifact
exposed repeated conditional assembly in several Action results. The model put
an `if verification identifies ...` lead-in in `verificationResult`, and the
server then added the same localized condition before
`conditionalRemediation`. Action Plan v6 was published as a prompt-only
immutable successor. It assigns verification outcome and remediation content
to separate fields, prohibits model-authored conditional lead-ins, and budgets
the two fields at 18 and 16 words. The objective v5 validator remains
unchanged. Focused Action Plan v6 English and German uncertainty reruns under
`reliability-v7` passed with exactly one server-owned conditional per rendered
action.

## Automated and database evidence

- ESLint: pass.
- TypeScript: pass.
- i18n guard: pass.
- Vitest: 664 passed, with 4 connected-database tests skipped in the
  environmentless full run.
- Connected generation lifecycle suite: 4 passed.
- Database integrity: 10 constraints, 9 deferred triggers, four deliberately
  rejected invalid transactions, and one valid transaction passed.
- `git diff --check`: pass; Windows checkout line-ending notices only.
- Active pointer after every publication: `reliability-v1`, Gap v8, Action
  Plan v2.

## Bilingual live matrix

The ten-case `reliability-v7-bilingual` matrix covers mature, absent, mixed,
uncertain, and contradictory-evidence scenarios in both English and German.
Machine-readable results, per-locale first-pass/repair rates, provider and
workflow latency, token usage, and terminal-child invariants are written to
`docs/qa/gap-action-plan-manual-evaluation-reliability-v7-full`.

All ten workflows passed every automatic check. Both contradictory-evidence
cases blocked finalization, accepted a structured reviewer correction, and
regenerated only the affected category before Action Plan generation. Offline
quality scoring found zero violations in either locale, including the
duplicate-conditional dimension, and all terminal-parent processing-child
counts were zero.

The full matrix generated 75 categories per locale. The focused v7 evidence
set adds mixed-maturity and uncertainty workflows in both locales, recorded in
`docs/qa/gap-action-plan-manual-evaluation-reliability-v7-focus`, bringing the
qualification total to 109 categories and seven successful workflows per
locale:

| Locale | Initial accepted | Repair accepted | First-pass rate | Provider max | Workflow max | Input tokens | Output tokens |
| ------ | ---------------- | --------------- | --------------- | ------------ | ------------ | ------------ | ------------- |
| EN     | 107 / 109        | 2 / 2           | 98.17%          | 33.204 s     | 38.335 s     | 1,389,532    | 428,025       |
| DE     | 108 / 109        | 1 / 1           | 99.08%          | 38.811 s     | 41.874 s     | 1,419,539    | 467,043       |

No repair was exhausted, all 28 generation jobs succeeded, and the observed
maximums remain below the 60-second p95 gate. Agent-assisted inspection covered
every scenario identity and both locales; the generated Gap and Action prose
was direct, operational, and appropriately conditional. The generated manual
review checklists intentionally remain unsigned because independent English
and German human review has not been performed.

## Historical orphan repair gate

The operator-approved apply selected and closed all 39 terminal-parent
processing runs, including the four known incident children beneath parent
`67d29cee-4cf0-4fed-aa3d-1bcaae1d1128`. It changed 39 rows, skipped zero, and
reported zero remaining. The immediate follow-up dry-run selected zero rows,
confirming idempotency and a clean global invariant. The 143 historical late
category diagnostics remain recorded for audit; the incident v8 draft was not
retried or repinned.

## Activation decision

At explicit operator direction, `nis2-gap/reliability-v7` was activated on
2026-07-29 with Gap prompt/schema v11 and Action Plan prompt/schema v6. The
activation audit row identifies the environment's active platform
administrator. The post-activation structural smoke passed, and the subsequent
orphan dry-run still reported zero terminal-parent processing children.

The post-activation live smoke created a new English assessment and completed
all ten Gap v11 categories plus Action Plan v6. All ten categories passed on
the initial attempt, both generation jobs succeeded, all automatic checks
passed, offline quality reported zero violations, and no terminal parent
retained a processing child. The partial manifest and review checklist are in
`docs/qa/gap-action-plan-manual-evaluation-reliability-v7-post-activation`.

This activation does not represent independent content sign-off. The English
and German review checklists remain unsigned and must stay recorded as an open
rollout caveat until independent reviewers complete them.
