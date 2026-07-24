# Localized compliance-definition metadata

Status: proposed

Date: 2026-07-24

## Goal

Move release-authored framework, module, questionnaire, and requirement-set
labels out of fixed-language table columns and into the existing immutable
content dictionary:

```text
content_items
  -> content_revisions
    -> content_translations
```

Each definition version must pin the exact content revision it uses. German and
English must both be present before a release can be published.

## Problem

The current schema and publishers store these user-facing values directly:

| Current owner | Fixed column | Current publishing behavior |
| --- | --- | --- |
| `compliance_frameworks` | `name`, `description` | Inserts `NIS2` and one English description |
| `compliance_modules` | `name` | Inserts German `Betroffenheitscheck` or `Gap-Analyse` |
| `questionnaires` | `title` | Inserts a German/default-locale title |
| `gap_requirement_sets` | `title` | Inserts one unlocalized title |

This bypasses the repository's content-revision model, makes locale selection
impossible or inconsistent, and lets identity rows carry display text that
belongs to an immutable definition version.

Questionnaire runtime loaders currently expose `questionnaires.title`
directly, so the fix is not complete until both compliance and Gap readers
resolve the pinned title revision for the requested locale.

## Agreed scope and constraints

- Reuse `content_items`, `content_revisions`, and `content_translations`; do not
  add another translation table or use the frontend static UI dictionary.
- Remove the fixed columns instead of retaining denormalized fallback text.
- Put references on the immutable version row when a separate version row
  exists.
- Require non-empty `de` and `en` translations for every affected field,
  including the framework description.
- Author translations in repository release definitions. Publisher code must
  not contain localized module or questionnaire names.
- There is no data-preserving migration. The target database is disposable:
  change `src/db/schema.ts`, clear it, apply the schema with Drizzle push, and
  republish the required releases.
- Include the fixed-language requirement-set title.
- Do not move the already bilingual JSON fields on
  `gap_requirement_versions` in this change.
- User-created or generated text such as organization names, document titles,
  action-plan items, and legal-corpus operator metadata is out of scope.

## Target schema

Use required foreign keys to `content_revisions.id`, all with
`ON DELETE RESTRICT`.

| Table | Remove | Add |
| --- | --- | --- |
| `compliance_frameworks` | `name`, `description` | Nothing; this table retains stable `code` identity |
| `compliance_framework_versions` | — | `name_content_revision_id uuid NOT NULL`, `description_content_revision_id uuid NOT NULL` |
| `compliance_modules` | `name` | `name_content_revision_id uuid NOT NULL` |
| `questionnaires` | `title` | Nothing; this table retains stable module/code identity |
| `questionnaire_versions` | — | `title_content_revision_id uuid NOT NULL` |
| `gap_requirement_sets` | `title` | Nothing; this table retains stable `code` identity |
| `gap_requirement_set_versions` | — | `title_content_revision_id uuid NOT NULL` |

Update the corresponding Drizzle relations and inferred types. Add reverse
lookup indexes only if an actual reader or integrity query needs them; the
primary access path starts from the version row and follows its foreign key.

This placement preserves history:

- a framework version pins its localized framework metadata;
- a module already belongs to exactly one framework version;
- a questionnaire version pins the title shown with its questions;
- a requirement-set version pins the title shown with its exact membership.

## Release-authoring contracts

### Applicability release

Extend `Nis2ReleaseDefinition` with typed metadata references for:

- framework code, name content key, and description content key;
- module code, name content key, type, and position;
- questionnaire code and title content key.

Add the four localized content items to the existing `release.content`
collection in `src/server/compliance/nis2/releases/2026-v1/release.ts`.
Use stable semantic keys rather than embedding a locale in a key, for example:

```text
nis2.framework.name
nis2.framework.description
nis2.module.betroffenheitscheck.name
nis2.questionnaire.betroffenheitscheck.title
```

The content revision already provides wording versioning, so a release version
does not need to be encoded in these stable keys.

### Gap releases

Use the localized fields already present where possible:

- `definition.title` is the Gap module name;
- `definition.questionnaire.title` is the questionnaire title;
- change `definition.requirementSet.title` from `string` to `LocalizedText`.

Update `demo-v1`, `guided-v2`, and `guided-v3` so every registered definition
still compiles. Generate stable content keys for the module, questionnaire, and
requirement-set titles. The current `guided-v3` release inherits data from
`guided-v2`; make sure object spreading does not accidentally retain an old
single-language requirement-set title.

## Publication changes

### Shared content behavior

Keep the existing content write semantics:

1. upsert a `content_items` row by `stable_key`;
2. hash the complete translation object;
3. reuse the matching immutable revision when it already exists;
4. otherwise allocate the next revision number and insert both translation
   rows;
5. resolve a content key to its exact `content_revisions.id`.

Do all content and definition writes in the publisher's existing transaction.
Do not insert structural rows until their required content revisions exist.

If the duplicated compliance and Gap content-write loops are extracted, keep
the helper narrow: it should accept localized sources and return a
`Map<stableKey, contentRevisionId>` without owning release-specific schema
writes.

### Compliance publisher

Update `src/server/compliance/publishing/publish-release.ts` to:

1. publish and resolve the new metadata content with the rest of
   `release.content`;
2. insert `compliance_frameworks` with stable identity only;
3. insert `compliance_framework_versions` with pinned name and description
   revision IDs;
4. insert `compliance_modules` with its pinned name revision ID;
5. insert `questionnaires` with stable identity only;
6. insert `questionnaire_versions` with its pinned title revision ID;
7. continue adding every release content revision to
   `compliance_check_release_content_revisions`.

Replace the hardcoded `nis2`, `betroffenheitscheck`, names, type, position, and
questionnaire title with the typed definition metadata where those values are
part of the authoring contract.

### Gap publisher

Update `src/server/gap-analysis/publishing/publish-release.ts` to create all
metadata content revisions before inserting the Gap module. Extend the current
question-content source builder to include:

- module name;
- questionnaire title;
- requirement-set title;
- existing question, help, and option content.

Then:

1. insert or resolve the Gap module with `name_content_revision_id`;
2. insert the questionnaire identity without a title;
3. insert its version with `title_content_revision_id`;
4. insert the requirement-set identity without a title;
5. insert its version with `title_content_revision_id`.

When an existing module or identity is reused, verify its framework, type,
position, and pinned content revision agree with the definition. Fail the
publication transaction on a conflict instead of silently accepting the first
row through `ON CONFLICT DO NOTHING`.

## Validation and hashing

### Applicability

The compliance validator already checks that every `release.content` item has
non-empty German and English translations. Add explicit reference validation
so all four metadata keys must exist in that collection.

The existing global content hash will cover the new translations. Ensure the
framework/module/questionnaire metadata references also participate in the
aggregate definition hash so changing a reference cannot preserve the old
aggregate identity.

### Gap

Add a localized-text validator to
`src/server/gap-analysis/publishing/compile-release.ts`. It must reject a blank
German or English value for:

- module title;
- questionnaire title;
- requirement-set title.

Include the localized requirement-set title in its component hash, not only in
the aggregate spread. Confirm that changing any affected translation changes
the deterministic aggregate hash.

## Runtime readers

### Compliance runtime

Extend the release header query in
`src/server/compliance/runtime-release/postgres-assembler.ts` with the module
and framework-version metadata needed by the DTO. Resolve:

- framework name and description;
- module name;
- questionnaire title.

Use the existing requested-locale/default-locale resolver and structured
fallback warning. Replace `header.questionnaire.title` with
`resolveRevision(header.questionnaireVersion.titleContentRevisionId)`.

Expose localized framework/module metadata on `PublishedComplianceRelease`
only through the assembled runtime DTO; callers must never reach back to raw
definition tables for display text.

### Gap runtime

Update `src/server/gap-analysis/release-loader.ts` to load the module,
framework version, questionnaire version, and requirement-set version content
revision IDs. Add them to the same bounded translation read used for question
content.

At minimum, preserve the existing `questionnaireTitle` DTO field by resolving
`questionnaire_versions.title_content_revision_id`. Also expose the localized
module and requirement-set titles where the loaded release DTO represents
those concepts. Use requested locale, then the release default locale, and fail
if neither exists; do not return a former raw title column.

## Implementation sequence

### Phase 1: Schema and type boundary

1. Change the five definition areas in `src/db/schema.ts`.
2. Add the new restrictive foreign keys and Drizzle relations.
3. Add a focused schema test proving the new columns are required and the five
   raw text columns no longer exist.
4. Run typecheck to expose every publisher, fixture, and reader that still
   expects a removed field.

### Phase 2: Authoring, validation, and hashes

1. Extend the applicability and Gap release types.
2. Add bilingual metadata to every registered release definition.
3. Add explicit reference/completeness validation.
4. Extend deterministic component and aggregate hash tests.

### Phase 3: Publishers

1. Update the compliance publisher's framework, module, questionnaire, and
   version inserts.
2. Update the Gap publisher's content ordering and module/questionnaire/set
   inserts.
3. Add conflict checks for reused stable rows.
4. Verify a failed content or structural write rolls back the whole release.

### Phase 4: Runtime localization

1. Update the compliance header/assembler and runtime DTO.
2. Update the Gap release loader and DTO.
3. Update all fixtures and consumers of `questionnaireTitle`.
4. Confirm German and English questionnaire pages render the database-backed
   title.

### Phase 5: Documentation and disposable cutover

1. Update `docs/architecture/db-schema-plan.md` so its example DDL no longer
   documents fixed names/titles.
2. Update `docs/architecture/database-structure.md` to record where localized
   definition metadata is pinned.
3. Follow `docs/database/database-reset-and-reseed.md` for target verification,
   writer shutdown, guarded clearing, Supabase SQL passes, storage, corpus
   governance, and security verification.
4. Preview the Drizzle changes with strict/verbose output, approve only the
   expected column replacement, and apply with `db:push`; do not create a
   backfill migration.
5. Republish/activate `nis2/2026-v1`, then the current
   `nis2-gap/guided-v3` release after its corpus dependencies are active.

## Tests

Add or extend automated coverage for:

- Drizzle column and foreign-key shape at all four content-owner boundaries;
- absence of the removed `name`, `description`, and `title` columns;
- compliance compilation rejecting a missing metadata key;
- compliance compilation rejecting blank `de` or `en` metadata;
- Gap compilation rejecting blank `de` or `en` module, questionnaire, or
  requirement-set titles;
- hash changes when any affected translation changes;
- publication creating exactly two translation rows per metadata revision;
- publication pinning the resolved revision IDs on the correct version rows;
- publisher conflict detection and transaction rollback;
- compliance runtime resolution in German and English;
- compliance fallback warning behavior for metadata revisions;
- Gap questionnaire-title localization in German and English;
- no regression to question/option localization or the bounded compliance
  runtime query count.

Primary files to extend include:

- `tests/compliance-release-compiler.test.ts`;
- `tests/compliance-runtime-release.test.ts`;
- `tests/gap-release-compiler.test.ts`;
- a focused schema test for definition metadata;
- publisher/database integration tests if the repository test harness can
  provide an isolated PostgreSQL target.

## Verification and reseed

Run code verification before touching the database:

```powershell
npm.cmd run verify
npm.cmd run build
git diff --check
```

Then perform the destructive development reset only after verifying the
non-secret database target and confirming it is disposable. Use the guarded
clear and strict Drizzle preview from the reset runbook:

```powershell
$env:DB_CLEAR_CONFIRM = 'clear-app-tables'
try {
  npm.cmd run db:clear
  if ($LASTEXITCODE -ne 0) { throw 'db:clear failed' }
}
finally {
  Remove-Item Env:DB_CLEAR_CONFIRM -ErrorAction SilentlyContinue
}

npm.cmd run db:push -- --strict --verbose
```

Do not use `--force`, and stop if the preview contains unrelated changes.
Complete the runbook's required SQL, storage, platform-admin, and legal-corpus
steps before release publication. Then publish and activate:

```powershell
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1

$env:GAP_RELEASE_ACTOR_ID = '<platform-admin-user-uuid>'
try {
  npm.cmd run db:publish:gap -- --release nis2-gap/guided-v3
  npm.cmd run db:activate:gap -- --release nis2-gap/guided-v3
}
finally {
  Remove-Item Env:GAP_RELEASE_ACTOR_ID -ErrorAction SilentlyContinue
}
```

Finish with the repository security, storage, rollout, and workflow smoke
checks documented in the reset runbook.

## Acceptance criteria

- The five fixed-language definition fields no longer exist in
  `src/db/schema.ts` or the pushed database.
- Every affected version row has a required restrictive foreign key to one
  immutable content revision.
- Every seeded metadata revision contains non-empty `de` and `en`
  translations.
- No publisher contains hardcoded localized framework, module, questionnaire,
  or requirement-set display strings.
- Compliance and Gap publication fail before commit on missing translations,
  missing content references, or conflicting reused identities.
- Changing localized metadata changes the appropriate component/aggregate
  release hash.
- The applicability and Gap questionnaire UIs receive the localized database
  title for the requested locale.
- Historical definition versions resolve the content revision they pinned,
  independent of later content revisions.
- A cleared database can be pushed, fully reseeded, and smoke-tested with
  `nis2/2026-v1` and `nis2-gap/guided-v3`.
- Existing bilingual JSON requirement content remains unchanged.

## Risks and mitigations

### Publisher ordering

A required definition row cannot be inserted before its content revision.
Create all localized metadata revisions first and keep the work in one
transaction.

### Silent reuse conflicts

`ON CONFLICT DO NOTHING` can conceal a module or identity seeded with different
metadata. Resolve the existing row and compare all immutable fields before
continuing.

### Runtime query regression

Additional metadata joins can turn the immutable release loader into an
N+1 path. Extend the existing header query and bounded translation query rather
than loading each label separately.

### Accidental database loss

This plan deliberately has no migration. Verify the target, quiesce writers,
use the guarded clear, inspect strict Drizzle output, and follow the full reset
runbook. Never run the destructive sequence against a database whose data must
survive.

### Incomplete reseed

Compliance and Gap publication require active evaluated legal-corpus releases.
Do not bypass that dependency or treat schema push alone as a successful
cutover.

## Out of scope

- Normalizing bilingual `gap_requirement_versions` JSON into content revisions.
- Localizing organization-owned, user-authored, generated, or operator-authored
  text.
- Adding locales beyond German and English.
- Preserving existing database rows through this schema change.
- Replacing the existing immutable content dictionary.

## Decisions

The user confirmed:

- use the existing content dictionary;
- reference exact content revisions;
- use a destructive clear/push/reseed instead of a migration;
- author names in release definitions;
- place framework/questionnaire/set content on their version rows;
- include framework metadata, modules, questionnaires, and requirement sets;
- require German and English;
- leave already bilingual Gap requirement JSON out of scope.
