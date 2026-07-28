# Organization Progress Read Model

Status: implemented and verified on 2026-07-28.

## Objective and user-visible outcome

Expose a typed, organization-scoped NIS2 progress read model at
`GET /api/organizations/:organizationId/progress`. Consumers receive the
current six-step tutorial/workflow position without progress-specific database
state. A browser-safe pure helper can overlay the short-lived local completion
of the welcome tutorial.

## Non-goals

- Building the tutorial page or choosing its browser-storage mechanism.
- Persisting milestone flags, percentages, labels, timestamps, or source IDs.
- Replacing the dashboard read model.
- Creating a generic multi-framework or per-user progress system.
- Changing applicability, Gap Analysis, document, or action-plan lifecycles.

## Accepted behavior

The ordered step keys are:

1. `welcome`
2. `applicability_check`
3. `gap_analysis`
4. `documents_uploaded`
5. `action_plan`
6. `next_steps`

Each step has `completed`, `current`, `upcoming`, or `not_applicable` status.
The response also contains `currentStep`, `completedCount`, and `totalCount`.
It contains no percentage or presentation copy.

The server derives completion live:

- Welcome is complete when the applicability check is complete. Before then,
  the browser helper may mark it complete locally and recalculate the sequence.
- Applicability Check requires an accepted affectedness artifact revision.
- Gap Analysis requires an accepted Gap Analysis artifact revision.
- Documents Uploaded requires the Gap Analysis plus any organization document
  with a successfully established current version. Archived documents count.
- Action Plan requires the document step plus any active or archived plan that
  was activated.
- Next Steps requires the plan step, a current active plan, and every current
  plan item to be `done` or `cancelled`. An empty active plan is complete.
  Reopening an item makes this live terminal step current again.

Steps are sequential: later facts do not show as completed until their
prerequisites are complete. The first incomplete applicable step is `current`;
remaining applicable steps are `upcoming`.

An accepted `not_directly_in_scope` outcome completes a two-step journey:
steps three through six are `not_applicable`, `totalCount` is 2, and
`currentStep` is null. `clarification_required`, `essential_entity`, and
`important_entity` continue through all six steps.

## Acceptance criteria

- An authorized organization reader can fetch the validated progress envelope.
- The route validates the organization ID and delegates all behavior to the
  service.
- The service enforces `organizations:read`.
- The read model uses existing retained domain records and performs no writes.
- Every accepted progress branch and sequential dependency has a focused unit
  test.
- The route contract is tested through the shared API envelope/client parser.
- The client fetcher validates the response contract.
- The pure welcome helper completes only the local welcome step and derives the
  correct next current step without mutating its input.
- Architecture documentation describes ownership, derivation, API behavior,
  and the local/server boundary.

## Affected files and components

- `src/contracts/organization-progress/`: response schemas and types.
- `src/organization-progress/`: shared pure derivation and welcome overlay.
- `src/server/organization-progress/`: authorized database-backed query.
- `app/api/organizations/[organizationId]/progress/route.ts`: thin GET route.
- `src/client/organization-progress.ts`: typed browser fetcher.
- `tests/`: derivation/helper and route-contract coverage.
- `docs/architecture/tutorial/organization-progress.md`: architecture guide.
- `docs/architecture/README.md`: guide index entry.

## Data and API changes

No schema migration or data write is introduced.

The new success data payload is:

```json
{
  "progress": {
    "currentStep": "gap_analysis",
    "completedCount": 2,
    "totalCount": 6,
    "steps": [
      { "key": "welcome", "status": "completed" },
      { "key": "applicability_check", "status": "completed" },
      { "key": "gap_analysis", "status": "current" },
      { "key": "documents_uploaded", "status": "upcoming" },
      { "key": "action_plan", "status": "upcoming" },
      { "key": "next_steps", "status": "upcoming" }
    ]
  }
}
```

## Implementation sequence

1. Define the shared schemas, types, ordered keys, and pure derivation.
2. Implement the authorized query service over accepted artifacts, documents,
   plan history, and current action-plan items.
3. Add the thin validated route and typed client fetcher.
4. Add the pure welcome overlay helper.
5. Add focused unit and route-contract tests.
6. Add and index the architecture guide.
7. Run targeted tests, typecheck, lint, and inspect the final diff.

## Tests and verification

- Run the new progress tests first with Vitest.
- Run TypeScript type checking.
- Run ESLint.
- Inspect `git diff --check` and the final scoped diff.

## Risks and rollback

- Concurrent domain changes may produce a briefly mixed read because this is a
  live projection rather than a transactionally pinned snapshot. The fields
  are monotonic or current workflow pointers, so the practical inconsistency
  window is small and a subsequent GET is authoritative.
- Historical plan activation and archived documents intentionally count for
  onboarding milestones; current health remains the dashboard's concern.
- Rollback removes the new route, client, shared model, tests, and docs. No data
  rollback is necessary because the change has no migration or writes.
