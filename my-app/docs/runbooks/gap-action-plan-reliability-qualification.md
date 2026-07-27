# Reliability-v1 qualification

The repository release reference is `nis2-gap/reliability-v1`. Publication is
deliberately separate from activation:

```sh
npm run db:publish:gap -- --release nis2-gap/reliability-v1
```

Do not run `db:activate:gap` until the live and manual gates below pass.

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

The existing five-case live runner can target the inactive release without
changing the active pointer:

```sh
npm run eval:gap-action-plan-manual -- \
  --gap-release-version reliability-v1 \
  --run-id reliability-v1-qualification
```

## Human gates

Independent English and German reviewers must check safety, grounding,
language, traceability, uncertainty handling, and material content quality.
Record the review alongside the live result manifest. Activation remains a
separate operator decision.
