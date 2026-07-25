# Gap requirement title and text dictionary normalization

Status: proposed implementation plan

Date: 2026-07-24

## Goal

Move the localized requirement title and requirement text out of JSON columns
on `gap_requirement_versions` and into the existing immutable database content
dictionary:

```text
content_items
  -> content_revisions
    -> content_translations
```

Each immutable Gap requirement version pins the exact title revision and text
revision that it uses. German and English remain authored in the repository,
must both be present before publication, and are resolved from
`content_translations` at runtime.

For valid published releases, the visible title, prompt-facing requirement
text, generated output language, and release selection behavior remain the
same as today.

## Current state and problem

The release authoring model already represents both fields as
`LocalizedText`:

```ts
title: { de: string; en: string };
requirementText: { de: string; en: string };
```

The publisher currently writes those objects directly to:

```text
gap_requirement_versions.title             jsonb not null
gap_requirement_versions.requirement_text  jsonb not null
```

The main Gap release loader then localizes those JSON objects in application
code. Other paths also read the raw requirement row:

- the Gap workflow result reader exposes the JSON title to the UI;
- the revision endpoint returns raw requirement rows;
- action-plan finalization reads and localizes the JSON title independently;
- review code reads the requirement row for structural fields such as
  criticality.

This is inconsistent with the repository's completed definition-metadata
normalization. Module, questionnaire, requirement-set, question, help, and
option content already pin immutable `content_revisions` and resolve their
wording through `content_translations`.

## Agreed scope and constraints

- Normalize only `gap_requirement_versions.title` and
  `gap_requirement_versions.requirement_text`.
- Keep the repository release definitions bilingual. This is a persistence and
  read-path change, not a move to runtime-authored content.
- Keep `gap_requirement_versions.recommendation` as JSON in this change.
- Keep `gap_requirement_versions.legal_references`, including localized
  labels, as JSON in this change.
- Keep requirement code, version label, criticality, content hash, stable
  requirement identity, applicability rules, and requirement-set membership
  on their current relational owners.
- Reuse `content_items`, `content_revisions`, and `content_translations`. Do not
  introduce a second translation table or use the frontend static dictionary.
- Require non-empty `de` and `en` values for both normalized fields before a
  release can be published.
- Preserve the existing locale contract: requested locale first, then the
  pinned Gap release's default locale, then fail. Do not silently fall back to
  an arbitrary third locale or to removed JSON.
- Preserve immutable history. A wording change creates a new content revision
  and is published through a new immutable Gap release/version contract.
- Keep dictionary writes and all release-structure writes inside the
  publisher's existing transaction.
- Do not add per-requirement translation queries. Extend the existing bounded
  translation read.
- The current development database is treated as disposable, matching the
  completed localized-definition-metadata rollout. There is no production
  backfill or dual-read phase in this plan.
- Organization-specific AI output, human corrections, action-plan prose,
  uploaded document text, and legal-corpus evidence remain outside the
  dictionary.

## Target schema

Replace the two JSON columns with required restrictive foreign keys:

| Table | Remove | Add |
| --- | --- | --- |
| `gap_requirement_versions` | `title jsonb NOT NULL` | `title_content_revision_id uuid NOT NULL` |
| `gap_requirement_versions` | `requirement_text jsonb NOT NULL` | `requirement_text_content_revision_id uuid NOT NULL` |

Both new columns reference `content_revisions.id` with `ON DELETE RESTRICT`.
Use explicit constraint names consistent with the existing schema:

```text
gap_requirement_versions_title_content_fk
gap_requirement_versions_requirement_text_content_fk
```

Update the Drizzle schema and inferred types. Add relations from
`gapRequirementVersions` to the two pinned content revisions if a relation
definition is introduced for this table. Do not add reverse-lookup indexes
unless an actual query requires them; runtime starts from the pinned
requirement version and follows its two IDs.

The resulting ownership is:

```text
gap_requirements
  stable requirement identity

gap_requirement_versions
  immutable structural/semantic version
  -> title_content_revision_id
  -> requirement_text_content_revision_id

content_revisions
  immutable wording revision
  -> content_translations (de, en)
```

`gap_requirement_versions.content_hash` remains. It continues to represent the
complete authored requirement definition, including title and requirement
text values, so existing immutability/conflict detection retains its meaning.

## Content identities

Create one stable content item per requirement field. Derive keys
deterministically from stable release and requirement identities:

```text
<release-code>.requirement.<requirement-code>.title
<release-code>.requirement.<requirement-code>.text
```

For example:

```text
nis2-gap.requirement.access-control.title
nis2-gap.requirement.access-control.text
```

Do not include a locale, release version label, or requirement version label in
the stable key:

- locale belongs on `content_translations`;
- wording history belongs in `content_revisions`;
- the requirement version pins the exact revision it uses.

The publisher must reject a stable key that already exists with a non-
`plain_text` format, matching the current module/questionnaire/question
content behavior.

## Release compilation and hashes

Keep `GapRequirementDefinition.title` and
`GapRequirementDefinition.requirementText` as `LocalizedText`. Existing release
definitions (`demo-v1`, `guided-v2`, and `guided-v3`) should not need wording
changes.

Extend `compileGapAnalysisRelease` so every requirement validates:

1. non-empty German title;
2. non-empty English title;
3. non-empty German requirement text;
4. non-empty English requirement text.

Errors must identify the requirement code, field, and locale so a release
author can fix the exact source value.

Keep hashing deterministic and database-ID-independent:

- continue hashing the authored requirement definition, not generated UUIDs;
- changing either locale of title or requirement text changes that
  requirement's component hash;
- the changed component hash changes the requirement-set hash;
- the changed requirement-set hash changes the aggregate Gap release hash;
- unchanged content continues to compile to the same hashes.

No content revision UUID is added to the compiler output because UUIDs are
allocated or resolved only during publication.

## Publisher changes

Update `src/server/gap-analysis/publishing/publish-release.ts` by extending the
content-source list that already publishes module, questionnaire,
requirement-set, question, help, and option content.

For every requirement, add:

```text
stable title key -> source.title
stable text key  -> source.requirementText
```

Use the existing content write semantics one-for-one:

1. upsert `content_items` by `stable_key`;
2. verify the item uses `plain_text`;
3. hash the complete `{ de, en }` translation object;
4. reuse the matching immutable content revision if it already exists;
5. otherwise allocate the next revision number and insert both translations;
6. retain the resolved revision ID in `contentRevisionByKey`.

All content revisions must exist before inserting requirement-version rows.
When inserting `gap_requirement_versions`:

- set `title_content_revision_id` from the title key;
- set `requirement_text_content_revision_id` from the text key;
- stop writing `title` and `requirement_text`;
- keep recommendation, legal references, criticality, and content hash
  unchanged.

When an existing `(requirement_id, version_label)` is reused, retain the
existing full content-hash conflict check and also verify that its two pinned
revision IDs equal the revisions resolved from the current definition. Fail
the publication transaction on any mismatch.

This preserves the existing reuse rules:

- identical translations reuse the same content revision;
- changed translations create a new content revision;
- an unchanged requirement version may be shared by later releases;
- changed authored content cannot be silently published under an existing
  requirement version label.

## Runtime resolution

### Main Gap release loader

Update `src/server/gap-analysis/release-loader.ts` so requirement title and text
use the same dictionary resolver as the already-normalized metadata and
question content.

The current loader builds its translation-ID list before it loads requirement
set members. Reorder the bounded reads:

1. load the release header, questionnaire, questions, options, and requirement
   members;
2. collect metadata, question, option, requirement title, and requirement text
   revision IDs;
3. fetch all matching `content_translations` in one bounded query;
4. resolve each value with requested locale, then release default locale;
5. fail if neither translation exists.

Return the same public DTO shape:

```ts
requirements: Array<{
  title: string;
  requirementText: string;
  recommendation: string;
  // existing structural fields unchanged
}>;
```

Resolve:

- `title` from `requirement.titleContentRevisionId`;
- `requirementText` from
  `requirement.requirementTextContentRevisionId`;
- `recommendation` from its existing JSON field for now.

Rename or narrow the old JSON-localization helper so it is visibly legacy and
cannot accidentally be used for title or requirement text.

### Workflow results and UI

`loadFindingsBatch` and `workflow-reader.ts` currently carry raw
`gap_requirement_versions` rows into workflow DTOs. After the schema change,
those rows contain revision IDs rather than display text.

Use the already-loaded localized release catalogue, keyed by requirement
version ID, to enrich every current, accepted, and candidate finding with the
resolved title and requirement text. Treat a finding whose pinned requirement
is absent from its pinned release catalogue as an integrity error; do not
return an empty title.

Keep the visible workflow behavior unchanged:

- German requests show the German title/text;
- English requests show the English title/text;
- comparison rows keep the localized title;
- the client never receives a content revision ID as display text.

The UI's compatibility helper may continue accepting either a string or the
old localized object during the transition in code, but no database-backed
workflow response may depend on a JSON object after cutover.

### Revision API

Update `getGapAnalysisRevision` and its GET route to resolve the pinned
requirement title/text for the request locale. Load the revision's pinned Gap
release, use that release's default locale for fallback, and enrich findings
from that exact release rather than the active release.

The correction endpoint's idempotency replay only needs the revision record;
keep that response contract unchanged while adapting any internal call
signature required by the localized reader.

### Action-plan finalization

`finalization-service.ts` already loads the pinned Gap release using the
generated revision's pinned `outputLocale`. Build the action-plan baseline
from that localized release catalogue instead of querying and localizing
`gap_requirement_versions.title` directly.

This preserves the language invariant:

- a German Gap result produces German requirement titles in its action plan;
- an English Gap result produces English requirement titles;
- the title comes from the exact requirement/content revision pinned by the
  result's Gap release;
- the AI-generated recommendation remains the existing single-language
  finding text and is not added to the dictionary.

Delete the finalization service's raw-JSON title localizer after its last use.

### Structural readers

Audit every remaining direct `gapRequirementVersions` reader after the schema
change:

- `review-service.ts` may continue reading structural fields such as
  criticality and IDs;
- prompt generation continues to consume the already-localized
  `LoadedGapRelease` DTO;
- readers that need display or prompt text must resolve it through the pinned
  content revisions;
- no consumer may reconstruct title/text from repository release definitions
  at runtime.

## Implementation sequence

### Phase 1: Schema boundary

1. Replace the two JSON columns in `src/db/schema.ts`.
2. Add the required restrictive foreign keys.
3. Add or update Drizzle relations and inferred types.
4. Add a focused schema test proving the JSON columns are absent and both
   revision references are required.
5. Run typecheck to enumerate every raw JSON reader before adapting them.

### Phase 2: Compiler and content identities

1. Add requirement-level bilingual validation for title and text.
2. Add deterministic content-key helpers for both fields.
3. Extend compiler tests for missing translations and hash propagation.
4. Confirm all registered Gap definitions still compile without wording
   changes.

### Phase 3: Publication

1. Add requirement title/text to the existing transactional content-source
   pipeline.
2. Pin both resolved revision IDs on new requirement-version rows.
3. Extend existing-version conflict verification to include the two pins.
4. Verify content and structural writes roll back together on failure.

### Phase 4: Runtime and downstream consumers

1. Reorder the main release loader and extend its bounded translation query.
2. Resolve title/text through `resolveGapContentTranslation`.
3. Enrich workflow, comparison, and revision API findings from their pinned
   localized release catalogue.
4. Make finalization use the pinned localized release title.
5. Remove title/text use of raw JSON localization helpers.

### Phase 5: Documentation and disposable cutover

1. Update `docs/architecture/database-structure.md` to describe the two
   revision pins.
2. Update schema examples or ownership maps that still describe localized
   title/text as stored on `gap_requirement_versions`.
3. Reconcile references in the AI-output-language plan so recommendation and
   legal-reference normalization remain explicitly out of this change.
4. Follow `docs/database/development-database-reset-and-bootstrap.md`; do not invent a
   separate reset sequence.
5. Push the reviewed schema to the disposable target and republish/activate the
   required releases.

## Tests

Add or extend automated coverage for:

- `gap_requirement_versions` no longer having `title` or `requirement_text`;
- both content revision columns being `NOT NULL`;
- both foreign keys using `ON DELETE RESTRICT`;
- compilation rejecting blank `de` or `en` requirement titles;
- compilation rejecting blank `de` or `en` requirement text;
- changing either field/locale changing the requirement, requirement-set, and
  aggregate hashes;
- identical bilingual content reusing an existing revision;
- changed bilingual content creating a new revision;
- publication writing exactly `de` and `en` translations for both fields;
- publication pinning the resolved IDs on the correct requirement version;
- existing-version pin conflicts rolling back publication;
- German and English release loads returning the exact authored title/text;
- requested-locale fallback using only the release default locale;
- missing requested and default translations failing rather than returning an
  empty string;
- workflow current/accepted/candidate findings showing localized titles;
- revision API findings using the revision's pinned release, not the current
  active release;
- action-plan item titles matching the Gap result's pinned output locale;
- recommendation and legal-reference persistence remaining unchanged;
- prompt construction receiving the same localized strings as before;
- the Gap loader retaining a bounded query count with no per-requirement
  translation query.

Primary test files to extend or add:

- `tests/gap-requirement-dictionary-schema.test.ts`;
- `tests/gap-release-compiler.test.ts`;
- `tests/gap-release-localization.test.ts`;
- `tests/gap-query-performance.test.ts`;
- workflow reader/UI contract tests;
- action-plan finalization tests;
- publisher/database integration tests if the repository harness provides an
  isolated PostgreSQL target.

## Database verification

Add a focused verification script, or extend the existing localized-metadata
verification script, to assert against the republished database that:

1. the two former JSON columns do not exist;
2. every requirement in the active Gap release has non-null title and text
   revision pins;
3. every pinned revision has exactly one non-empty `de` row and one non-empty
   `en` row;
4. loading the active release in German and English returns the values stored
   on the corresponding translation rows;
5. no active requirement resolves through fallback or legacy JSON.

Expose the check through a package script so it is part of the reset/reseed
verification rather than a one-off SQL query.

## Verification and reseed

Run code verification before touching the database:

```powershell
npm.cmd run verify
npm.cmd run build
git diff --check
```

The database cutover is intentionally destructive and applies only to a
verified disposable development target. Follow
`docs/database/development-database-reset-and-bootstrap.md` completely, including:

1. verify the non-secret `DATABASE_URL`/`DRIZZLE_DATABASE_URL` target identity;
2. quiesce web, worker, and scheduled writers;
3. run the guarded `db:clear`;
4. apply the documented pre-push SQL;
5. inspect `drizzle-kit push --strict --verbose` and approve only the expected
   replacement of the two columns plus their foreign keys;
6. apply the documented post-push SQL/security steps;
7. republish and activate `nis2/2026-v1`;
8. republish and activate the current `nis2-gap/guided-v3` release after its
   corpus dependencies are active;
9. run the localized requirement verification, security/storage checks, and
   Gap workflow smoke tests.

Do not use `--force`. Stop if Drizzle proposes unrelated schema changes. Do not
add nullable pins, dual-read logic, or a JSON backfill for this disposable
cutover.

## Acceptance criteria

- `gap_requirement_versions.title` and
  `gap_requirement_versions.requirement_text` no longer exist in the Drizzle
  schema or pushed database.
- Every Gap requirement version has required restrictive title/text content
  revision references.
- Every published title/text revision has non-empty German and English
  translations.
- The publisher contains no direct JSON write for requirement title or text.
- Compilation and publication fail before commit on missing translations,
  missing content revisions, or conflicting immutable pins.
- German and English release loading returns the exact dictionary-backed
  wording for the requested locale.
- Workflow results, revision reads, prompts, and action-plan titles use the
  exact content revisions pinned by their Gap release.
- There is no runtime fallback to the removed JSON columns and no empty-string
  fallback for missing dictionary content.
- Historical requirement versions keep their pinned wording independently of
  later content revisions.
- Recommendation and legal references behave exactly as before and remain out
  of the dictionary in this change.
- Query-count coverage proves there is no per-requirement translation lookup.
- A cleared database can be pushed, reseeded, republished, activated, and
  smoke-tested successfully.

## Risks and mitigations

### Hidden raw-row consumers

Several workflow paths currently spread full requirement rows into DTOs.
Use typecheck plus a repository-wide search for `gapRequirementVersions`,
`.title`, and `.requirementText`, then test workflow and revision responses.

### Incorrect content-key granularity

Including release/version labels in stable keys would duplicate content items;
omitting the stable requirement identity would mix unrelated wording. Keep one
semantic key per requirement code and field, with wording changes represented
as revisions.

### Historical wording drift

Resolving "latest content by key" would make old releases change over time.
Always start from the revision IDs pinned on
`gap_requirement_versions`.

### Query regression

Resolving two fields per requirement can become an N+1 query. Load requirement
members before the existing translation query and include all pins in that one
bounded read.

### Output-language mismatch

Action plans must follow the generated Gap result's pinned output locale, not
the operator's current UI locale. Reuse the localized pinned release already
loaded by finalization.

### Accidental data loss

This plan assumes a disposable target. Verify the exact database, use the
guarded reset runbook, inspect strict Drizzle output, and never apply the
destructive cutover to a database whose data must survive.
