# Action Plan Calculation

> Status: current as of 7 August 2026.

## What this calculation produces

The Action Plan (Maßnahmenplan) converts a finalized Gap revision into
remediation items with titles, descriptions, and statuses, so an organization
can track what to do. Each organization may create **one** Action Plan, ever,
from its current, compatible, unblocked Gap revision.

It is a distinct grounded provider operation — separate from Gap generation —
with its own code-owned contract
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

The provider supplies only the item titles, descriptions, and optional
organization citations within the strict schema; it cannot add, drop, or
re-scope gaps.

## Generation

1. A member with the `plans:manage` capability starts generation
   (`POST /api/organizations/:id/action-plan`), which enqueues an
   `action_plan_generation` job and returns `202`.
2. The worker pins the source Gap revision, retrieves evidence per category,
   and runs the grounded provider operation with the Action Plan schema.
3. Output is validated (language, schema, coverage, citations) with a bounded
   repair pass.
4. The result is published only under the worker's **live lease**:
   `assertActionPlanPublicationLease` verifies the job is still running, owned
   by this worker, lease unexpired, and not cancelled.

## Publication

One transaction publishes:

- the `action_plans` row pinned to the source Gap revision, generation job,
  and AI run;
- `action_plan_items` with generated content and initial status;
- `action_plan_item_gaps` coverage links;
- audit rows and job success.

After publication the plan is immutable except for **item status**, which can
be updated status-only (`PATCH /api/organizations/:id/action-plan/items/:itemId`).

## Practical navigation

- Contract and response schema: `action-plans/current-contract.ts`,
  `generation-schema.ts`.
- Generation: `action-plans/generation-service.ts`.
- Publication lease: `action-plans/publication-lease-policy.ts`.
- Item status updates and reads: `action-plans/service.ts`,
  `progress-service.ts`.
