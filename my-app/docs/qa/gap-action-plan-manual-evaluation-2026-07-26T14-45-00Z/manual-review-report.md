# Gap Analysis guided-v5 release review

Date: 2026-07-26  
Environment: authorized disposable development database  
Overall result: **Pass**

## Decision

`nis2-gap/guided-v5` satisfies the plan's definition of done in the disposable
release rehearsal. The result is an unconditional **Pass** for product
behavior and content quality.

The active release is:

- Gap release: `b1bde7b3-4e04-4c75-98a7-22ffbb94c2c8`
  (`nis2-gap/guided-v5`)
- Compatible applicability release:
  `d1a4be1c-0e70-4b4e-904c-ac85b877a6ee`
- Provider/model: OpenAI `gpt-4.1`
- Prompt: `nis2_gap_guidance` version 6
- Response schema: version 6
- Prompt template hash:
  `a9e66bc3a832faef7ec5e9d8f856037f91e026a47db4b5a91943ca58fdef3ba9`
- EU corpus release: `d84dfae5-d025-4c98-87a7-9000339be358`
- German corpus release: `6295458f-2677-4a11-96ec-0946bff9aa0a`

The exact database snapshot, hashes, pointers, per-revision guidance lineage,
token usage, and run IDs are recorded in
[`exact-release-prompt-schema-provider-metadata.json`](exact-release-prompt-schema-provider-metadata.json).

## QA outcome

| Scenario | Status shape | Plan items | Automatic checks | Result |
| --- | --- | ---: | ---: | --- |
| Mature baseline, English | 10 fulfilled | 0 | 73/73 | Pass |
| Absent controls, English | 10 not fulfilled | 10 | 83/83 | Pass |
| Mixed maturity, English | 6 fulfilled, 2 partial, 1 uncertain, 1 absent | 4 | 77/77 | Pass |
| Evidence uncertainty, German | 10 uncertain | 10 | 83/83 | Pass |
| Contradictory backup evidence, English | 10 initially fulfilled; backup corrected to absent | 1 | 80/80 | Pass |
| Post-finalization live lifecycle | edit/audit/concurrency/locks | 1 exercised | 6/6 | Pass |

Total: **402/402 checks passed** with zero failed checks.

The complete machine-readable comparison is
[`automatic-comparison-results.json`](automatic-comparison-results.json).
The reviewer's qualitative assessment is
[`manual-content-judgments.md`](manual-content-judgments.md).

## Acceptance matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Determinism | All 50 generated statuses and severities match the expected fixtures | Pass |
| Triggering | Structured work contains every and only work-driving question | Pass |
| Uncertainty | Every unsure answer maps to verification, never confirmed absence | Pass |
| Fulfilled wording | Explicit self-report framing; maintenance/evidence readiness; no execution item | Pass |
| Document relevance | Relevant contradiction admitted; unrelated/adjacent/generic/short fixtures rejected | Pass |
| Sufficiency | No admitted document forces `none`; higher sufficiency cites admitted evidence | Pass |
| Contradiction | Backup conflict is cited, review-blocking, and status-preserving before correction | Pass |
| Legal authority | Every primary legal citation is mapped operative authority | Pass |
| Correction | Material change creates a distinct valid regeneration run and consistent revision | Pass |
| Regeneration | Guidance-only retry creates a new run/revision without changing assessment facts | Pass |
| Plan cardinality | One item per non-fulfilled finding; zero per fulfilled finding | Pass |
| Plan structure | Every item has objective, deliverables, criteria, and evidence | Pass |
| Plan immutability | Generated fields reject patches | Pass |
| Execution | Status, owner, due date, and notes are editable, versioned, and audited | Pass |
| Language | Generated prose remains in the pinned English/German locale | Pass |
| Safety | Customer projections omit raw evidence excerpts, policy diagnostics, and model provenance | Pass |
| Lifecycle | Plan creation permanently locks correction and regeneration | Pass |
| Rollout | Existing clear/push/seed/review/publish/activate commands reproduced the environment | Pass |

## Verification evidence

The completed gates were lint, typecheck, 555 unit tests, i18n, AI/grounding,
worker, route, report, production build, rollout, mapped authority, RLS,
database integrity, zero schema drift, authenticated Gap workflow, country
support, storage, corpus smoke, and performance assertions.

The machine-readable QA results and release provenance remain in
[`automatic-comparison-results.json`](automatic-comparison-results.json) and
[`exact-release-prompt-schema-provider-metadata.json`](exact-release-prompt-schema-provider-metadata.json).
The threshold calibration remains in
[`threshold-calibration-summary.json`](threshold-calibration-summary.json).

## Artifact hygiene

All stored console-output `.txt` files were removed at the user's request.
The canonical case JSON, comparison, provenance, lifecycle, calibration, and
review reports remain.

## Release boundary

This report validates product behavior, provenance, controls, and generated
content quality in the disposable development rehearsal. It does not provide
independent legal advice, certify the legal completeness of the source
corpus, or determine whether a specific organization complies with NIS2.
