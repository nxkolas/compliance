# Gap Analysis and Action Plan workflow

Status: current code-owned workflow as of 2 August 2026.

## Analysis cycles

The deployed build owns the Gap questionnaire, requirements, legal-provision
mappings, prompt contracts, and definition hash. PostgreSQL does not select an
active Gap release. An analysis cycle records that code-owned definition hash,
one immutable questionnaire revision, the selected immutable document versions,
the output locale, its generation job, and the generated output revision.

Answers remain mutable only while the cycle is in the question stage. Leaving
that stage creates an immutable localized assessment revision. Archived
documents cannot be added to a new cycle, and selected document-version IDs are
locked when generation starts.

Successful cycles remain available as history. History rows identify their
`analysis_output_revision`, allowing the corresponding immutable result to be
opened. A new cycle may start while no Action Plan exists; answer prefill is
allowed only when the previous revision has the current definition hash.

## Grounded Gap generation

The worker derives category status and atomic gap kinds from the submitted
answers. Those values are server-owned. For every actionable category it then:

1. pins the current required legal-corpus snapshots;
2. retrieves mapped official legal passages and relevant chunks from the exact
   selected document versions;
3. admits questionnaire assertions and retrieved passages into a bounded prompt;
4. calls the organization’s configured provider with the Gap v12 response schema;
5. validates locale, identity, atomic cardinality, answer traceability,
   citations, and grounded claims; and
6. stages the validated output and exact admitted excerpts on a processing AI run.

A triggering questionnaire answer produces one to five short atomic gaps.
Selected organization evidence may support a gap or directly contradict a
questionnaire assertion. Missing, irrelevant, weak, or uncited document
evidence is not itself a contradiction. Only an admitted material direct
contradiction creates a blocking review state.

The output revision, findings, atomic gaps, exact context links, document and
applicability lineage, assessment evaluation, current-output pointer, cycle
completion, and successful AI-run transition are published in one database
transaction. A crash before publication leaves no partial business result. A
retry may recover a staged validated AI result by its deterministic idempotency
key; it never records a provider call that did not happen.

The Results projection includes every category in code-owned order, its status,
severity, summary, atomic gaps, review state, and exact Sources used. Inputs and
History are separate authorized projections and load only when requested.

## Action Plan generation

An Owner may enqueue the organization’s single Action Plan from the current Gap
revision only when that revision uses the current definition hash and has no
unresolved material contradiction. The route uses durable idempotency and an
operation rate limit.

The worker loads the exact findings, atomic gaps, source questionnaire answers,
selected document versions, and current legal-snapshot pins. It performs a
separate grounded provider operation per actionable category using the Action
Plan v6 contract. An action may cover several gaps and a gap may be covered by
several ordered actions, but actions cannot cross category boundaries. The
server validates complete many-to-many coverage before publication.

Plan, item, gap-link, audit, and successful AI-run writes publish atomically. A
same-job retry returns an existing plan only after verifying that every item has
a gap link and every source gap is covered; incomplete legacy state is rejected
for operator repair. Once created, generated content is immutable and only item
workflow status is editable.

## Provenance and operations

`ai_processing_runs` records the provider and model that actually handled the
request, prompt/build/definition identities, idempotency key, attempt and token
usage, validated input/output, claim validation, diagnostics, and lifecycle.
`ai_processing_run_context` stores the exact admitted legal and organization
excerpts. Finding and gap context-link tables connect the published result to
those excerpts.

Generation jobs expose shared job state and progress and may be cancelled only
with the corresponding write capability (`gap:contribute` or `plans:manage`).
Scheduled cleanup covers expired invitations, guest checks, uploads,
idempotency records, rate-limit windows, and old unreferenced terminal jobs.

## Contract and operator boundaries

Gap v12 and Action Plan v6 are the current code-owned response contracts. Their
labels are build metadata, not mutable database release records. The contracts
reject invalid shape, identity, coverage, citation, locale, URL, raw identifier,
and unsafe content. Category and provider concurrency remain bounded by
`AI_CATEGORY_CONCURRENCY` and `AI_PROVIDER_MAX_CONCURRENCY`.

Legal text remains evidence rather than executable configuration. A clean
installation is provisioned with:

```powershell
npm run db:provision:legal-corpus -- provision <manifest.json>
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod http://localhost:3000/api/internal/jobs/drain -Headers $headers
npm run db:provision:legal-corpus -- bind <bindings.json>
$env:CORPUS_OPERATOR_IDENTITY = "<deployment identity>"
npm run db:activate:legal-snapshot -- <family-code> <generation-id,...>
```

Provisioning assumes each rendition named in the manifest has already been
uploaded to the private legal-corpus storage bucket. Snapshot activation
validates successful processing lineage before changing the family’s current
snapshot pointer.

## Verification

Run the repository checks and current-schema smoke:

```powershell
npm run verify
npm run test:ai
npm run test:jobs
npm run test:routes
npm run test:report
npm run db:smoke:gap
```

A release qualification must also execute a fresh authenticated applicability
to Gap to Action Plan workflow against provisioned legal snapshots and a real
configured provider. It must inspect generated content, exact context links,
actual provider/model provenance, token usage, atomic-gap cardinality, and
Action Plan coverage—not only terminal job states.
