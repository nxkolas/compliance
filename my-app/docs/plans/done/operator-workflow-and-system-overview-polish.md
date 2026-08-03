# Disposable Schema Workflow and System-Overview Polish

Status: implemented on 3 August 2026.

This plan supersedes only the disposable bootstrap command sequence and
system-overview documentation portions of older schema plans. It does not
replace their domain-schema decisions.

## Problem Statement

The documented disposable schema workflow requires target inspection, an
explain/review gate, pre-push SQL, schema push, post-push SQL, storage bootstrap,
verification, and a final zero-drift explanation.

The repository also exposes a shortcut that performs pre-push SQL, schema push,
and post-push SQL immediately. It omits the review gate, storage stages, and
verification. Operators therefore have two workflows with different safety
properties.

The system overview also contains several misleading or over-broad statements:

- it shows session cookies exchanged directly between browser and Supabase;
- its request sequence places proxy handling before the browser client call;
- it describes results as generally immutable despite mutable workflow state;
- it does not name at-least-once handler execution separately from lease-fenced
  publication; and
- it duplicates a detailed database runbook that can drift from the dedicated
  operator documentation.

## Solution

Provide one guarded disposable-environment workflow with explicit plan and
apply/verify phases. Both phases resolve and display only safe target identity.
Application requires explicit acknowledgement of the reviewed target and plan.
The apply phase runs the complete ordered workflow and fails unless the final
explanation reports zero drift.

Then shorten the system overview to architecture, invariants, deployment modes,
and primary flows. Keep executable command sequences in one database runbook
and link to it.

## Commits

1. `test: characterize disposable workflow safety requirements`
   - Assert permitted environment names, safe target display, matching database
     configuration, fixed operator SQL stages, storage verification, integrity
     verification, and final drift detection.
   - Assert production-like environments are rejected.

2. `refactor: centralize safe database target resolution`
   - Parse both application and schema connection configuration without logging
     credentials.
   - Reject different hosts, ports, or databases.
   - Return a stable safe target identity shared by plan, apply, and verification
     commands.

3. `refactor: create an explicit disposable plan command`
   - Verify environment and target.
   - Run the schema explanation without mutation.
   - Present the target identity and proposed changes for human review.
   - Exit without applying schema or storage changes.

4. `refactor: create a guarded disposable apply command`
   - Require explicit acknowledgement of the approved safe target identity.
   - Run pre-push operator SQL, schema push, post-push operator SQL, and storage
     bootstrap in the documented order.
   - Stop on the first failed stage.

5. `refactor: append mandatory verification and drift checks`
   - Verify server-only RLS, integrity, and private storage.
   - Run the final schema explanation and fail when changes remain.
   - Emit a compact stage summary without secrets.

6. `cleanup: remove the unsafe competing shortcut`
   - Redirect the old command name to the guarded workflow or remove it after
     all repository references migrate.
   - Keep recreation commands separately and explicitly destructive.
   - Ensure no normal command silently supplies force flags or accepts a
     production target.

7. `test: exercise failure and resume behavior`
   - Cover mismatched targets, missing environment classification, failed
     operator SQL, failed push, failed storage bootstrap, failed verification,
     and nonzero final drift.
   - Prove rerunning idempotent completed stages is safe in a disposable
     environment.

8. `docs: make the database runbook canonical`
   - Put exact plan/apply/verification commands in the database workflow
     document only.
   - Document approval, expected output, failure handling, and final zero-drift
     evidence.
   - Make all other documents link to this runbook.

9. `docs: correct the system context diagram`
   - Terminate browser session cookies at the Next.js application origin.
   - Show server-side authentication calls from the web process to Supabase.
   - Keep Storage, PostgreSQL, worker, AI provider, and optional document
     conversion relationships accurate.

10. `docs: correct the API request sequence`
    - Start with a browser component invoking its typed client.
    - Show the resulting HTTP request crossing the proxy and route seam.
    - Distinguish page navigation guards from authoritative route
      authentication.

11. `docs: state mutability and delivery semantics precisely`
    - Describe immutable submitted/generated revisions and mutable current
      pointers or operational statuses separately.
    - State that handlers are at-least-once.
    - State that idempotency and lease-fenced transactions protect publication
      where implemented.

12. `docs: reduce overview duplication`
    - Retain the short answer, system context, main modules, request flow,
      background execution semantics, grounded generation flow, data ownership,
      and navigation guide.
    - Replace detailed schema command sequences and query-style tutorials with
      concise summaries and canonical links.

13. `test: verify documentation references and command inventory`
    - Assert every referenced canonical document exists.
    - Assert only one normal disposable apply workflow is advertised.
    - Assert package commands and documentation use the same names.

## Decision Document

- The workflow remains explicitly limited to disposable non-production
  environments.
- Planning and applying are separate deliberate actions.
- Target identity contains host, port, and database only; credentials are never
  printed.
- The apply workflow includes storage and verification rather than treating
  them as optional follow-up commands.
- Production migration and rollback remain separately reviewed work.
- The system overview describes architecture and invariants; runbooks own exact
  commands.
- Documentation is updated after runtime behavior changes so it records the
  final implementation.

## Testing Decisions

Operator-command tests use process adapters so command ordering and failures can
be asserted without mutating a real database. One disposable connected-database
qualification proves the complete plan/apply/verify/zero-drift workflow.

Use operator SQL ownership tests, disposable database recreation tests,
server-only RLS tests, integrity verification, storage verification, and the
existing clean-workflow smoke as prior art.

Documentation tests assert links, command names, and single-source ownership;
they do not freeze prose formatting.

## Acceptance Criteria

- There is one advertised normal disposable apply workflow.
- Planning makes no mutation and identifies the safe target.
- Applying requires explicit acknowledgement and runs every bootstrap and
  verification stage in order.
- The workflow rejects production-like or mismatched targets.
- Successful completion includes a zero-drift result.
- The system overview accurately describes cookies, request order, mutability,
  and job delivery/publication semantics.
- Exact database commands live in one canonical runbook.

## Rejected Alternatives

- Retaining the shortcut with a warning: it remains an easier competing path
  with weaker guarantees.
- Embedding all operator commands in the architecture overview: duplication is
  the source of drift.
- Designing production migrations here: disposable push safety and production
  rollout have different review and rollback requirements.

## Out of Scope

- Designing or operating the production migration chain.
- Automatic approval of schema changes.
- Running destructive recreation from the normal apply command.
- Changing application tables solely for documentation consistency.
- Adding new product workflows or deployment providers.
