# Database structure

`src/db/schema.ts` is the source of truth for ordinary app schema. Apply it with `npm.cmd run db:push`; Supabase-only RLS, privilege, and retention operations live under `supabase/sql-editor/` and are documented in `docs/database/supabase-security-runbook.md`.

## Immutable compliance releases

The NIS2 checker uses four layers:

1. Stable identities: frameworks, facts, sectors, entity types, legal instruments, and content items.
2. Immutable versions: content revisions/translations, legal-instrument versions/provisions, scope-model entity versions, threshold sets, jurisdiction profiles, questionnaire versions, and compiled rule sets.
3. Aggregate releases: `compliance_check_releases` pins one exact questionnaire, EU model, threshold set, evaluator/rule artifact, fact-version set, content-revision set, and national-profile mapping. `active_compliance_check_releases` is the only mutable activation pointer; activation history is append-only.
4. Runtime records: assessments and guest sessions pin an aggregate release. Answer and fact choices use relational option joins. Generated artifact revisions store language-neutral evidence, while `nis2_result_projections` carries searchable NIS2-specific fields.

Published versions use restrictive foreign keys and are never updated by the publisher. A wording change creates a content revision; an evaluator-semantic change creates a new evaluator identifier/version and aggregate release.

The German profile has a separate relational catalog. `jurisdiction_entity_types` and their immutable versions cover the 67 BSIG Annex statutory categories, the supported out-of-Annex identities, and the explicit regional unresolved path. Mapping rows preserve exact/subset/aggregate/overlap provenance to the EU application catalog. `fact_options.catalog_code` selects either `eu_core` or a country catalog and is constrained against the corresponding EU or national identity foreign key. Typed threshold policies, jurisdiction rules, and effective-state declarations are pinned with the profile and copied into language-neutral result evidence.

## Authoring and deployment

Reviewed release sources live under `src/server/compliance/nis2/releases/`. Publication validates both locales, legal references, mappings, visibility, the 70 application entity identities, deterministic hashes, and golden fixtures before opening a transaction.

```powershell
$env:DB_CLEAR_CONFIRM='clear-app-tables'
npm.cmd run db:clear
npm.cmd run db:push
npm.cmd run db:publish:compliance -- --release nis2/2026-v1
npm.cmd run db:activate:compliance -- --release nis2/2026-v1
Remove-Item Env:DB_CLEAR_CONFIRM
```

Run this destructive sequence only after confirming that the configured database is the intended disposable development target. A remote Supabase hostname alone is not sufficient confirmation.

Publishing does not activate. Rollback changes only the active release pointer and retains all referenced historical data.

## Runtime invariants

- Browser roles have no direct table access; server APIs enforce organization authorization.
- Guest questionnaire load creates a `started` session pinned for 24 hours. Submission uses that pinned release and gives an unclaimed result a 14-day claim window.
- Claims preserve the guest release and convert option selections/facts in the same transaction that marks the guest record claimed.
- New assessments use the active release; old assessments and results are never reinterpreted.
- Result rendering resolves German/English content from the pinned release's content-revision set and reports when a newer release is active.
