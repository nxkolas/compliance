# Gap Analysis cycle, progress, and async revisions qualification

- Date: 2026-08-01
- Updated: 2026-08-02
- Environment: local Postgres; portable job execution and recovery topology
- Default category concurrency: 3
- Default shared provider permit limit: 3 (`AI_PROVIDER_MAX_CONCURRENCY`)

## Implemented qualification

- Drizzle Kit `push` applied the additive job-progress columns, constraints,
  and active revision-mutation uniqueness index. No migration workflow was
  used.
- The final static suite passed: lint, TypeScript, i18n, 749 tests passed and
  6 tests skipped.
- Database integrity verification passed 10 constraints, 9 deferred triggers,
  4 rejected invalid transactions, and 1 valid transaction.
- The read-only Gap page benchmark used three warm samples. Its cold result was
  1798.2 ms; warm samples were 302.3, 333.4, and 305.5 ms; warm p50 was
  305.5 ms with 12 SQL calls and 2.4-2.9 ms measured PostgreSQL execution. The
  benchmark reference was 2480 ms, an approximately 87.7% lower warm p50.

## Provider and API-call changes

- Gap generation still makes one chat operation per category. Action Plan
  generation still makes one chat operation per actionable category. Focused
  repairs, corrections, and guidance regeneration remain additional category
  calls when required.
- Provider policy and Legal Corpus release pins are prepared once per Gap
  batch instead of once per category.
- Legal and organization retrieval execute concurrently within a category.
- Initial Gap retrieval queries are embedded in batches grouped by embedding
  space. With ten categories and the default batch size of 64, a no-document
  run changes from 10 embedding API requests to 1 request containing 10 items;
  a run with selected documents changes from 20 requests to 1 request
  containing 20 items. Repairs embed changed queries separately. Action Plan
  retrieval is not included in this Gap embedding batch.
- `AI_PROVIDER_MAX_CONCURRENCY` limits simultaneous chat calls across Gap,
  Action Plan, repair, correction, and guidance work in one Node.js process.
  It does not limit embedding calls and is not shared across application
  instances.

## Exploratory OpenAI run at category/provider concurrency 5/3

One paid bilingual run used `AI_CATEGORY_CONCURRENCY=5` with the provider cap
at 3. It covered the existing five English and five German cases. This was a
single functional/quality run, not an A/B comparison against category
concurrency 3 and 4, so it cannot establish that 5 is faster.

| Metric | English | German |
| --- | ---: | ---: |
| workflows passing automatic checks | 5/5 | 5/5 |
| successful generation jobs | 10/10 | 10/10 |
| initial categories accepted | 75/75 | 75/75 |
| provider failures / repairs | 0 / 0 | 0 / 0 |
| provider latency p95 | 26.740 s | 27.375 s |
| Gap job latency p95 | 32.429 s | 34.532 s |
| Action Plan job latency p95 | 31.461 s | 32.091 s |
| input tokens | 998,926 | 1,025,115 |
| output tokens | 262,743 | 316,981 |

The run recorded 154 provider attempts across both locales. Every attempt
succeeded on attempt 1; no provider failure or repair occurred. All ten
workflows and all twenty generation jobs passed their automatic workflow
checks. The offline content gate retained one English violation: case 7,
requirement `NIS2-ASSURE-08`, produced an Action Plan result with three
sentences where the limit permits two. German had no offline violation. Human
review remains pending in the generated checklist.

Evidence:
[bilingual run manifest](./gap-action-plan-manual-evaluation-concurrency5-openai-bilingual-once-2026-08-01/manifest.json)
and
[manual review checklist](./gap-action-plan-manual-evaluation-concurrency5-openai-bilingual-once-2026-08-01/manual-review-checklist.md).

## Provider concurrency decision

The default remains 3. The application already allowed three category calls
in parallel before this work. At category concurrency 5 and provider limit 3,
two category workers may overlap preparation or wait for a permit, but only
three OpenAI chat calls can run simultaneously. The single 5/3 run therefore
shows functional stability, not a repeatable latency improvement.

Changing the default still requires matched production-like runs at category
concurrency 3, 4, and 5 with the same pinned fixture and provider limit. Reject
the change on any material increase in throttling, malformed output, retries,
database saturation, or cancellation-settlement failures.
