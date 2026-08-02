# Schema simplification implementation audit

> **Historical point-in-time assessment.** The code defects described below
> have been remediated and automatically verified; connected clean-database and
> active-corpus verification is still pending. See the
> [remediation evidence](schema-simplification-remediation-evidence-2026-08-02.md).
> The original findings and severity statements are preserved below unchanged.

Date: 2 August 2026  
Plan: [`schema-simplification-refactor.md`](../plans/done/schema-simplification-refactor.md)  
Reviewed range: `daee67f28a4f4cc1196be30aa72e2a79c6b3842f...662e24cff8ce83a5c615b473890828cc7b7b74fb`  
Implementation commits: `2fb7cbc`, `b8ad719`, `a04b396`, `8852ff6`, `662e24c`

## Executive conclusion

The plan is **not implemented as specified**. The schema simplification itself is
substantially present, but the central product behavior was regressed during the
workflow cutover:

- Gap generation no longer calls an AI provider, performs retrieval, or creates
  evidence-specific atomic gaps. It creates one generic result per unfulfilled
  category.
- Action Plan generation no longer calls an AI provider. It copies the generic
  Gap guidance into one item per finding.
- The persisted AI records describe those deterministic placeholder builders as
  successful AI runs, copy the configured provider into the historical provider
  field, and contain no admitted context, citations, token usage, or cost.
- Selected documents are recorded as lineage, but are not used by Gap generation.
- Publication and retry behavior is not atomic, so partial results can be left
  behind and later treated as successful.
- Several secondary requirements are missing or contradicted: historical result
  navigation, stale-result downstream blocking, archived-document exclusion,
  meaningful report rendering, cleanup coverage, legal-corpus provisioning,
  generation idempotency/rate limiting, and some authorization/concurrency rules.

The plan's header says `implemented and verified` and states that the relevant AI
suites passed ([plan lines 3-10](../plans/done/schema-simplification-refactor.md#L3)).
That status is not supported by the runtime behavior. The commands do pass, but
the retained tests do not exercise a fresh grounded Gap-to-Action-Plan generation
path.

## Scope and method

This audit compared the complete plan against all changes from the parent of the
first implementation commit through current `HEAD`:

```text
323 files changed
7,387 insertions
46,009 deletions
```

The review used four forms of evidence:

1. direct plan-to-code comparison;
2. review of the implementation diff and deleted coverage;
3. current automated verification results; and
4. read-only inspection of the development data created by the reported Gap and
   Action Plan runs.

This is an implementation audit, not a claim that every retained component is
broken. The 43-table target inventory, code-owned definitions, default-deny RLS
shape, immutable assessment/output identities, document indexing primitives,
and several direct foreign-key lineages are present.

## Runtime evidence from the reported organization

The inspected development organization
`3782a4c2-9a74-4ec9-a85b-0d0341ff3a0a` corroborates the code path:

- 31 `not_implemented` answers produced exactly 10 findings, 10 Gap items, and
  10 Action Plan items: one item for each requirement/category, not atomic
  answer-specific gaps or independently generated remediation actions.
- Every Gap statement was `Die Anforderung ist nicht erfüllt.`
- Every recommendation and Action Plan description was
  `Dokumentierte Maßnahmen zur Schließung dieser Lücke planen.`
- The Gap and Action Plan AI runs used models `deterministic-gap-v1` and
  `deterministic-action-plan-v1`.
- Their provider value was `openai`, but token, output-token, and cost values were
  null; start and completion were recorded at the same instant.
- `ai_processing_run_context` contained no rows for the generation lineage, and
  neither findings nor Gap items had context links.
- The Gap job completed in about 1.25 seconds and the Action Plan job in about
  0.64 seconds, consistent with the deterministic database-only builders.

## Plan compliance matrix

| Plan area | Result | Evidence |
| --- | --- | --- |
| Code-owned executable definitions | Implemented | Definitions and hashes are loaded from `src/server/definitions`; runtime database release selection was removed. |
| Germany-only Gap jurisdiction | Implemented | Eligibility is checked against the code-owned applicability definition. |
| Organization/access simplification | Partial | Simplified roles and provider mode exist, but final-owner enforcement has a concurrency race and invitation cleanup is only opportunistic. |
| Immutable applicability revisions | Mostly implemented | Stable assessments/revisions and localized answer snapshots exist; the post-rollout `662e24c` hotfix repaired submission lineage/hash handling. |
| Stable analysis outputs and lineage | Partial | Direct assessment/applicability references exist, but successful publication is not atomic. |
| Gap cycle lifecycle | Partial | One-cycle/retry/prefill primitives exist; history does not expose usable historical revision identities. |
| Normalized findings and atomic gaps | **Contradicted** | The runtime creates one generic Gap item per non-fulfilled finding rather than answer/evidence-specific atomic gaps. |
| Exact evidence and contradictions | **Contradicted** | Selected versions are stored but not retrieved; no initial context/citation links or contradictions are produced. |
| Document indexing | Partial | Parsing/chunking/embedding exists, but Gap generation is disconnected from retrieval and archived documents can still be selected by ID. |
| AI processing provenance | **Contradicted** | Deterministic code is recorded as a succeeded AI run with a configured rather than actually used provider. |
| One-time generated Action Plan | **Contradicted** | The one-plan constraint and status-only mutations exist; real generated action content and many-to-many coverage behavior do not. |
| Reports | Partial | Direct IDs are pinned, but the PDF renders identifiers and a document count instead of the historical compliance result. |
| Jobs/idempotency/rate limiting | Partial | Durable jobs exist; Gap enqueue does not use the idempotency repository, Action Plan enqueue lacks the operation rate limit, and read capabilities can cancel jobs. |
| Legal corpus | Partial | Retained tables, processing, pinning, and snapshot activation exist; a clean installation has no operator writer for source/version/rendition/generation/binding data. |
| RLS and target schema inventory | Implemented | The target inventory/default-deny test is present and currently passes. |
| Dead-model removal and docs | Partial | A registered smoke script still queries removed tables, while current architecture/product documents describe behavior that the runtime no longer performs. |
| End-to-end verification | **Not demonstrated** | All current suites pass, but no retained test exercises fresh grounded Gap and Action Plan generation. |

## Critical contradictions

### C1. Grounded Gap generation was replaced by a deterministic placeholder builder

The plan explicitly retains normalized findings, atomic gaps, and exact context
citations ([plan lines 166-174](../plans/done/schema-simplification-refactor.md#L166))
and requires generation writers to use AI runs plus canonical context
([plan lines 483-489](../plans/done/schema-simplification-refactor.md#L483)).

The current worker instead:

- inserts a run with model `deterministic-gap-v1`
  ([analysis-cycle-service.ts:285-310](../../src/server/gap-analysis/analysis-cycle-service.ts#L285));
- computes deterministic category status from questionnaire options;
- assigns fixed status summaries and one fixed recommendation
  ([analysis-cycle-service.ts:360-386](../../src/server/gap-analysis/analysis-cycle-service.ts#L360),
  [analysis-cycle-service.ts:614-623](../../src/server/gap-analysis/analysis-cycle-service.ts#L614)); and
- creates exactly one Gap item for every actionable finding.

It never invokes `runGroundedOperation`, document retrieval, legal retrieval, an
AI provider, or the retained atomic-Gap generation contracts. The only live
server use of `createAiSdkGroundedProvider` in this domain is contradiction
resolution, which is unreachable for newly generated results because initial
generation never detects contradictions.

This is the direct cause of the generic category-level output reported by the
user.

### C2. Grounded Action Plan generation was replaced by field copying

The plan requires immutable **generated** content, a successful AI run, and
within-category many-to-many gap coverage
([plan lines 220-235](../plans/done/schema-simplification-refactor.md#L220),
[plan lines 505-512](../plans/done/schema-simplification-refactor.md#L505)).

The runtime records `deterministic-action-plan-v1`, then creates one action for
each actionable finding with:

```text
title       = finding.requirementTitle
description = finding.guidance
```

See [generation-service.ts:66-128](../../src/server/action-plans/generation-service.ts#L66).
There is no AI call, no action-specific synthesis, no citation generation, and
no possibility for multiple independent actions for a finding or Gap. The
many-to-many link table exists, but the writer creates only the trivial
one-finding-to-its-existing-gaps mapping.

### C3. AI provenance records events that did not happen

The plan distinguishes configured provider mode from the provider/model that
actually handled the run and requires durable lifecycle, input, validation,
context, token/cost, and failure provenance
([plan lines 208-218](../plans/done/schema-simplification-refactor.md#L208)).

Both generators insert `ai_processing_runs` directly in `succeeded` state before
publishing their business rows. They copy `organizations.aiProviderMode` into
`provider`, even though no provider is called, use synthetic deterministic model
names, set start and completion to the same timestamp, and write claims such as
`status: "validated"` without executing the retained grounded-output validation
pipeline. See
[Gap run creation](../../src/server/gap-analysis/analysis-cycle-service.ts#L291)
and [Action Plan run creation](../../src/server/action-plans/generation-service.ts#L73).

This is worse than missing optional telemetry: it makes historical provenance
misleading.

### C4. Evidence, citations, and material-contradiction behavior are disconnected

The plan makes exact admitted AI context authoritative and permits only material
direct contradictions to block the Action Plan
([plan lines 172-192](../plans/done/schema-simplification-refactor.md#L172)).

Current Gap generation reads selected document-version IDs into its manifest and
copies them into `analysis_output_document_sources`, but never reads their chunks
or writes `ai_processing_run_context`, `gap_finding_context_links`, or
`gap_item_context_links`
([analysis-cycle-service.ts:280-395](../../src/server/gap-analysis/analysis-cycle-service.ts#L280)).
The result reader hard-codes `sources: []` and `hasOrganizationDocument: false`
([workflow-reader.ts:180-202](../../src/server/gap-analysis/workflow-reader.ts#L180)).

Consequently, evidence cannot affect a new finding, citations cannot be shown,
and initial material contradictions cannot be discovered. The two-choice
resolution service may be implemented in isolation, but the initial generator
does not create the state required to enter it.

## High-severity contradictions and reliability defects

### H1. Gap and Action Plan publication is non-atomic

The plan says a successful, server-validated revision becomes current and that
retry resumes the same locked input
([plan lines 134-153](../plans/done/schema-simplification-refactor.md#L134)).

Gap generation performs separate writes for the already-succeeded AI run,
assessment evaluation, output revision, findings, Gap items, and document
sources. Only the final pointer/cycle updates share a transaction
([analysis-cycle-service.ts:285-410](../../src/server/gap-analysis/analysis-cycle-service.ts#L285)).
A failure in the middle can therefore leave a false-success AI run and orphaned
partial result rows.

Action Plan generation separately writes the run, plan, items, links, and audit
event. On retry, the existence of any plan causes an immediate success response
([generation-service.ts:64-128](../../src/server/action-plans/generation-service.ts#L64)).
A failure after plan insertion can therefore make an incomplete plan permanent.

### H2. Old Gap definitions can create a new downstream Action Plan

The plan says an outdated completed result remains readable but cannot create a
new downstream result
([plan lines 75-77](../plans/done/schema-simplification-refactor.md#L75)).

Action Plan enqueue verifies that the supplied revision is the current pointer,
but does not verify `revision.definitionHash === currentGapDefinitionHash`
([generation-service.ts:21-52](../../src/server/action-plans/generation-service.ts#L21)).
An old-definition revision can remain the current pointer and pass the gate.

### H3. Historical Gap results are not navigable from history

The plan says successful Gap revisions remain viewable as history
([plan lines 149-153](../plans/done/schema-simplification-refactor.md#L149)).
`loadHistory` returns audit-event IDs as each row's `id`, not the referenced
`analysis_output_revision` ID
([workflow-reader.ts:230-243](../../src/server/gap-analysis/workflow-reader.ts#L230)).
The UI can display an event label and timestamp, but the history result does not
provide the revision locator needed to open the prior immutable output.

### H4. Report rendering does not export the historical compliance result

Reports correctly pin direct source IDs. However, the PDF renderer outputs only
the applicability revision ID, Gap revision ID, Action Plan ID, document count,
organization ID, report ID, and input hash
([renderer.tsx:6-26](../../src/server/reports/renderer.tsx#L6)).
It does not render the submitted answers, applicability result, findings, atomic
gaps, cited evidence, or Action Plan items. That does not satisfy the intended
immutable historical export described in
[plan lines 237-247](../plans/done/schema-simplification-refactor.md#L237).

### H5. A clean legal corpus cannot be provisioned by the retained operator tooling

The plan retains source/version/rendition/processing/chunk/embedding history and
reviewed stable-provision bindings, operated through deployment-authorized
commands ([plan lines 272-280](../plans/done/schema-simplification-refactor.md#L272),
[plan lines 535-542](../plans/done/schema-simplification-refactor.md#L535)).

The retained corpus facade exposes only current-snapshot resolution, processing
an existing generation, and activation of existing generations
([corpus/index.ts](../../src/server/corpus/index.ts)). Repository search finds no
writer for `legal_sources`, `legal_source_versions`, `legal_source_renditions`,
`legal_source_processing_generations`, or
`legal_provision_chunk_bindings`. Snapshot activation therefore assumes data
that a clean installation cannot create through the application/operator tools.

### H6. Expensive-operation safety is inconsistent

- Gap enqueue requires an idempotency header but only stores it in job payload;
  it never claims or completes an `idempotency_records` entry
  ([analysis-cycle-service.ts:184-247](../../src/server/gap-analysis/analysis-cycle-service.ts#L184)).
  Concurrent requests can pass the read-before-insert checks and create more
  than one job.
- Action Plan generation uses the idempotency repository, but its route omits
  the operation rate limit used by Gap generation
  ([action-plan route](../../app/api/organizations/%5BorganizationId%5D/action-plan/route.ts)).
- Job cancellation maps cancellable work to read capabilities such as
  `plans:read` and `gap:read`
  ([jobs/service.ts:168-232](../../src/server/jobs/service.ts#L168)), so a Viewer
  who may observe a job may also cancel it.

These contradict the retained idempotency, single-flight, quota, and
capability-derived cancellation decisions.

## Medium-severity contradictions

### M1. Cleanup does not cover all explicitly expiring resources

The integrity rules require invitation, guest, job, upload, idempotency, and
rate-limit cleanup to be explicit and tested
([plan lines 384-385](../plans/done/schema-simplification-refactor.md#L384)).
The scheduled maintenance handler deletes expired idempotency/rate-limit rows
and handles upload sessions, but not guest applicability rows, invitations, or
old jobs ([api/cleanup.ts](../../src/server/api/cleanup.ts)). Invitation deletion
is opportunistically invoked by invitation reads, and guest deletion occurs on
token access; neither is a scheduled expiry sweep.

### M2. Archived documents can still be selected by ID

Archiving must hide a document from future evidence selection
([plan lines 196-199](../plans/done/schema-simplification-refactor.md#L196)).
`replaceSelectedDocuments` checks tenant, current version, and indexing status,
but has no `documents.archivedAt IS NULL` predicate
([analysis-cycle-service.ts:524-541](../../src/server/gap-analysis/analysis-cycle-service.ts#L524)).

### M3. Final-owner protection is race-prone

Member demotion/removal counts other owners inside a transaction, but does not
lock the organization or serialize competing owner changes
([organizations/service.ts:363-420](../../src/server/organizations/service.ts#L363),
[organizations/service.ts:735-756](../../src/server/organizations/service.ts#L735)).
Two concurrent changes can both observe another owner and leave none, contrary
to the invariant that at least one Owner remains.

### M4. Removed-model cleanup is incomplete

The plan requires repository search to prove no production script uses removed
table families ([plan lines 548-553](../plans/done/schema-simplification-refactor.md#L548)).
`package.json` still registers `db:smoke:gap`, and
[`scripts/smoke-gap-analysis.ts`](../../scripts/smoke-gap-analysis.ts) queries
removed `active_gap_analysis_releases` and `generated_artifact_revisions` tables.

## Verification gap

The following commands were run against reviewed `HEAD` and all passed:

| Command | Result |
| --- | --- |
| `npm run verify` | 102 test files passed, 1 skipped; 517 tests passed, 2 skipped; lint, typecheck, and i18n passed |
| `npm run test:ai` | 5 files and 8 tests passed |
| `npm run test:report` | 1 file and 2 tests passed |
| `npm run test:worker` | 3 files and 10 tests passed |
| `npm run test:routes` | 3 files and 10 tests passed |

Passing these commands does not validate the plan's core generation behavior:

- no test or eval imports and executes the fresh Gap generator while asserting
  a grounded provider call, canonical context, exact citations, atomic Gap
  cardinality/content, or contradiction detection;
- the only `executeActionPlanGenerationJob` test covers the already-existing-plan
  retry path and asserts that the provider is **not** called
  ([action-plan-exactly-once.test.ts](../../tests/action-plan-exactly-once.test.ts));
- the numerous generation-schema and grounding tests validate retained helpers
  in isolation, but the runtime generator does not use them; and
- the workflow cutover commit `a04b396` deleted the 2,049-line manual
  Gap/Action-Plan evaluation, the 276-line database job-lifecycle test, the
  1,007-line atomic Gap generator, and the 1,435-line old Gap generation service.

The plan's verification statement is therefore literally true about command
exit codes but false as evidence that the locked behavior was preserved.

## Documentation contradictions

The documentation rewrite required by step 18 is incomplete:

- [`database-structure.md`](database-structure.md) says AI runs store actual
  provider/model and that Gap findings/items have exact citation links. The
  current generators do not provide either guarantee.
- [`end-to-end-compliance-workflow.md`](end-to-end-compliance-workflow.md) says
  the Gap worker creates normalized atomic gaps and atomically advances the
  output pointer. The current persistence sequence is not atomic and the gaps
  are generic category placeholders.
- [`gap-analysis-current-workflow.md`](../product/gap-analysis-current-workflow.md)
  still describes the removed release-based Gap v12/Action Plan v6 workflow,
  separate grounded AI operations, repair candidates, and concurrency controls.
  It is labeled current even though that runtime was deleted.

## Spec

### Missing or partial

- **Critical:** grounded Gap generation and atomic Gap creation are absent.
- **Critical:** grounded Action Plan generation is absent.
- **Critical:** evidence/citation creation and initial contradiction detection
  are absent.
- **High:** AI run provenance records deterministic builders as actual succeeded
  AI work.
- **High:** Gap and Action Plan publication/retry is not atomic.
- **High:** clean legal-corpus provisioning and stable provision binding are
  absent from the retained operator surface.
- **High:** reports pin lineage but do not render the historical compliance
  content.
- **Medium:** guest/invitation/job expiry cleanup is incomplete.
- **Medium:** removed-model cleanup is incomplete.

### Implemented incorrectly

- Archived documents are accepted for new evidence selection.
- An outdated-definition current Gap revision may create an Action Plan.
- Action Plan retry can treat a partially inserted plan as complete.
- Gap history rows expose audit-event IDs rather than result revision IDs.

### Scope creep

No material scope creep was found. The dominant issue is under-implementation
and behavioral regression.

## What should be retained

Recovery should not undo the entire schema simplification. The following parts
are aligned with the plan and can be built upon:

- code-owned applicability and Gap definitions with stable hashes;
- one stable assessment/output per organization and immutable revisions;
- direct Gap-to-applicability, Action-Plan-to-Gap, and report lineage;
- normalized finding/Gap/Action Plan tables and status-only item mutation;
- one unfinished Gap-cycle and one Action-Plan database constraints;
- document version parsing, chunking, embedding, and hybrid retrieval services;
- durable background-job primitives;
- legal-corpus snapshot tables and atomic current-snapshot activation; and
- target table inventory and default-deny RLS verification.

## Recommended recovery order

1. Add failing integration tests for a fresh Gap generation and a fresh Action
   Plan generation. Require actual provider invocation, non-placeholder content,
   exact admitted contexts/citations, correct actual provider/model, and multiple
   atomic/action outputs where the input requires them.
2. Restore the prior grounded Gap and Action Plan orchestration behavior, adapted
   to the simplified assessment/output/finding/context schema instead of
   restoring the removed control-plane tables.
3. Make each generation publication atomic and make retries repair or reject
   partial state rather than treating row existence as success.
4. Reconnect selected immutable document versions and pinned legal-corpus
   snapshots to retrieval, context persistence, citation validation, and
   material-contradiction detection.
5. Repair downstream staleness, history locators, archived-document selection,
   report content, cleanup, idempotency/rate limiting, cancellation capability,
   and final-owner serialization.
6. Restore clean-install legal-corpus operator commands and stable provision
   binding, then replace the stale smoke script.
7. Run an authenticated end-to-end qualification that inspects generated
   content and persisted provenance, not only route/job completion, before
   marking the plan implemented again.

Because the current development results were produced by placeholder builders,
they should be considered invalid test data and regenerated after the grounded
runtime is restored. Any deletion or database recreation should remain an
explicit, separately reviewed operation.
