# Gap Analysis and Action Plan workflow

Status: guided-v6 atomic Gap contract with independent Action Plan generation.

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

Selecting **Create action plan** enqueues an `action-plan-generation` background
job and returns HTTP 202. The worker loads the exact current Gap revision, all
answers in each category, pinned documents, mapped legal context, and the
release-pinned locale. It then runs a distinct grounded AI operation.

Generated actions stay within one category. An action may cover several gaps,
and a gap may be covered by several ordered actions. Every gap and every action
must be linked. Priority is inherited from the category; generated content is
limited to title, result, and recommended evidence. Status, owner, due date, and
execution notes remain editable.

Persistence is atomic and exactly once by generation job. A successful job
approves and accepts the source Gap revision, activates one plan, stores actions
and their gap links, and publishes the plan ID through the job result. Failure
or cancellation leaves no partial plan.

## Review and lifecycle

Contradictory evidence produces a separate review notice and blocks Action Plan
generation. Before a plan exists, a structured reviewer correction regenerates
the affected category and copies unchanged category children into a new
immutable revision. Queued or running Action Plan generation reserves the Gap
revision; an active plan locks it permanently.

## Release and verification

The reset baseline publishes `nis2-gap/guided-v6`, Gap prompt/schema v7, and
Action Plan prompt/schema v1:

```powershell
npm.cmd run db:publish:gap -- --release nis2-gap/guided-v6
npm.cmd run db:verify:gap-requirements -- --release nis2-gap/guided-v6
npm.cmd run eval:gap-action-plan-manual
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v6
```

Run the manual evaluator before activation and inspect its timestamped JSON and
Markdown artifacts for both German and English generated prose.
