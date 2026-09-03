# Gap-Analyse Calculation

> Status: current as of 3 September 2026.

## What this calculation produces

The Gap-Analyse turns an organization's questionnaire answers, selected
evidence documents, and pinned legal sources into a compliance assessment:
findings per NIS2 requirement, atomic gaps with recommendations, exact
citations, and an immutable result revision.

It is deliberately a combination of **deterministic evaluation** (server-owned
logic that cannot be changed by the model) and **grounded generation**
(bounded prose produced by the provider from exact evidence).

## Inputs

| Input | Source | Why it matters |
| --- | --- | --- |
| Applicability result | `analysis_output_revisions` (kind `applicability`) | `gap_eligible` unlocks Gap; the source applicability revision is pinned |
| Questionnaire answers | Immutable `assessment_revisions` | Assertions the model may use as evidence |
| Selected documents | `gap_analysis_cycle_documents` | Organization evidence versions, current and indexed only |
| Legal corpus | Pinned snapshots per family | The legal basis; chosen by the grounding policy |
| Definition release | `src/server/gap-analysis/current-contract.ts` | Code-owned questionnaire, requirements, prompts, and response schema |
| Locale | Cycle locale (`de`/`en`) | Output language |

## Deterministic part

### Category status

Each requirement/category groups a set of questions. Answer values are
`fully_implemented`, `partially_implemented`, `not_implemented`, `unsure`,
or `not_applicable`. `evaluateGapCategory` in
`src/server/gap-analysis/deterministic-evaluator.ts` derives the status:

- any `not_implemented` → `not_fulfilled`;
- else any `partially_implemented` → `partially_fulfilled`;
- else any `unsure` → `insufficient_evidence`;
- else any `fully_implemented` → `fulfilled`;
- all `not_applicable` → `insufficient_evidence`.

### Trigger policy

`deriveAtomicGapTriggerPolicy` in
`src/server/gap-analysis/trigger-policy.ts` decides which questions trigger
generation of atomic gaps:

- `partially_implemented`, `not_implemented`, and `unsure` always trigger;
- `not_applicable` triggers only when the whole category is not applicable;
- `fully_implemented` questions are recorded as satisfied.

The policy also carries the preferred legal provision keys used to retrieve
and cite legal context.

### Server-owned semantics

The server owns category identity, gap kinds (`missing`, `partial`,
`uncertain`), statement cardinality, priority, ordering, mandatory
citations, and locale. The provider supplies only the bounded prose and
optional organization citations allowed by the strict current schema.

## Grounded generation

For each category, the job handler runs the grounded pipeline described in
[AI Usage](../ai/usage.md):

1. Pin legal snapshot scope and resolve the provider.
2. Retrieve legal, organization, guidance, and questionnaire-assertion
   context for the category's query unit.
3. Build the prompt from the current contract and invoke the provider with
   the strict category response schema.
4. Normalize the response: atomic gaps with statements, recommendations,
   and citation IDs.
5. Validate language, schema, query-unit coverage, and claim support;
   run a bounded repair pass on invalid output.
6. Persist the exact admitted context and validated output in
   `ai_processing_run_context` / `ai_processing_runs`.

Generation is coordinated across categories with bounded concurrency, and
the AI run is created only while the parent job owns its live lease.

## Publication

One transaction publishes:

- normalized `gap_findings` (one per requirement, with status, criticality,
  summary, and guidance);
- `gap_items` (atomic gaps) with exact `gap_item_context_links`;
- `gap_finding_context_links` recording evidence relationship
  (`supporting`/`conflicting`) and resolution disposition;
- the immutable `analysis_output_revisions` row (kind `gap`) with definition
  and build hashes, input hash, and provenance;
- the successful AI-run state and the current pointer on `analysis_outputs`;
- audit rows and job success.

The revision points to its generation job. Every selected category run is
resolved through `ai_processing_runs.job_id`; there is no single-run pointer
on the revision.

Missing or weak evidence does not block generation — it is reported as
`insufficient_evidence`, not fabricated.

## Contradiction resolution

If a finding contains a material direct contradiction, the reviewer chooses
one of two paths (`contradiction-resolution-service.ts`):

- **Trust questionnaire**: only the `conflicting` document context links are
  marked rejected; unrelated `supporting` links remain.
- **Trust document**: a new `gap_conflict_resolution` job regenerates exactly
  that one finding from only the exact cited excerpts.

Either choice creates a new immutable Gap revision with actor/time, a
tenant-safe self-reference to the original finding, source choice, and exact
resolution citation IDs. Findings and gaps
are never edited in place.

## Practical navigation

- Current contract and response schema:
  `src/server/gap-analysis/current-contract.ts`,
  `generation-schema.ts`.
- Deterministic evaluation: `deterministic-evaluator.ts`,
  `trigger-policy.ts`.
- Generation: `atomic-gap-generation.ts`, `generation-domain.ts`.
- Publication: `src/server/gap-analysis/` (atomic-gap-generation and
  workflow services).
- Contradiction resolution: `contradiction-resolution-service.ts`.
