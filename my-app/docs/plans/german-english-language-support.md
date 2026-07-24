# German and English Language Support

Status: Planned

## Objective

Make German and English complete, consistent product languages across all
user-visible surfaces while preserving the separate database-backed
localization system for immutable legal, questionnaire, and compliance-release
content.

## Current findings

The existing selector supports `de` and `en`, writes the `complyx-locale`
cookie, and refreshes the current route. Requests carrying either locale return
the corresponding translated page copy.

Language support is nevertheless incomplete:

- `app/layout.tsx` always renders `<html lang="de">`, including for English
  pages.
- The organization dashboard contains German-only labels.
- Login error states and the password-reset link contain German-only copy.
- Some components localize copy through inline locale conditionals instead of a
  shared typed dictionary.
- Several client components can display raw service or API error messages.
- Public and authentication pages do not currently expose a language selector.
- Existing tests cover selected localized business content, but not the actual
  language-selector flow or document language metadata.

## Agreed decisions

- Support the entire user-visible product, not only the currently confirmed
  defects.
- Keep German as the deterministic default when no locale cookie exists.
- Keep locale selection cookie-based and browser-specific.
- Do not introduce `/de/` or `/en/` URL prefixes.
- Do not add account-level, cross-device language synchronization.
- Add a public selector to home, authentication, password recovery, error, and
  guest-check pages.
- Keep the authenticated selector in the profile menu.
- Label the options using autonyms: `Deutsch` and `English`.
- Split static UI translations into typed feature-level modules.
- Preserve the database-backed localization path and its release semantics.
- Require German and English parity for static UI copy and publishable database
  content.
- Retain German runtime fallback for legacy or corrupt database content, but
  make fallback usage observable.
- Localize metadata, accessibility text, dates, numbers, validation messages,
  errors, statuses, PDFs, and other generated user-facing output.
- Preserve existing approved wording except where copy is missing or obviously
  inconsistent.
- Represent API and service failures with stable error codes and structured
  details; translate them at the UI boundary.
- Add browser-level selector coverage without depending on a hosted Supabase
  test account.
- Add CI protection against dictionary drift and new hardcoded UI copy.

## Localization boundaries

### Static UI messages

Static application copy belongs in typed, feature-level message modules:

- Common navigation and shared controls
- Authentication
- Organizations and dashboard
- Applicability checks
- Gap analysis and action plans
- Documents
- Reports
- Errors, statuses, and enum display mappings

German and English messages for a feature should be colocated and validated as
having identical keys. `lib/i18n.ts` may remain as a compatibility facade while
callers are migrated.

### Database-backed content

The existing database dictionary remains responsible for immutable,
release-versioned content, including:

- Legal and regulatory text
- Questionnaire titles, questions, help text, and options
- Compliance-release content
- Gap-analysis release content

The `content_translations` schema, release hashes, publication workflow, and
runtime release assembly must not be replaced or duplicated by the static UI
dictionary.

### Language-neutral data

Stored statuses, outcomes, roles, error codes, and workflow values remain
language-neutral. UI components map those values to localized labels instead of
displaying raw codes or transforming identifiers cosmetically.

## Implementation plan

### Phase 1: Establish failing regression coverage

- Add a route-level test proving that an English cookie produces English body
  copy but currently fails the `<html lang="en">` assertion.
- Cover German as the cookie-less default.
- Request German and English pages in alternating order to detect cache leakage.
- Record the known dashboard and login mixed-language cases as regression
  tests at the closest reliable seam.
- Keep these tests red until their corresponding implementation changes land.

### Phase 2: Introduce typed feature message modules

- Add a small message-definition helper that enforces identical German and
  English key structures without constraining translated string values.
- Split the current `lib/i18n.ts` dictionary by product feature.
- Assemble the feature modules into the existing `Dictionary` interface.
- Preserve `getLocale()`, `getDictionary()`, and `getDefaultDictionary()` as a
  stable facade during migration.
- Add a dictionary-parity test in addition to compile-time enforcement.

### Phase 3: Correct document language, metadata, and formatting

- Resolve the active locale in the root layout.
- Render `<html lang={locale}>`.
- Replace static metadata with locale-aware titles and descriptions.
- Confirm that Next.js treats locale-cookie reads as dynamic and does not reuse
  one locale's output for another locale.
- Add shared locale-tag and formatting helpers for:
  - Dates and times
  - Numbers and percentages
  - Currency values
  - Generated filenames where language-specific naming is required
- Use `de-DE` for German and the agreed English formatting locale for English.

### Phase 4: Provide selectors on public and authenticated surfaces

- Extract shared locale-changing behavior from
  `components/language-switcher.tsx`.
- Retain the profile-menu presentation for authenticated workspaces.
- Add a compact public presentation to:
  - Home
  - Login and signup
  - Forgot-password and update-password
  - Authentication error pages
  - Guest applicability questionnaire and result pages
- Keep the current path and query parameters when switching.
- Persist the cookie for one year.
- Provide accessible names, keyboard operation, visible active state, and
  autonym labels.
- Avoid adding a production-only authentication bypass for testing.

### Phase 5: Migrate all user-visible application copy

- Audit `app/**/*.tsx`, `components/**/*.tsx`, and server-side renderers for
  literal user-facing strings.
- Move hardcoded dashboard labels into the organization/dashboard messages.
- Move login errors and password-reset copy into authentication messages.
- Replace scattered `locale === "de"` copy branches with feature messages.
- Cover:
  - Headings and descriptions
  - Buttons and links
  - Placeholders and help text
  - Empty and loading states
  - Dialogs and confirmation prompts
  - Toasts and notices
  - Form validation
  - Accessible names and image alternative text
- Preserve established translations unless a missing or inconsistent string
  must be corrected.

### Phase 6: Localize errors and technical display values

- Define typed localized maps for user-visible statuses, outcomes, roles, and
  workflow values.
- Stop rendering raw database or API codes.
- Replace underscore-to-space transformations with explicit display mappings.
- Standardize service and API failures around stable codes and structured
  details.
- Treat API `message` fields as diagnostic information, not display copy.
- Add a shared UI error-localization helper and feature-specific error maps.
- Classify external Supabase errors into stable application error codes before
  displaying them.
- Replace direct `error.message` rendering in forms and workflows with
  localized code lookup and a localized generic fallback.

### Phase 7: Localize generated output

- Move compliance-report and PDF copy into typed report messages.
- Ensure the requested locale travels with every report-rendering job.
- Verify titles, headings, dates, filenames, empty states, and provenance labels
  in both languages.
- Extend report tests to extract and assert PDF text rather than only checking
  that PDF bytes were produced.
- Audit any other downloadable or externally visible generated content using
  the same rules.

### Phase 8: Preserve and observe database translation fallback

- Keep publication validation requiring both German and English content.
- Keep runtime fallback to the release's German default for resilience.
- Emit a structured warning whenever requested content falls back to German.
- Include release and content identifiers in the warning, but never log legal
  text or organization evidence.
- Add tests for:
  - Requested translation present
  - German fallback used
  - Neither requested nor fallback translation present
  - Warning emission only when fallback occurs
- Confirm that no database migration, content rewrite, release hash change, or
  release republication is introduced.

### Phase 9: Add regression and CI protection

- Add Playwright as a development dependency.
- Configure Playwright to start the application locally for public-route tests.
- Add a browser test covering:
  - German default
  - German to English switching
  - English to German switching
  - Cookie value and lifetime
  - Reload persistence
  - Navigation persistence across public routes
  - `<html lang>` and localized metadata
  - Separate browser contexts to detect cache leakage
- Add a component or contract test proving that an authenticated profile menu
  includes the same selector and active locale without requiring Supabase.
- Add a TypeScript-AST localization guard for JSX text and user-facing
  attributes or props.
- Maintain explicit exceptions for brand names, technical identifiers, CSS
  values, test fixtures, and other non-display strings.
- Add `check:i18n` to the standard verification workflow.

## Suggested commit sequence

1. Add failing locale and document-language regression tests.
2. Introduce typed feature message modules and dictionary parity checks.
3. Make root document language, metadata, and formatting locale-aware.
4. Add the shared public and authenticated selector presentations.
5. Migrate hardcoded UI copy feature by feature.
6. Localize errors, statuses, outcomes, and other technical values.
7. Localize and verify PDFs and generated output.
8. Add database fallback observability and tests.
9. Add Playwright coverage and the CI localization guard.

Each commit should leave type checking and all previously green tests passing,
apart from an intentionally red regression test that is fixed in the immediately
following commit.

## Verification

Run the following before completion:

```text
npm run lint
npm run typecheck
npm test
npm run check:i18n
npm run build
npm run test:e2e
```

Manual verification should cover one complete public flow and one authenticated
workspace flow in each language, including a validation error, an empty state,
a status value, and a generated report.

## Definition of done

- Every user-facing surface can be used entirely in German or entirely in
  English.
- No German copy appears while English is selected, and no English copy appears
  while German is selected, except for agreed proper names and autonyms.
- The selected locale controls body copy, `<html lang>`, metadata,
  accessibility text, date and number formatting, validation, errors, statuses,
  and generated output.
- German remains the default without a cookie.
- The locale persists through reloads and navigation without changing the URL.
- Public and authenticated selectors use the same locale-changing behavior.
- Raw technical codes and server messages are not shown to users.
- Static dictionary parity and database publication requirements both enforce
  German and English completeness.
- Database-backed release content and reproducibility remain unchanged.
- Linting, type checking, unit/integration tests, production build,
  localization checks, and Playwright tests pass.

## Non-goals

- Locale-prefixed URLs
- Browser-language auto-detection
- Account-level language preference persistence
- Database schema changes
- Rewriting or republishing legal and questionnaire translations
- Broad editorial rewriting of already approved German or English copy
