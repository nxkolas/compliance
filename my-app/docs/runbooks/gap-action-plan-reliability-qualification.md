# Gap and Action Plan reliability qualification

The repository release reference is `nis2-gap/reliability-v1`. Publication is
deliberately separate from activation:

```sh
npm run db:publish:gap -- --release nis2-gap/reliability-v1
```

Do not run `db:activate:gap` until the live and manual gates below pass.

For the current objective-contract qualification, target the inactive
`nis2-gap/reliability-v7` successor. `reliability-v2` through
`reliability-v6` remain immutable failed qualification records.

## Automated gates

Run `npm run verify`, the Gap and Action Plan integration suite, database
integrity verification, and historical v7/v1 projection tests. Confirm that
category diagnostics contain only allowlisted issue codes and paths.

## Live matrix

Generate at least 100 categories per locale and multiple complete ten-category
workflows. Include mature, absent, mixed, uncertainty-heavy, contradictory
evidence, long German compounds, mixed satisfied/triggering controls,
splittable fixtures, timeout, HTTP 429, and active-call cancellation cases.

Report initial/repair provider latency and token usage separately. Acceptance
requires at least 98% initial category validation, at least 99% workflow
completion without intervention, p95 under 60 seconds, no valid-category
regeneration, and cancellation abort acknowledgement within three seconds.

The live runner expands the same five scenario identities across English and
German, producing ten workflows. It can target an inactive release without
changing the active pointer:

```sh
npm run eval:gap-action-plan-manual -- \
  --gap-release-version reliability-v7 \
  --run-id reliability-v7-bilingual
```

For a reviewed supplemental volume set, run individual `--case-number`
workflows into one output directory, then generate metrics for the available
artifacts with `--partial-manifest`. Keep the supplemental manifest beside the
full ten-case manifest and combine their disjoint category counts when
reporting the 100-category-per-locale gate.

Before activation, also run the connected-database lifecycle tests, integrity
verification, and the orphan repair dry-run. Activation is blocked if the
dry-run scope differs from the reviewed target set, if any terminal parent has
a processing child, or if any workflow/content gate fails.

## Human gates

Independent English and German reviewers must check safety, grounding,
language, traceability, uncertainty handling, and material content quality.
Record the review alongside the live result manifest. Activation remains a
separate operator decision.
