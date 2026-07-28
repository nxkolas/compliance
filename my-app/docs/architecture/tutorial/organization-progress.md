# Organization Progress

## Purpose

Organization Progress is a small NIS2-specific read model for tutorial
navigation and workflow steppers. It answers:

- which of the six ordered workflow steps are complete;
- which step is current;
- which later steps are upcoming; and
- whether the affectedness result makes later work not applicable.

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

Each step has one of four statuses:

- `completed`: this step and all applicable prerequisites are complete;
- `current`: the first incomplete applicable step;
- `upcoming`: an incomplete step after the current step; or
- `not_applicable`: the affectedness result ended the workflow before this
  step.

A normal response is:

```json
{
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
```

The HTTP success envelope nests this object under `data.progress`.

## Live derivation rules

| Step | Live source and completion rule |
| --- | --- |
| Welcome | Complete on the server when an accepted affectedness result exists. Before that, a browser may overlay local tutorial completion. |
| Applicability Check | A generated `affectedness_result` artifact has an accepted revision. |
| Gap Analysis | A generated `gap_analysis_result` artifact has an accepted revision. |
| Documents Uploaded | Gap Analysis is complete and any organization document has a current version. Archived documents count because they prove a successful earlier upload. |
| Action Plan | Documents Uploaded is complete and any active or archived organization plan has an activation timestamp. Archived plans count because they prove the milestone was reached. |
| Next Steps | Action Plan is complete, an active plan exists, and every item in that active plan is `done` or `cancelled`. An empty active plan satisfies this rule. |

The derivation applies these rules sequentially. Facts for a later step remain
hidden as `upcoming` until all earlier applicable steps complete. For example,
a document uploaded before the Gap Analysis does not make Documents Uploaded
appear complete. Once an accepted Gap Analysis exists, the same retained
document makes that step complete automatically.

Steps one through five behave like onboarding milestones because their source
records are retained after archival or replacement. Next Steps intentionally
reflects current execution: reopening a completed action item makes it
`current` again.

## Out-of-scope organizations

The accepted affectedness revision supplies its existing `outcomeCode`.
`not_directly_in_scope` completes a two-step journey:

```json
{
  "currentStep": null,
  "completedCount": 2,
  "totalCount": 2,
  "steps": [
    { "key": "welcome", "status": "completed" },
    { "key": "applicability_check", "status": "completed" },
    { "key": "gap_analysis", "status": "not_applicable" },
    { "key": "documents_uploaded", "status": "not_applicable" },
    { "key": "action_plan", "status": "not_applicable" },
    { "key": "next_steps", "status": "not_applicable" }
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

When the boolean is true, the helper changes a current Welcome step to
`completed` and makes Applicability Check current. It does not mutate the
server response. Once Applicability Check is accepted, the server itself marks
Welcome complete on every device, so the local overlay becomes unnecessary.

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
