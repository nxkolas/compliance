# Gap Analysis and Action Plan workflow

Status: `reliability-v8` is active with the immutable Gap v12
contradiction-only review policy.

## Analysis cycle and browser reads

The user-facing and application-domain name for the persisted generation input
bundle is **analysis cycle**. An analysis cycle pins one submitted questionnaire
revision, the selected current document versions, the Gap release, output
locale, generation job, and generated Gap revision. The existing
`gap_reassessment_*` tables and historical `gap_reassessment.*` audit events
retain their names for persistence compatibility; they are projected as an
analysis cycle at the TypeScript, HTTP, client, and UI boundaries.

The initial post-generation page reads the Results projection. Inputs and
History have separate authorized read endpoints and load only when their tabs
are opened. This keeps their heavier provenance and audit projections out of
the normal Results response. The local benchmark recorded a 305.5 ms warm p50
for the Gap page with 12 SQL calls, compared with the benchmark's 2.48 s
reference.

## Domain model

Each Gap revision contains one deterministic category finding per requirement.
A fulfilled category has no child gaps. Every non-fulfilled trigger has one to
five immutable atomic gaps. Each gap is one short missing, partial, or uncertain
fact and is traceable to one questionnaire answer plus its admitted sources.

Gap results show categories in release order, including fulfilled categories.
They expose only status, severity, an optional review notice, atomic statements,
and the category-level **Sources used** projection. Remediation prose is not
stored on or returned with a Gap finding.

## Action Plan generation

Selecting **Create action plan** enqueues a response-schema-versioned
`action-plan-generation-vN` background job and returns HTTP 202. The worker
loads the exact current Gap revision, all answers in each category, pinned
documents, mapped legal context, and the release-pinned locale. It then runs a
distinct grounded AI operation.

Generated actions stay within one category. An action may cover several gaps,
and a gap may be covered by several ordered actions. Every gap and every action
must be linked. Priority is inherited from the category; generated content is
limited to title, result, and recommended evidence. Status, owner, due date, and
execution notes remain editable.

Persistence is atomic and exactly once by generation job. A successful job
approves and accepts the source Gap revision, activates one plan, stores actions
and their gap links, and publishes the plan ID through the job result. Failure
or cancellation leaves no partial plan. A terminal job cannot retain a linked
AI run in `processing`; success closes superseded repair candidates, failure
and cancellation close every linked run, and scheduled cleanup reconciles any
historical anomaly.

## Review and lifecycle

Contradictory evidence produces a separate, non-blocking review notice. Missing,
irrelevant, insufficient, or uncited Organization Evidence is represented by
the normal document/evidence indicators and does not create a review notice.
Before a plan exists, an optional structured reviewer correction regenerates
the affected category and copies unchanged category children into a new
immutable revision. Correction and guidance-regeneration commands return
`202 Accepted` with a cancellable `gap-revision-mutation-v1` job; the browser
uses the shared job poller instead of holding the mutation request open.
Queued or running Action Plan generation reserves the Gap revision; an active
plan locks it permanently.

Gap jobs expose monotonic phase and unit progress through `/api/jobs/{jobId}`:
evidence preparation, generated categories, validation, persistence, and
completion. Questionnaire answer saves separately report locally answered and
server-confirmed required-question completion.

## Generation performance and provider concurrency

Full Gap generation still performs one chat generation per category. The
performance work changes preparation and scheduling rather than merging prompt
contracts:

- provider policy and corpus-release pins are resolved once per Gap batch;
- initial legal and organization retrieval searches run concurrently;
- initial category retrieval queries are embedded in batches grouped by the
  configured embedding space; and
- one process-wide provider limiter is shared by Gap, Action Plan, repair,
  correction, and guidance calls.

With the default embedding batch size of 64, a normal ten-category initial Gap
run uses one embedding API request containing ten legal queries, or twenty
legal and organization-document queries when documents are selected. Before
batching, those paths normally used ten or twenty embedding API requests.
Repairs embed their changed queries separately. Action Plan retrieval is not
part of this Gap embedding batch.

`AI_CATEGORY_CONCURRENCY` accepts 1-5 and controls category workers.
`AI_PROVIDER_MAX_CONCURRENCY` accepts 1-100 and limits simultaneous chat calls
per Node.js process. Both default to 3. The application already ran three
categories concurrently before this work. Therefore category concurrency 5
with provider concurrency 3 overlaps more preparation but still permits only
three simultaneous OpenAI chat calls and is not expected to materially reduce
provider-bound latency.

The 2026-08-01 bilingual OpenAI run at category/provider concurrency 5/3
completed all ten workflows and all 154 recorded provider attempts without a
provider failure or repair. It was not an A/B comparison and does not justify
raising either default. One English Action Plan result contained three
sentences where the offline quality limit permits two, so automated workflow
qualification passed while the offline content gate retained one violation.
The limiter is process-wide, not deployment-wide across multiple application
instances.

## Contract boundary

The release owns the expected Gap kind and Action mode. The provider writes
localized prose around those facts. Current objective contracts reject invalid
shape, identity, coverage, citation, locale, URL, and raw-identifier output.
They do not reject prose for missing a keyword, preferred synonym, imperative
style, sentence shape, legal-language regex, or verification-first verb.
Those writing goals are prompt and offline-qualification concerns.

Published releases are immutable. Gap v12 and Action Plan v6 are the active
contracts. Earlier releases remain historical records of their qualification
and activation state rather than having their published metadata rewritten:

- `reliability-v2`: Gap v9 / Action Plan v3;
- `reliability-v3`: Gap v10 / Action Plan v3;
- `reliability-v4`: Gap v10 / Action Plan v4;
- `reliability-v5`: Gap v11 / Action Plan v4;
- `reliability-v6`: Gap v11 / Action Plan v5;
- `reliability-v7`: Gap v11 / Action Plan v6; and
- `reliability-v8`: Gap v12 / Action Plan v6.

## Release and verification

Publish and qualify a repository release without activating it:

```powershell
npm.cmd run db:publish:gap -- --release nis2-gap/reliability-v8
npm.cmd run eval:gap-action-plan-manual -- --gap-release-version reliability-v8
```

Run the manual evaluator before activation and inspect its timestamped JSON and
Markdown artifacts for both German and English generated prose. Activation is
a separate operator decision after automated, database, content, and orphan
repair gates pass.
