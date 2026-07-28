# Betroffenheitscheck Tooltips and Question-Copy Update

Status: approved for implementation on 2026-07-25. No code or database
changes have been applied by this plan.

The authoritative German product copy is
[`BetroffenheitscheckFRAGEN.pdf`](../../product/BetroffenheitscheckFRAGEN.pdf).

## Outcome

After this work:

1. all twelve Betroffenheitscheck questions keep a short, permanently visible
   description beneath the question;
2. all twelve questions expose a longer German or English explanation from a
   focusable information icon beside the question heading;
3. tooltip content is versioned and localized through the existing immutable
   content-revision model;
4. question 9 uses the wording from the PDF and offers an unambiguous
   not-applicable answer for organizations without partner or linked
   enterprises;
5. the existing `nis2/2026-v1` repository release is updated in place as an
   explicit project decision;
6. the guest and authenticated Betroffenheitscheck use the same updated
   content and interaction; and
7. the disposable development database is cleared and completely rebuilt
   before the modified `2026-v1` release is republished.

## Confirmed decisions

- Treat every German question, short description, and tooltip in the PDF as
  authoritative.
- Translate all new or changed content into English from the final German
  wording. Do not copy older English text when its meaning no longer matches.
- Keep the short description visible. The tooltip is supplementary content,
  not a replacement for visible guidance.
- Add a nullable `tooltip_content_revision_id` foreign key to `questions`.
  Do not store localized tooltip prose in `questions.config`.
- Keep the tooltip field optional for the shared questionnaire schema because
  Gap questionnaires do not require it.
- Require all twelve questions in this NIS2 Betroffenheitscheck release to
  reference complete German and English tooltip content.
- Display the tooltip only in the live applicability form, which covers both
  guest and authenticated flows. Do not extend the currently unused generic
  questionnaire preview in this change.
- Use a keyboard-focusable information button beside the question heading.
  Support pointer hover, keyboard focus, Escape, focus loss, and touch focus.
- Modify `nis2/2026-v1`; do not introduce `2026-v2`.
- Keep `nis2-gap/guided-v3` compatible with the rebuilt `2026-v1`.
- Clear the disposable database rather than migrate existing assessments or
  attempt to republish over the existing immutable database row.
- Update active product, ruleset, architecture, and provenance documentation.

## Non-goals

- Do not add a tooltip-specific table.
- Do not put German and English strings in JSON configuration.
- Do not make tooltips mandatory for Gap or future questionnaire types.
- Do not add tooltips to the generic questionnaire-preview component.
- Do not change the number or stable keys of Betroffenheitscheck questions.
- Do not change answer persistence from language-neutral stable values.
- Do not build a group-company or SME-size calculator.
- Do not preserve or transform data in the disposable development database.
- Do not introduce a new compliance or Gap release label.

## Current implementation gaps

The existing stack already separates question text and short help text:

```text
repository release source
  -> localized content items/revisions/translations
  -> questions.question_content_revision_id
  -> questions.help_content_revision_id
  -> runtime release assembler
  -> ApplicabilityQuestionDto
  -> ApplicabilityQuestionnaireForm
```

There is no corresponding tooltip field. `questions.config` contains
presentation controls and visibility conditions, so using it for localized
prose would bypass the repository's content validation, translation fallback,
content hashing, and immutable revision model.

Question 9 currently maps to `sme_figures_verified`. The current evaluator
accepts `yes` for the EU-core path and the two German verification codes for
the German profile. Every other value makes the size classification
`unknown`. Under the new wording, a plain `no` is ambiguous: it could mean
that required group values were omitted, or simply that no partner or linked
enterprises exist. The implementation must distinguish those states.

Publication also refuses to create a second database row for the same check
code and version label. Updating `2026-v1` therefore requires the approved
development clear and reseed.

## Target data model

Extend `questions` in [`src/db/schema.ts`](../../../src/db/schema.ts):

```ts
tooltipContentRevisionId: uuid("tooltip_content_revision_id")
```

Add a restrictive foreign key:

```text
questions_tooltip_content_fk
  questions.tooltip_content_revision_id
  -> content_revisions.id
  ON DELETE RESTRICT
```

The column remains nullable. It does not need an index because runtime loading
starts from a question row and resolves the referenced content revision; there
is no planned reverse lookup by tooltip revision.

The database owns the relationship, while the release validator owns the
Betroffenheitscheck-specific rule that all twelve questions must have a
tooltip.

Apply the schema through the repository's reviewed Drizzle workflow:

1. change `src/db/schema.ts`;
2. add a schema-contract test for the nullable column and restrictive foreign
   key;
3. run `npm run db:push -- --explain`;
4. confirm the preview contains only the nullable column and foreign key;
5. run `npm run db:push`; and
6. rerun schema, RLS, and integrity verification before clearing data.

Do not introduce hand-written DDL for this ordinary Drizzle-owned column.

## Release-source and content changes

### Source types

In
[`release-source.ts`](../../../src/server/compliance/nis2/releases/2026-v1/release-source.ts),
extend `Nis2SeedQuestion` with required:

```ts
tooltipText: string;
tooltipTextEn: string;
```

Making these fields required at the concrete NIS2 source level prevents a
twelfth-question omission during authoring.

In
[`releases/types.ts`](../../../src/server/compliance/nis2/releases/types.ts),
extend the reusable `ReleaseQuestionSource` with:

```ts
tooltipContentKey?: string;
```

The generic release shape remains optional so other questionnaire families are
not forced to add tooltip content.

### Content creation

In
[`2026-v1/release.ts`](../../../src/server/compliance/nis2/releases/2026-v1/release.ts),
create one localized content item per question with the stable-key pattern:

```text
nis2.question.<question-stable-key>.tooltip
```

Assign its key to `tooltipContentKey`. As with question and help content, use
`addContent` so both translations are included in:

- publication validation;
- content hashes and the aggregate release hash;
- `content_items`, `content_revisions`, and `content_translations`; and
- `compliance_check_release_content_revisions`.

Update the release validator to:

1. resolve `tooltipContentKey` when present;
2. reject a missing or unknown tooltip content key;
3. require every one of the twelve current NIS2 questions to have a tooltip;
   and
4. rely on the existing complete-translation validation for nonblank `de` and
   `en` values.

Add a compiler test proving that changing tooltip wording changes the
questionnaire and aggregate identities.

### Authoritative copy

Copy all German question titles, short descriptions, and tooltip texts exactly
from the PDF. This intentionally updates small wording differences in existing
descriptions and adds the currently missing descriptions for questions 7 and
8.

The new question 9 title is:

> Beziehen sich die angegebenen Unternehmensgrößen auch auf verbundene
> Unternehmen oder Partnerunternehmen?

Its English translation should be:

> Do the stated company-size figures also include linked enterprises or
> partner enterprises?

The new short German description is:

> Eine bloße Konzernzugehörigkeit entscheidet nicht über NIS2. Entscheidend
> ist, dass die Mitarbeiteranzahl und Finanzwerte korrekt ermittelt wurden.

Its English translation should be:

> Mere membership of a corporate group does not determine NIS2 applicability.
> What matters is that the employee count and financial figures have been
> calculated correctly.

Translate every tooltip directly from the corresponding German paragraph.
Use the established NIS2 vocabulary in
[`current-nis2-ruleset.de-en.md`](../../product/current-nis2-ruleset.de-en.md),
including:

- `Einrichtungsart` / `entity type`;
- `wesentliche Einrichtung` / `essential entity`;
- `wichtige Einrichtung` / `important entity`;
- `verbundene Unternehmen` / `linked enterprises`;
- `Partnerunternehmen` / `partner enterprises`;
- `Jahresarbeitseinheiten` / `annual work units`; and
- `Jahresbilanzsumme` / `annual balance-sheet total`.

Do not translate `Betroffenheit` literally in user-facing English when
`applicability` or `scope` expresses the product meaning more clearly.

## Question 9 semantic correction

Add this language-neutral fact and question-option value:

```text
not_applicable_no_partner_or_linked_enterprises
```

Recommended labels:

```text
DE: Nicht zutreffend – keine Partner- oder verbundenen Unternehmen
EN: Not applicable – no partner or linked enterprises
```

The option belongs to catalog `all`, so it is available in both the EU-core
and German profile-driven versions of question 9.

Preserve the existing meanings:

- `no` means relevant partner or linked enterprises were not correctly
  included and must continue to produce an unknown size classification;
- `unsure` remains unresolved;
- EU-core `yes` remains accepted;
- `verified_de_without_it_exception` remains accepted for Germany;
- `verified_de_with_it_exception` remains accepted for Germany; and
- `not_applicable_no_partner_or_linked_enterprises` is accepted for both paths
  because no group aggregation is required.

Update only the current `nis2_scope_v3` verification-code lists in
[`rules.ts`](../../../src/server/applicability-check/rules.ts). Do not reinterpret
the retained historical `nis2_scope_v2` evaluator.

Update the fact description in both languages so it describes correctly
calculated figures and the no-related-enterprises state, rather than implying
that every organization must aggregate another enterprise.

Add deterministic tests covering:

1. German size-dependent classification with the new not-applicable value;
2. the EU-core accepted-verification branch with the same value;
3. `no` still producing `sizeClassification: "unknown"` and
   `clarification_required` where size is decisive; and
4. `unsure` remaining unresolved.

This changes the compiled rule artifact and aggregate hash while deliberately
retaining the approved `2026-v1` label and evaluator identifier.

## Publication and runtime path

### Publisher

In
[`publish-release.ts`](../../../src/server/compliance/publishing/publish-release.ts),
write:

```ts
tooltipContentRevisionId: source.tooltipContentKey
  ? contentRevisionId(source.tooltipContentKey)
  : null
```

The existing content-revision pinning then includes tooltip revisions without
a new join table.

Gap publication requires no behavior change. Its questions will write `null`
for the new optional column.

### Runtime assembly

Extend `RuntimeReleaseQuestion` in
[`runtime-release/types.ts`](../../../src/server/compliance/runtime-release/types.ts)
with:

```ts
tooltipText: string | null;
```

In
[`postgres-assembler.ts`](../../../src/server/compliance/runtime-release/postgres-assembler.ts),
resolve `entry.question.tooltipContentRevisionId` through the same
locale/fallback function used for question and help content.

This ensures:

- the requested locale wins;
- the pinned release default locale remains a defensive fallback;
- missing fallback content fails closed; and
- translation-fallback warnings retain their current structured behavior.

Update inferred-row fixtures after the schema addition. In particular,
runtime-release fixtures based on `typeof questions.$inferSelect` must include
`tooltipContentRevisionId`.

The explicit Gap question queries may continue omitting the new column because
Gap does not render these tooltips. Confirm that their typed fixtures and
explicit column selections still compile.

### Applicability DTO

Extend `ApplicabilityQuestionDto` in
[`applicability-check/service.ts`](../../../src/server/applicability-check/service.ts)
with:

```ts
tooltipText: string | null;
```

Both guest and authenticated questionnaire readers already map the same
runtime questions, so no route-specific duplication is needed.

Keep `QuestionnairePreviewDto` and
[`questionnaire-preview.tsx`](../../../components/questionnaires/questionnaire-preview.tsx)
unchanged. If the runtime mapper would otherwise leak the extra property into
that preview object, explicitly omit `tooltipText` there.

## Frontend interaction

Update
[`applicability-questionnaire-form.tsx`](../../../components/applicability-check/applicability-questionnaire-form.tsx):

1. wrap the question list in one `TooltipProvider`;
2. render the existing question title unchanged;
3. when `question.tooltipText` is non-null, place an icon-only `button` directly
   after the title and before the required badge;
4. use the existing primitives from
   [`components/ui/tooltip.tsx`](../../../components/ui/tooltip.tsx);
5. use the Lucide `Info` icon with the SVG hidden from assistive technology;
6. give the button `type="button"` so it never submits the questionnaire;
7. give it a visible keyboard focus ring and an adequate touch target;
8. provide a localized accessible name; and
9. keep the visible `helpText` paragraph below the title row.

Add this static interface label to the German and English applicability form
dictionary in [`lib/i18n/messages/modules.ts`](../../../lib/i18n/messages/modules.ts):

```text
DE: Weitere Informationen
EN: More information
```

Use a constrained but wrapping tooltip content width, for example `max-w-sm`,
because the supplied paragraphs are much longer than existing one-line
tooltips. Avoid fixed heights and preserve left-aligned readable paragraphs on
narrow screens.

Acceptance behavior:

- pointer hover opens the tooltip;
- tab focus opens it without requiring a mouse;
- Escape closes it and returns the user to the trigger;
- moving focus away closes it;
- tapping the focusable trigger exposes the text on a touch device;
- the trigger has an accessible name in the active locale; and
- every answer control remains usable while a tooltip is open.

If the existing Radix tooltip behavior does not remain open after a real touch
tap, add the smallest controlled-open adaptation around the trigger rather
than replacing the application-wide tooltip primitive.

## Documentation updates

Update these active documents during implementation:

1. [`docs/product/current-nis2-ruleset.de-en.md`](../../product/current-nis2-ruleset.de-en.md)
   - document the new question 9 option code;
   - state that it is an accepted verified-size state for both profile paths;
   - retain `no` and `unsure` as unresolved;
   - add it to the German size-logic accepted values.
2. [`docs/architecture/db-schema-plan.md`](../../architecture/db-schema-plan.md)
   - replace the stale claim that English question text lives in JSON;
   - document question, help, and optional tooltip content-revision foreign
     keys;
   - show JSON as UI/visibility configuration only;
   - update the question schema example to the implemented model.
3. [`docs/architecture/end-to-end-compliance-workflow.md`](../../architecture/end-to-end-compliance-workflow.md)
   - include short descriptions and tooltips in the pinned release-content
     provenance;
   - reiterate that stable option values, not localized prose, drive the
     evaluator.
4. [`docs/product/product-structure.md`](../../product/product-structure.md)
   - state that Betroffenheitscheck question, description, and tooltip content
     comes from the pinned localized Compliance Release.

Do not rewrite old implementation-plan decisions solely to make them appear
historically different. Update active/current documentation and add a short
cross-reference where an old plan would otherwise mislead readers.

## Automated verification

### Schema

Add or extend a schema test to assert:

- `tooltip_content_revision_id` exists on `questions`;
- it is nullable;
- `questions_tooltip_content_fk` exists;
- the foreign key targets `content_revisions.id`; and
- deletion behavior is `restrict`.

### Release compilation and publication

Extend compliance release tests to assert:

- there are still exactly twelve questions;
- every question has a valid tooltip content key;
- every tooltip has nonblank `de` and `en` translations;
- removing one tooltip key fails validation;
- changing tooltip copy changes questionnaire and aggregate hashes;
- question 9 contains the new stable option value; and
- question order and all other stable question keys are unchanged.

### Runtime localization

Extend runtime-release fixtures and tests to cover:

- German tooltip resolution;
- English tooltip resolution;
- fallback to German with the existing warning when English is unavailable;
  and
- `null` for a shared question that has no tooltip.

### Evaluator

Extend `tests/applicability-check-rules.test.ts` with the four question 9 cases
listed above. Keep existing fixtures using the German verification codes unless
a fixture is specifically testing the new not-applicable state.

### Database smoke

Extend [`scripts/smoke-nis2-scope.ts`](../../../scripts/smoke-nis2-scope.ts) to
verify after reseeding that:

- the active release still has twelve questions;
- all twelve active Betroffenheitscheck rows have a non-null
  `tooltip_content_revision_id`;
- a German and an English guest questionnaire each return localized
  `tooltipText`;
- question 9 offers the new stable option in the applicable catalog; and
- a submission using the new value receives a known size classification.

### Command gates

Before the destructive database step, run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:i18n
npm.cmd run build
```

After reseeding, run the complete gates from
[`development-database-reset-and-bootstrap.md`](../../database/development-database-reset-and-bootstrap.md),
including schema drift, server-only security, integrity, storage, corpus,
localized metadata, Gap requirements, applicability, Gap, authenticated
workflow, tests, and build checks.

## Disposable database rollout

Follow
[`development-database-reset-and-bootstrap.md`](../../database/development-database-reset-and-bootstrap.md)
without abbreviating its governance steps.

### 1. Preflight

- Confirm `DATABASE_URL` and `DRIZZLE_DATABASE_URL` resolve to the same approved
  disposable target.
- Confirm a verified backup exists.
- Stop the web app, workers, monitors, and all other writers.
- Record the existing Supabase Auth UUID that will be restored as Platform
  Administrator.
- Verify corpus, storage, embedding, and AI configuration before clearing.
- Confirm the schema preview contains no unexpected destructive changes.

### 2. Apply and verify the schema

Apply the reviewed nullable column and foreign key before the data clear. Run
the server-only and integrity verifiers and require a zero-drift follow-up
preview.

### 3. Clear application tables

Run the guarded `db:clear` command with the exact confirmation value from the
runbook. This clears Drizzle-managed public application tables, including
organizations, assessments, releases, content revisions, and the Platform
Administrator registry. It does not delete Supabase Auth users or Storage
objects.

### 4. Rebuild governed prerequisites

- Re-register the Platform Administrator.
- Seed the legal-corpus fixture.
- Drain import, parsing, and embedding jobs.
- Inspect the exact generated EU and German corpus generations.
- Record human review using the guarded approval command.
- run evaluations; and
- activate only passed EU and German corpus releases.

Do not bypass the corpus review/evaluation checkpoint with direct SQL.

### 5. Republish modules

Publish and activate:

```text
nis2/2026-v1
nis2-gap/guided-v3
```

The modified `2026-v1` aggregate hash must differ from the pre-change hash.
The newly published `guided-v3` row must pin the newly created compatible
`2026-v1` database release ID.

### 6. Verify and reopen

Run every runbook verification gate and the enhanced NIS2 smoke. Do not restart
application writers until all schema, security, corpus, release, applicability,
Gap, test, and build checks pass.

## Manual acceptance matrix

Verify both German and English in:

- `/check/applicability` for the guest flow; and
- `/tool/organizations/<organization-id>/applicability-check/new` for the
  authenticated flow.

For each flow:

1. confirm questions, visible descriptions, and ordering match the PDF;
2. confirm questions 7 and 8 now have visible descriptions;
3. confirm question 9 has the new title and not-applicable option;
4. open at least one short and one long tooltip by mouse;
5. open and close the same tooltips using Tab, Shift+Tab, and Escape;
6. verify the accessible button name in the active language;
7. verify wrapping and viewport containment at desktop and narrow mobile
   widths;
8. verify a real touch tap can expose and dismiss the tooltip;
9. complete a normal German size-dependent submission using an existing German
   verification answer; and
10. complete another using the new not-applicable answer and confirm it does
    not create a false size-aggregation clarification.

## Recommended implementation sequence

1. Add the nullable schema field, foreign key, and schema test.
2. Extend release-source types, canonical PDF copy, English translations, and
   tooltip content keys.
3. Add the question 9 not-applicable option and evaluator behavior.
4. Extend publication validation and persistence.
5. Carry localized tooltip content through runtime types and the applicability
   DTO.
6. Add the accessible information-button presentation and static UI labels.
7. Update unit, compiler, runtime, and database smoke tests.
8. Update connected product and architecture documentation.
9. Pass all code-level verification.
10. Apply the reviewed schema, clear the disposable database, rebuild the
    corpus, and republish both modules.
11. Pass all database and manual acceptance gates.

## Completion criteria

This change is complete only when:

- the schema and runtime use a content-revision foreign key rather than JSON
  prose;
- the PDF's German copy is represented exactly;
- every changed field has a reviewed English translation;
- all twelve active questions return localized tooltip text;
- guest and authenticated forms expose accessible information icons;
- question 9 distinguishes no related enterprises from missing aggregation;
- active documentation describes the implemented data and rule model;
- `nis2/2026-v1` and `nis2-gap/guided-v3` are republished against passed corpus
  releases;
- automated and manual acceptance gates pass; and
- the final Drizzle preview reports no schema drift.
