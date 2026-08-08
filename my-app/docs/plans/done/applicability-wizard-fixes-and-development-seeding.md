# Applicability wizard fixes and development seeding

Status: completed 8 August 2026.

## Objective and user-visible outcome

Repair the in-progress applicability wizard so a selected single-choice card
shows one filled selection indicator and an answered step enables Continue.
Populate the explicitly approved development database with the two legal-corpus
families required by the current Gap contract and the ENISA implementation
guidance used for grounded action-plan wording.

## Assumptions and resolved decisions

- The user meant the current unstaged working-tree changes; Git currently has no
  staged entries.
- The configured Supabase project `ybsmwaapqdhvmvyddmma` was explicitly
  approved as the development target before it was mutated.
- The repository-owned two-source NIS2 bootstrap fixture is acceptable only for
  a development target. It is not a legally complete retained corpus and must
  not be substituted for a reviewed staging or production manifest.
- Guidance provisioning requires downloading the official ENISA NIS2 Technical
  Implementation Guidance v1.0 PDF because no copy is present in the repo.
- A non-secret operator identity/reviewer label will default to
  `development-bootstrap` unless the user supplies another value.

## Non-goals

- Do not rewrite the wizard flow, evaluator, or release model.
- Do not change legal classifications or questionnaire content.
- Do not recreate or clear the database schema.
- Do not seed demo organizations or organization evidence.
- Do not modify or delete unrelated working-tree changes.

## Acceptance criteria

- A selected single-choice card contains exactly one selection indicator.
- After the current required question is answered, Continue is enabled even
  when later visible questions remain unanswered.
- Continue advances to the next visible question and terminal routes still
  submit as designed.
- Focused wizard tests reproduce both regressions before the fix and pass after
  it.
- The approved development database contains the `nis2-eu-primary` and
  `nis2-de-primary` corpus families, successful non-empty processing
  generations, reviewed provision bindings, and active snapshots that pass the
  active-corpus verifier.
- Guidance contains one ENISA source, 13 chapter chunks, and 13 reviewed
  provision bindings.

## Affected files and components

- `components/applicability-check/applicability-wizard.tsx`
- `tests/applicability-questionnaire-stepper.test.tsx` (or a new focused wizard
  interaction test if the current Node test environment cannot exercise state)
- No schema or API files are expected to change.
- Existing operator commands/scripts will perform database and Storage writes.

## Data and API changes

- No schema, public API, or DTO changes.
- External data writes are limited to the approved Supabase project's legal
  corpus Storage/database rows, processing jobs, active corpus snapshots, and
  guidance tables.

## Implementation sequence

1. Add regression coverage for the duplicate selection indicator and the
   Continue enabled state; run it red.
2. Remove the duplicate selected icon and narrow Continue validation to the
   active question; run focused tests green.
3. Run typecheck, lint for the touched files where available, and the complete
   focused applicability test set.
4. Download the official corpus fixture PDFs and ENISA guidance PDF only after
   target approval.
5. Seed the corpus fixture, drain legal-source jobs, bind current Gap provisions,
   validate, activate both required family snapshots, and verify them.
6. Provision ENISA guidance and query counts/invariants to verify one source,
   13 chunks, and 13 bindings.
7. Inspect the final Git diff and report all commands, external writes, and any
   manual browser check still required.

## Tests and verification

- `npm.cmd test -- --run tests/applicability-questionnaire-stepper.test.tsx`
- `npm.cmd test -- --run tests/applicability-questionnaire-stepper.test.tsx tests/applicability-wizard-flow.test.ts tests/applicability-wizard-journeys.test.ts tests/applicability-wizard-visibility.test.ts tests/applicability-result-card.test.tsx`
- `npm.cmd run typecheck`
- Targeted ESLint invocation for touched TypeScript/TSX files.
- `npm.cmd run db:verify:active-corpus` with `.env.local` loaded.
- Read-only database assertions for corpus-family activation and guidance row
  counts.

## Risks and rollback strategy

- Corpus/guidance writes are external and may be expensive to process. Confirm
  the exact Supabase project and development classification first.
- Re-running the guidance provisioner replaces the source transactionally;
  rollback is a transaction failure or a subsequent reprovision with the prior
  official PDF.
- Corpus snapshots are immutable. If activation is wrong, activate a newly
  reviewed replacement snapshot rather than editing the existing snapshot.
- Code rollback is limited to the two small wizard changes and their regression
  tests; preserve every unrelated working-tree edit.

## Execution result

- Added red-capable regression coverage for the duplicate selection indicator
  and disabled Continue button, observed both tests fail, applied the two small
  fixes, and observed the focused suite pass with 76 tests.
- TypeScript and targeted ESLint checks pass.
- Imported and processed the EU and German bootstrap sources (337 and 238
  chunks), bound 32 current Gap provisions, validated both families, activated
  one immutable snapshot per family, and passed the active-corpus verifier.
- Provisioned the official ENISA guidance as one source, 13 chunks, and 13
  reviewed provision bindings. The temporary downloaded PDF was removed.
- `git diff --check` passes and no `[DEBUG-...]` instrumentation remains.
- Repository-wide ESLint remains blocked by unrelated existing findings in
  `components/organizations/local-model-panel.tsx` and
  `src/server/ai/grounding/organization-retrieval.ts`.
- The env-loaded full test suite reached 672 passing tests and failed two
  existing database lease tests because the configured database schema lacks
  `background_jobs.cancellable`. No schema mutation was included in this plan.
