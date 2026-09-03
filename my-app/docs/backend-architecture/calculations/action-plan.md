# Action Plan Calculation

> Status: current as of 3 September 2026.

## What this calculation produces

The Action Plan (Maßnahmenplan) converts a finalized Gap revision into
remediation items with titles, result text, suggested evidence lists, and statuses, so an organization
can track what to do. Each organization may create **one** Action Plan, ever,
from its current, compatible, unblocked Gap revision.

It uses the shared NIS2 grounding policy while retaining a distinct workflow
prompt, operation kind, query unit, and code-owned output contract
(`src/server/action-plans/current-contract.ts`).

## Inputs

| Input | Source |
| --- | --- |
| Gap revision | The current, compatible `analysis_output_revisions` row (kind `gap`) |
| Findings and gaps | The revision's `gap_findings` and `gap_items` |
| Legal and organization context | Retrieved again through the grounding pipeline for each category |
| Locale | `de` or `en` |
| Action Plan contract | `src/server/action-plans/current-contract.ts` |

## Deterministic part

The server owns:

- **Category scoping**: generation happens per category, and every gap in the
  source revision must be covered.
- **Coverage**: complete within-category many-to-many links between plan
  items and gap items (`action_plan_item_gaps`) — no gap may be left
  uncovered, and no item may reference gaps outside its category.
- **Ordering, priority, and persistence metadata**.

The provider supplies only the item titles, result text, suggested evidence, and optional
organization citations within the strict schema; it cannot add, drop, or
re-scope gaps.

## Generation

1. A member with the `plans:manage` capability starts generation
   (`POST /api/organizations/:id/action-plan`), which enqueues an
   `action_plan_generation` job and returns `202`.
2. The job handler pins the source Gap revision, retrieves evidence per category,
   and runs the grounded provider operation with the Action Plan schema.
3. Output is validated (language, schema, coverage, citations) with a bounded
   repair pass.
4. The result is published only under the executor's **live lease**:
   `assertActionPlanPublicationLease` verifies the job is still running, owned
   by this executor, lease unexpired, and not cancelled.

## Publication

One transaction publishes:

- the `action_plans` row pinned to the source Gap revision and generation job;
- `action_plan_items` with separate `result` text and `suggested_evidence`
  JSON arrays plus initial status;
- `action_plan_item_gaps` coverage links;
- audit rows and job success.

After publication the plan is immutable except for **item status**, which can
be updated status-only (`PATCH /api/organizations/:id/action-plan/items/:itemId`).
All selected AI runs resolve through `action_plans.generation_job_id` and
`ai_processing_runs.job_id`.

## Practical navigation

- Contract and response schema: `action-plans/current-contract.ts`,
  `generation-schema.ts`.
- Generation: `action-plans/generation-service.ts`.
- Publication lease: `action-plans/publication-lease-policy.ts`.
- Item status updates and reads: `action-plans/service.ts`,
  `progress-service.ts`.
