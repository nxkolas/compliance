# Legal corpus provisioning and activation

Status: current simplified workflow as of 2 August 2026.

Legal sources are immutable evidence, not executable release configuration.
There is no corpus publication/evaluation control plane. A family points to one
immutable active snapshot whose members pin exact successful processing
generations.

## Prerequisites

Complete the four database/storage stages in the
[Drizzle workflow](drizzle-workflow.md). Verify server-only RLS, database
integrity, and all private Storage buckets. Configure the grounded provider and
embedding model used by the worker without exposing server-only values in logs.

## Provision and process

Prepare a reviewed manifest containing the real source, version, rendition,
retrieval time, content hashes, Storage object keys, parser, and embedding
model. Upload those exact rendition objects to the private legal-corpus bucket,
then run:

```powershell
npm run db:provision:legal-corpus -- provision <manifest.json>
npm run worker
```

Wait until every manifest-created `legal_source_processing` job and processing
generation succeeds. Each selected generation must contain non-empty chunks
and a matching embedding for every chunk. Do not substitute the fixture for the
retained pre-production corpus.

## Bind, validate, and activate

Review the recovered text anchors, then bind every stable provision used by the
current Gap contract:

```powershell
$env:CORPUS_OPERATOR_IDENTITY='<deployment identity>'
npm run db:bind:gap-corpus-provisions
npm run db:validate:legal-corpus -- <family-code> <generation-id,...>
npm run db:activate:legal-snapshot -- <family-code> <generation-id,...>
```

Validation rejects missing/failed generations, cross-family lineage, empty
chunks, missing model-matched embeddings, and any current Gap provision that
does not resolve to a selected chunk. Activation repeats validation, locks the
family, creates the immutable snapshot and ordered membership, advances the
family pointer, and appends the platform audit event in one transaction.

Repeat validation/activation for each family required by the current Gap
definition. Finish with database integrity verification, a grounded workflow
smoke using the deterministic/local provider, and a second Drizzle explanation
showing zero drift.

`npm run db:verify:active-corpus` revalidates every currently active family
required by the deployed Gap definition against its pinned generations.
