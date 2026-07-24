# AI-generated output language pinning

Status: proposed

Date: 2026-07-24

## Goal

Generate and persist every user-visible AI result in exactly one language: the
language selected in the UI by the user who queues generation.

The selected language becomes immutable input to the generation job and every
derived business record. Changing the UI language later changes application
copy and release-authored definitions, but it does not translate, relabel, or
regenerate an existing AI result or action plan.

The initial supported output locales remain:

```text
de
en
```

## Database audit

The live database contains 113 public application tables. The established
database dictionary contains 1,528 translations: 764 German and 764 English.
Reusable compliance definitions normally resolve display content through:

```text
content_items
  -> content_revisions
    -> content_translations
```

The audit found two materially different reasons for prose to exist outside
that dictionary.

### AI-generated business content

The current Gap result is duplicated across its durable run, immutable artifact
snapshot, normalized findings, and derived action plan:

| Table | Fields | Current behavior |
| --- | --- | --- |
| `ai_processing_runs` | `validated_output` | Stores the validated bilingual model response |
| `generated_artifact_revisions` | `result` | Stores the complete bilingual Gap result snapshot |
| `gap_findings` | `rationale`, `recommendation`, `assumptions` | Stores bilingual JSON objects for the first two fields and one-language arrays for assumptions |
| `action_plan_items` | `title`, `description` | Flattens a requirement title and AI recommendation into whichever locale is active when the plan is finalized |

The live database currently has:

- 3 AI runs, of which 2 succeeded;
- 2 AI-generated Gap artifact revisions;
- 8 Gap findings, all with both `de` and `en` rationale/recommendation values;
- 8 action-plan items, split between 4 German and 4 English items.

The action-plan rows demonstrate the inconsistency: the result is generated
bilingually, then the finalization request's current locale chooses one
language to copy into the plan. Generation locale and finalization locale are
not currently required to match.

The same free-form model response also includes `assumptions`,
`contradictions`, and `questionnaireDisagreements`. These arrays are already
prompted in the selected language, but the selected locale is not persisted on
the resulting artifact.

### Reusable authored definitions outside the dictionary

`gap_requirement_versions` is a separate definition-model exception. It stores
the following release-authored content directly as localized JSON:

- `title`;
- `requirement_text`;
- `recommendation`; and
- labels nested in `legal_references`.

These are reusable immutable definitions rather than generated organization
content, so they should eventually use pinned content revisions and
`content_translations`. That normalization is deliberately a separate
follow-up. It must not be coupled to the AI-output-language rollout.

### Strings that should remain outside the dictionary

The following data is intentionally not dictionary content:

- evidence snapshots in `gap_finding_evidence.excerpt` and
  `ai_processing_run_context.excerpt_snapshot`;
- extracted legal and organization-document text;
- organization names, document titles, filenames, questionnaire free-text
  answers, and reviewer reasons;
- official legal-source titles and publisher names;
- codes, hashes, identifiers, statuses, operational errors, and audit
  metadata.

Evidence quotations must remain in their source language. Translating them
would break fidelity between the citation and the cited source.

`reports.input_snapshot` currently stores source IDs and report metadata, not
AI prose. No report rows exist in the inspected database, and the report
renderer does not currently embed Gap rationale or action-plan descriptions.

## Current generation path

The selected locale already reaches most of the generation path:

```text
complyx-locale cookie
  -> API getLocale()
    -> generateGapReassessment(...)
      -> background_jobs.payload.locale
        -> worker
          -> generateGapAnalysis(...)
            -> runGroundedOperation(outputLocale)
```

The grounding gateway appends a locale instruction, but the current output
schema still requires:

```ts
rationale: { de: string; en: string };
recommendation: { de: string; en: string };
```

The prompt therefore explicitly tells the model to populate both languages.
Only assumptions, contradictions, and questionnaire disagreements are
single-language today.

The generation source hash includes the locale. However, a hash is not usable
language metadata, and neither the AI run nor the generated revision exposes
the selected locale.

The retry route currently reads the locale cookie again. A user could therefore
switch UI languages between the original failed job and a retry. The locale
must instead be pinned on the locked reassessment draft and reused by every
retry.

Finalization has another independent locale read:

```text
POST action-plan
  -> getLocale()
    -> finalizeGapAnalysisAndGenerateActionPlan(locale)
```

That read must be removed. Finalization must use the approved Gap revision's
pinned output locale.

## Agreed behavior

- The language selected by the user who presses Generate is the shared
  organization's result language.
- Capture that locale when generation is queued; do not re-read the UI locale
  inside the worker, on retry, or during finalization.
- Generate and store only one rationale and one recommendation per finding.
- Generate assumptions, contradictions, and questionnaire disagreements in
  the same pinned locale.
- Preserve evidence excerpts and citations exactly in their source language.
- A generated revision, every corrected child revision, and its action plan
  retain one output locale.
- Human corrections inherit the revision's intended locale, but the backend
  does not detect or reject the language a person types.
- Switching the UI language after generation translates only application
  chrome and reusable definitions.
- Do not add language-only regeneration or action-plan replacement in this
  change.
- Show the selected result language before generation and on the generated
  result/action-plan surfaces.
- Enforce the policy at the shared AI gateway so future user-visible AI
  operations cannot silently bypass it.
- Use local aggregate language detection. Do not make another AI call merely
  to classify language.
- Retry one confidently wrong-language AI response. If the second response is
  still confidently wrong, fail without creating a result.
- Treat language-detector initialization or execution failure as a retryable
  job failure. Do not silently skip validation.
- Accept low-confidence or indeterminate classifications, but record the
  diagnostic.
- Treat both provider attempts as one logical AI run, aggregate their token
  usage, and do not retain the rejected response as a business result.
- Do not migrate legacy generated records. Clear and reseed the disposable
  database after the schema and code changes.

## Target data model

### Reassessment draft

Add `output_locale text` to `gap_reassessment_drafts`.

- It is null while a draft is still editable.
- Locking and enqueueing generation sets it to the request's validated
  `Locale`.
- Every retry reads this value rather than `getLocale()`.
- A locked/generated draft must have `output_locale in ('de', 'en')`.

Putting the locale on the draft makes it part of the immutable input snapshot,
next to the assessment revision, release, and selected document versions.

### AI processing run

Add the following to `ai_processing_runs`:

| Column | Requirement |
| --- | --- |
| `output_locale text` | Required and constrained to `de` or `en` |
| `attempt_count integer` | Non-negative; becomes 1 or 2 after provider execution |
| `language_validation jsonb` | Required diagnostic object with a versioned shape |

The language diagnostic should record, per attempted structured response:

- detector implementation/version;
- expected locale;
- detected locale or `unknown`;
- confidence;
- disposition: `match`, `confident_mismatch`, or `indeterminate`;
- whether another attempt was triggered.

Token columns store totals across both provider attempts. The durable run keeps
only the accepted `validated_output`. A rejected wrong-language response must
not be copied into `validated_output`, an artifact, an error message, or audit
metadata.

### Generated artifact revision

Add nullable `output_locale text` to `generated_artifact_revisions`, constrained
as follows:

- AI-generated Gap revisions require `de` or `en`;
- corrected child revisions inherit the parent locale;
- deterministic applicability artifacts may keep it null.

Include `outputLocale` in the Gap result's versioned JSON snapshot as well as
the relational column. The relational column supports integrity checks and
joins; the JSON field keeps the immutable result contract self-describing.

Advance the Gap result kind/schema version instead of continuing to call the
new shape `gap_analysis_result_v1`.

### Gap findings

Change:

```text
gap_findings.rationale       jsonb -> text
gap_findings.recommendation  jsonb -> text
```

Keep `assumptions` as a JSON array of strings. The parent artifact revision
owns the language, so repeating `output_locale` on every finding would add
redundant state and another consistency problem.

The complete artifact snapshot continues to carry contradictions and
questionnaire disagreements as one-language string arrays.

### Action plan

Add required `output_locale text` to `action_plans`, constrained to `de` or
`en`.

`action_plan_items.title` and `description` remain text:

- `title` is the release-authored requirement title resolved in the Gap
  revision's pinned locale;
- `description` is the already single-language AI recommendation.

Do not add locale columns to individual action-plan items. Their plan is the
language boundary.

## Single-language output contracts

Update the Gap model schema in
`src/server/gap-analysis/generation-schema.ts`:

```ts
rationale: z.string().trim().min(1),
recommendation: z.string().trim().min(1),
assumptions: z.array(z.string().trim().min(1)),
contradictions: z.array(z.string().trim().min(1)),
questionnaireDisagreements: z.array(z.string().trim().min(1)),
```

Remove `localizedTextSchema` from both the model response and correction
contracts. Optional human corrections to rationale and recommendation become
plain strings.

Update the shared grounded output contract to expose generated prose to the
gateway, for example through an operation-owned callback:

```ts
generatedProse(output: T): string[];
```

The Gap implementation returns:

- every rationale;
- every recommendation;
- all assumptions;
- all contradictions; and
- all questionnaire disagreements.

It must not return evidence excerpts, questionnaire assertion excerpts,
requirement definitions, legal references, citation identifiers, source
labels, or user-authored document content.

Future user-visible AI operations must provide both `outputLocale` and a prose
extractor. Language-neutral operations may opt out only through an explicit
contract flag, not by omitting the policy accidentally.

## Prompt policy

Replace the current instruction to populate both `de` and `en` with one
unambiguous instruction based on the pinned locale:

```text
Write every generated free-form field in German.
```

or:

```text
Write every generated free-form field in English.
```

The instruction must name every free-form output field and continue to state
that citation IDs are immutable. It must also distinguish source quotations
from generated prose: evidence may be in another language and must not be
translated or rewritten.

Keep the retry prompt identical to the first prompt. The prompt hash then
continues to identify both attempts accurately, while provider sampling can
produce a corrected second response.

Advance the prompt and response-schema versions. Update release prompt metadata
and hashes through the normal Gap publication path rather than special-casing
an existing published release.

## Local language validation

Introduce a narrow server-only language detector interface. The production
adapter must run locally and must not send compliance content to another
service.

```ts
type LanguageClassification =
  | { kind: "match"; detected: "de" | "en"; confidence: number }
  | { kind: "confident_mismatch"; detected: "de" | "en"; confidence: number }
  | { kind: "indeterminate"; detected: string | null; confidence: number | null };
```

Validate combined prose rather than individual fields:

1. parse and validate the structured model response;
2. obtain generated strings from the output contract;
3. trim empty values and join the remaining prose into one document;
4. classify that document;
5. accept a match;
6. accept and record an indeterminate result;
7. retry once on a confident mismatch;
8. fail with a stable error code on a second confident mismatch.

The confidence policy must be centralized, documented, and covered by fixture
tests. German prose containing English security terms, acronyms, organization
names, or product names must not be treated as a confident mismatch.

If the detector throws or is unavailable:

- do not persist `validated_output`;
- do not create a generated artifact revision;
- mark the run/job failed with a safe stable code;
- allow the existing explicit retry workflow.

Recommended stable codes:

```text
AI_OUTPUT_LANGUAGE_MISMATCH
AI_LANGUAGE_VALIDATION_UNAVAILABLE
```

Localize their user-facing messages through the existing error dictionaries.
Do not expose detector internals or rejected model text through the API.

## Gateway attempt and persistence ordering

Refactor `runGroundedOperation` so no output-dependent provenance or business
record is persisted before an acceptable-language response exists:

1. load policy, evidence, and grounding context once;
2. create the durable logical AI run with the pinned locale;
3. call the provider;
4. validate the structured response;
5. run the language policy;
6. repeat steps 3-5 once after a confident mismatch;
7. validate claims on the accepted response;
8. persist grounding provenance;
9. persist only the accepted `validated_output` and aggregate usage;
10. let the Gap service create the artifact revision and normalized findings.

If claim validation needs persisted context IDs, preserve the current safe
ordering while ensuring no business artifact is created before both language
and grounding validation pass.

Make the detector and provider injectable so tests do not depend on an actual
model or probabilistic language classification.

Recovery of an existing processing run must validate that its stored
`output_locale` matches the request. A locale mismatch is an idempotency
conflict, never a reason to reuse output.

## Generation, retry, and finalization changes

### Queue generation

In the reassessment service:

- read the validated request locale once;
- set `gap_reassessment_drafts.output_locale` when locking the draft;
- write the same locale into `background_jobs.payload`;
- include it in the generation fingerprint/idempotency material;
- show the chosen language in the review step before the request is sent.

The worker continues to validate the payload, then verifies it matches the
locked draft before calling the generation service.

### Retry

Change retry APIs/services so `getLocale()` is not generation input. A retry:

- loads the locked draft's `output_locale`;
- writes that value to the replacement job payload;
- includes it in the new AI run;
- rejects missing or conflicting locale state.

The user's current UI locale is relevant only for rendering the retry button
and localized status/error text.

### Persist the Gap result

In `generation-service.ts`:

- persist plain rationale/recommendation strings;
- add `outputLocale` to the summary;
- set `generated_artifact_revisions.output_locale`;
- verify the accepted gateway output locale equals the source input locale;
- retain locale in source and idempotency hashes.

### Correct a result

In `review-service.ts`:

- accept optional plain-string corrections;
- inherit `output_locale` from the source revision;
- reject a source revision that lacks a valid pinned locale;
- copy one-language fields into the corrected revision and findings;
- do not run language detection over reviewer text.

### Finalize and create the action plan

Remove `locale` from
`finalizeGapAnalysisAndGenerateActionPlan(...)`. The service must:

- load and validate the Gap revision's `output_locale`;
- resolve the requirement title with that locale;
- copy the finding's plain recommendation directly;
- set `action_plans.output_locale`;
- reject mismatches among revision, result snapshot, and action plan.

Remove `getLocale()` as business input from the action-plan POST route. It may
still be used by the page/UI for static dictionary selection.

## Read models and UI

Generated prose must no longer pass through locale-selection helpers. Render
`finding.rationale`, `finding.recommendation`, and the generated arrays
directly.

Continue to localize release-authored requirement titles and other dictionary
content for ordinary browsing, except when creating or displaying a frozen
action-plan baseline whose own pinned locale is authoritative.

Add localized UI copy for:

- “Result language”;
- German/English result-language labels;
- the pre-generation statement that the shared result will be generated in
  the current language;
- a generated-result language badge;
- an action-plan language badge;
- language-validation failure and retry messages.

The pre-generation review should make team behavior explicit: the language
selected by the member who starts generation becomes the shared result
language.

Do not add:

- automatic translation on UI language change;
- a language-only regeneration button;
- a second language value hidden inside the result;
- client-side language classification;
- language enforcement for human corrections.

## Tests

### Schema tests

Extend the schema tests to prove:

- AI runs require valid `output_locale`, attempt count, and diagnostics;
- locked/generated reassessment drafts require a valid locale;
- AI/corrected Gap revisions carry a valid locale while deterministic
  applicability artifacts may remain locale-neutral;
- action plans require a valid locale;
- Gap rationale and recommendation columns are text;
- database checks reject unsupported locales and inconsistent states.

### Output-contract tests

Update:

- `tests/gap-generation-validation.test.ts`;
- `tests/gap-prompt-builder.test.ts`;
- `tests/gap-generation-job-contract.test.ts`;
- `tests/action-plan-generation.test.ts`; and
- relevant reassessment/review contract tests.

Cover:

- one-language rationale/recommendation schemas;
- German and English prompt instructions;
- absence of the old “populate both de and en” instruction;
- generated-prose extraction;
- evidence/citations excluded from language validation;
- result snapshots contain one language and `outputLocale`;
- corrected revisions inherit locale;
- action plans use the revision locale rather than the UI locale.

### Gateway language-policy tests

Use deterministic fake detectors and providers to cover:

- matching German accepted on the first attempt;
- matching English accepted on the first attempt;
- confident mismatch followed by a matching retry;
- two confident mismatches fail without an artifact;
- indeterminate classification accepted and recorded;
- detector failure fails closed;
- usage totals include both provider attempts;
- `attempt_count` and diagnostics are persisted;
- rejected text is not persisted;
- grounding and citation validation still fail closed;
- existing-run recovery rejects locale mismatch.

Add language-detector adapter fixtures with realistic compliance prose,
including German text containing English technical terminology.

### Job and idempotency tests

Prove that:

- queueing pins the cookie locale on the draft and job;
- changing the cookie after enqueue does not affect the worker;
- changing the cookie before retry does not affect the retry locale;
- locale participates in the generation fingerprint;
- conflicting draft/job locales fail;
- repeated idempotent requests reuse only matching-locale work.

### UI tests

Cover:

- selected result language shown before generation;
- generated result and plan badges;
- German result remains German after switching UI to English;
- English result remains English after switching UI to German;
- surrounding static copy and reusable definitions still follow the active UI
  locale;
- localized language-validation errors.

## Implementation sequence

### Phase 1: Lock the contract with failing tests

1. Add schema expectations for the new locale and diagnostic fields.
2. Change model/HTTP contract tests to expect plain strings.
3. Add gateway retry and detector failure tests with fakes.
4. Add action-plan tests that deliberately pass a conflicting UI locale.
5. Add job tests that change locale before retry.

### Phase 2: Change the schema and domain types

1. Add draft, run, revision, and plan locale columns/checks.
2. Add run attempt/validation diagnostics.
3. change finding rationale/recommendation to text.
4. Update Drizzle relations, inferred types, serializers, and fixtures.
5. Advance result/response schema versions.

There is no compatibility adapter for bilingual generated content because the
approved rollout clears the disposable database.

### Phase 3: Deepen the shared AI gateway

1. Add the generated-prose contract.
2. Add the local detector interface and production adapter.
3. Implement aggregate classification and one bounded retry.
4. Aggregate usage and persist diagnostics.
5. Add safe failure codes and localized messages.

### Phase 4: Pin locale through the workflow

1. Store locale when locking/enqueueing a draft.
2. Validate draft/job agreement in the worker.
3. Make retries reuse the draft locale.
4. Persist locale on the run and artifact.
5. Inherit locale during human correction.
6. Derive plan locale exclusively from the approved revision.

### Phase 5: Update reads and UI

1. Remove runtime localization of generated prose.
2. Render plain strings directly.
3. Add pre-generation and post-generation language indicators.
4. Keep evidence excerpts unchanged.
5. Add browser/component coverage for UI language changes around a pinned
   result.

### Phase 6: Verify code before database reset

Run at minimum:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:i18n
npm.cmd run test:worker
npm.cmd run test:routes
npm.cmd run test:ai
npm.cmd run build
```

Do not proceed to the destructive rollout until the schema diff has been
reviewed and all relevant tests are green.

## Disposable database rollout

Follow
[`docs/database/database-reset-and-reseed.md`](../database/database-reset-and-reseed.md)
as the authoritative runbook. Do not improvise a shorter sequence.

The rollout must:

1. confirm `DATABASE_URL` and `DRIZZLE_DATABASE_URL` identify the same intended
   disposable database;
2. take/verify the required backup and quiesce web, worker, and monitor writers;
3. run the guarded `db:clear`;
4. apply pre-push operator SQL;
5. inspect and approve the strict Drizzle schema push;
6. reapply post-push RLS, integrity, privilege, audit, and index SQL;
7. recreate/verify private storage buckets;
8. bootstrap the existing Auth user as Platform Administrator;
9. seed both NIS2 legal-corpus fixture imports;
10. run the worker through import, parsing, and embedding;
11. inspect and human-approve the exact EU and German generation IDs;
12. publish, evaluate, and activate both corpus releases;
13. publish and activate `nis2/2026-v1`;
14. publish and activate `nis2-gap/guided-v3`;
15. run schema, security, storage, corpus, applicability, Gap, worker, AI, and
    build verification gates.

The corpus approval remains a governance checkpoint. “Reseed and accept the
corpus” means using the guarded approval command with reviewed exact generation
IDs, passing evaluation jobs, and activating the passed releases. It does not
mean bypassing review with direct SQL.

Core destructive command:

```powershell
$env:DB_CLEAR_CONFIRM = 'clear-app-tables'
try {
  npm.cmd run db:clear
  if ($LASTEXITCODE -ne 0) { throw 'db:clear failed' }
}
finally {
  Remove-Item Env:DB_CLEAR_CONFIRM -ErrorAction SilentlyContinue
}
```

Corpus and release commands, with operator-reviewed IDs and actor values, are
the commands documented in the reset runbook:

```powershell
npm.cmd run db:seed:legal-corpus-fixture -- <platform-admin-user-id>
npm.cmd run db:inspect:legal-corpus-fixture
npm.cmd run db:approve:legal-corpus-fixture -- <reviewed arguments>
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
npm.cmd run db:publish:gap -- --release nis2-gap/guided-v3
npm.cmd run db:activate:gap -- --release nis2-gap/guided-v3
```

Stop at the first failed command. Do not resume application traffic until the
runbook's final verification gates pass.

## Acceptance criteria

- A German UI generation produces only German AI prose.
- An English UI generation produces only English AI prose.
- The selected locale is immutable from draft lock through action-plan
  creation.
- A worker or retry cannot pick up a later cookie change.
- Existing results do not change when the viewer switches UI language.
- Evidence remains byte-for-byte source text.
- A confident wrong-language response is retried once and never persisted.
- A second confident mismatch creates no business artifact and yields a
  localized retryable error.
- Detector failure cannot silently bypass validation.
- Indeterminate classification is observable without blocking mixed technical
  language.
- Human corrections are accepted without automated language policing and
  inherit the result locale.
- New user-visible AI operations must declare output locale and generated
  prose at the shared gateway contract.
- Action-plan title and description use the approved revision's locale,
  independent of the finalizing user's UI language.
- The cleared database is fully reseeded with reviewed, evaluated, active legal
  corpora and active compliance/Gap releases.
- `gap_requirement_versions` dictionary normalization remains explicitly out of
  scope and is tracked separately.

## Separate follow-up

Create a distinct plan to move the localized authored fields in
`gap_requirement_versions` into immutable content revisions:

```text
content_items
  -> content_revisions
    -> content_translations
```

That follow-up should cover requirement title, requirement text,
recommendation, and legal-reference labels, plus publisher validation and
release-loader changes. It must not move organization-specific AI output,
human input, or source evidence into the dictionary.
