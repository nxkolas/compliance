# Gap requirement dictionary normalization

Status: proposed

Date: 2026-07-24

## Goal

Move reusable, release-authored localized fields from
`gap_requirement_versions` into immutable content revisions and translations:

```text
content_items
  -> content_revisions
    -> content_translations
```

Organization-specific AI output, human input, and source evidence remain
outside the dictionary.

## Scope

Normalize these authored fields:

- requirement title;
- requirement text;
- recommendation; and
- labels nested in legal references.

Keep stable requirement codes, criticality, applicability metadata, legal
identifiers, and release membership on the Gap requirement model.

## Design work

1. Define one stable content-item identity for every authored Gap field.
2. Pin the required content revision IDs on immutable Gap requirement versions.
3. Resolve German and English values exclusively through
   `content_translations`.
4. Validate that every publishable requirement has complete translations for
   all supported locales.
5. Validate legal-reference publishers, identifiers, URLs, and translated
   labels without treating official source text as dictionary content.
6. Update the release compiler, publisher, loader, hashes, and integrity
   checks to use pinned content revisions.
7. Preserve release immutability: later translation edits create new content
   revisions and require a new Gap release.

## Migration and rollout

1. Add nullable revision references and dual-read verification.
2. Backfill authored fields into content items, revisions, and translations.
3. Compare old JSON values with resolved translations for every release.
4. Make revision references required for newly published releases.
5. switch loaders and publishers to dictionary-backed content.
6. Remove the localized JSON columns only after all active and historical
   releases resolve successfully.

## Tests

- publisher rejects missing or unsupported translations;
- hashes change when a pinned content revision changes;
- German and English release loading resolves exact authored values;
- historical releases keep their pinned wording;
- legal-reference labels resolve while official citations remain unchanged;
- generated Gap prose, corrections, organization input, and evidence never
  enter the dictionary.

## Acceptance criteria

- reusable Gap definitions resolve through immutable content revisions;
- every supported locale is complete before publication;
- release loading contains no fallback to localized JSON fields;
- existing generated business records keep their pinned output locale and
  plain-text prose unchanged;
- source evidence remains byte-for-byte faithful to its source.
