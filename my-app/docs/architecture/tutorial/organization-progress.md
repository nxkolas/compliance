# Organization Progress

## Purpose

Organization Progress is a small NIS2-specific read model for tutorial
navigation and workflow steppers. It answers:

- which of the six ordered workflow steps are complete;
- how many applicable steps are complete.

It does not measure compliance quality. Freshness, outdated inputs, open
findings, and other health indicators remain dashboard concerns.

## Ownership and flow

```text
Existing organization records
  -> authorized progress query service
  -> pure sequential derivation
  -> GET /api/organizations/:organizationId/progress
  -> typed browser client
  -> optional local welcome overlay
  -> tutorial or stepper UI
```

The server never stores a progress row or milestone flag. Every GET reads the
authoritative retained workflow records and derives the response. The endpoint
requires the `organizations:read` capability and performs no writes.

## Contract

The ordered step keys are stable API identifiers:

1. `welcome`
2. `applicability_check`
3. `gap_analysis`
4. `documents_uploaded`
5. `action_plan`
6. `next_steps`

Presentation labels such as “Betroffenheitscheck” and “Maßnahmenplan” belong in
the localization layer, not the API.

Each step has a `completed` boolean. It is `true` when the retained workflow
record for that step is complete and `false` otherwise.

A normal response is:

```json
{
  "completedCount": 2,
  "totalCount": 6,
  "steps": [
    { "key": "welcome", "completed": true },
    { "key": "applicability_check", "completed": true },
    { "key": "gap_analysis", "completed": false },
    { "key": "documents_uploaded", "completed": false },
    { "key": "action_plan", "completed": false },
    { "key": "next_steps", "completed": false }
  ]
}
```

The HTTP success envelope nests this object under `data.progress`.

## Live derivation rules

| Step | Live source and completion rule |
| --- | --- |
| Welcome | Complete on the server when an accepted affectedness result exists. Before that, a browser may overlay local tutorial completion. |
| Applicability Check | A generated `affectedness_result` artifact has an accepted revision. Legacy deterministic submissions whose accepted pointer was not persisted also count when their current revision is `approved`. |
| Gap Analysis | A generated `gap_analysis_result` artifact has an accepted revision. |
| Documents Uploaded | Any organization document has a current version. Archived documents count because they prove a successful earlier upload. |
| Action Plan | Any active or archived organization plan has an activation timestamp. Archived plans count because they prove the milestone was reached. |
| Next Steps | An active plan exists and every item in that active plan is `done` or `cancelled`. An empty active plan satisfies this rule. |

The derivation reports each retained completion fact independently. A later
step can be completed even when an earlier prerequisite is incomplete.

Steps one through five behave like onboarding milestones because their source
records are retained after archival or replacement. Next Steps intentionally
reflects current execution: reopening a completed action item sets its
`completed` value back to `false`.

## Out-of-scope organizations

The accepted affectedness revision supplies its existing `outcomeCode`.
`not_directly_in_scope` completes a two-step journey:

```json
{
  "completedCount": 2,
  "totalCount": 2,
  "steps": [
    { "key": "welcome", "completed": true },
    { "key": "applicability_check", "completed": true },
    { "key": "gap_analysis", "completed": false },
    { "key": "documents_uploaded", "completed": false },
    { "key": "action_plan", "completed": false },
    { "key": "next_steps", "completed": false }
  ]
}
```

`essential_entity`, `important_entity`, and `clarification_required` continue
through all six steps.

## Local welcome completion

The tutorial page and its storage choice are intentionally separate from this
read model. The typed client exports the pure helper:

```ts
import {
  applyWelcomeCompletion,
  organizationProgressClient,
} from "@/src/client/organization-progress";

const result = await organizationProgressClient.get(organizationId);
const progress = applyWelcomeCompletion(
  result.data.progress,
  tutorialContinuePressed,
);
```

When the boolean is true, the helper changes Welcome's `completed` value to
`true`. It does not mutate the server response. Once Applicability Check is
accepted, the server itself marks Welcome complete on every device, so the
local overlay becomes unnecessary.

The future tutorial UI owns whether the short-lived boolean lives in
`localStorage`, session state, or another browser mechanism.

## Deliberate omissions

The contract does not include:

- a percentage;
- localized labels;
- completion timestamps;
- source record IDs;
- per-user tutorial state; or
- progress-specific mutations.

Add such fields only when a concrete consumer needs them. Do not use this read
model as a substitute for dashboard freshness or compliance-health data.

## Implementation map

- Contract: `src/contracts/organization-progress/index.ts`
- Pure derivation and welcome overlay: `src/organization-progress/model.ts`
- Authorized query: `src/server/organization-progress/service.ts`
- HTTP route:
  `app/api/organizations/[organizationId]/progress/route.ts`
- Typed client: `src/client/organization-progress.ts`
