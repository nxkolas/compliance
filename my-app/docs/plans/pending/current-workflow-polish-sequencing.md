# Current Workflow Polish: Sequencing

Status: proposed implementation sequence based on the 3 August 2026
architecture review.

## Outcome

Polish the existing application workflow without adding product capability.
The work corrects two reliability defects first, then reduces duplicated job,
authentication, tenancy, and operator-workflow knowledge.

## Workstreams

1. [Gap generation durable-retry correctness](./gap-generation-durable-retry-correctness.md)
2. [Atomic document-upload completion](./atomic-document-upload-completion.md)
3. [Background-job module deepening](./background-job-module-deepening.md)
4. [Job polling and authentication hot-path cleanup](../done/job-polling-and-auth-hot-path-cleanup.md) (implemented)
5. [Organization-scope locality](./organization-scope-locality.md)
6. [Operator workflow and overview polish](./operator-workflow-and-system-overview-polish.md)

## Recommended order

### Wave 1: correctness

Implement the Gap retry and upload-completion plans independently. Each starts
with a failing regression test and ends without changing an HTTP contract or
product workflow.

These fixes should not wait for the job-module refactor. The refactor must be
able to prove that it preserves their corrected behavior.

### Wave 2: execution locality

Deepen the background-job module after both correctness fixes are green. The
new job interface becomes the single place for payload validation, enqueueing,
execution, authorization, cancellation, retry classification, and result
projection.

Then make job-status reads side-effect free and remove repeated user-directory
writes from the polling path. Doing this after the job refactor prevents the
wake-up policy from being moved twice.

### Wave 3: authorization locality

Introduce organization-scoped read and command execution incrementally. Start
with one low-risk read and one important command, then migrate domains in
vertical slices. Do not combine this broad refactor with the correctness fixes.

### Wave 4: operator and documentation consolidation

Consolidate the disposable schema commands only after runtime behavior has
stabilized. Rewrite the overview last so it describes the implemented
at-least-once execution, lease-fenced publication, side-effect-free polling,
authentication flow, and operator workflow.

## Cross-plan invariants

- No new route, screen, questionnaire behavior, AI capability, or job kind.
- Existing immutable business revisions and audit history remain readable.
- Provider calls remain bounded and every actual call retains its own
  provenance row.
- A committed domain transition that requires background work commits its job
  in the same transaction.
- A GET request does not start business work.
- Organization authorization remains server-owned and deny by default.
- Each commit leaves lint, type checking, and the relevant targeted tests
  green.
- Schema changes, where required, are additive before cleanup.

## Release gates

After Wave 1:

- demonstrate successful Gap recovery after exhausted transient attempts;
- demonstrate replay of upload completion after failures at every former
  database handoff point;
- prove that neither workflow creates duplicate business artifacts.

After Wave 2:

- prove catalog completeness for every persisted job kind;
- prove that all payloads are validated at enqueue and execution;
- prove that polling performs no drain scheduling or user-directory write;
- qualify worker, after-response, recovery-route, and script execution.

After Wave 3:

- prove cross-organization identifiers cannot alter or reveal another
  organization's data through migrated operations;
- prove authorization and important command writes share one transaction;
- run the existing organization-management and server-only RLS verification.

After Wave 4:

- prove the guarded disposable schema workflow reaches zero drift;
- verify that the system overview matches the implementation and contains no
  competing command sequence.

## Out of scope

- A public API or compatibility program.
- A new queue product or broker.
- Realtime job updates, notifications, or server-sent events.
- Browser access to application tables.
- Production migration-chain design.
- Per-organization embedding-provider selection.
- New organization roles or capabilities.
