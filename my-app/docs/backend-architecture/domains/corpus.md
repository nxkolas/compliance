# Legal Corpus

> Status: current as of 3 September 2026.

## Purpose

The authoritative legal corpus is a centrally curated, versioned collection
of legal and regulatory sources shared across organizations. It is the
evidence base for grounded generation: workflows pin a corpus snapshot at
generation time so results stay reproducible after legal content changes.

Legal text is **evidence**, never executable questionnaire configuration.

## Data model

```mermaid
flowchart LR
    F[Family] --> S[Sources]
    S --> V[Source versions]
    V --> R[Renditions]
    R --> P[Processing generations]
    P --> C[Chunks]
    C --> B[Provision bindings - reviewed]
    F --> SN[Snapshots]
    SN --> M[Snapshot members]
```

- **Family** (`legal_corpus_families`): a framework/jurisdiction boundary
  (e.g., NIS2 Germany) with a current snapshot pointer.
- **Source** (`legal_sources`): a legal document with an authority tier
  (`primary_authority`, `official_guidance`, `curated_secondary`) and
  jurisdiction.
- **Version** (`legal_source_versions`): immutable versions with effective
  dates and content hash.
- **Rendition** (`legal_source_renditions`): language-specific expressions
  with translation status (`official`, `reviewed_internal`,
  `machine_assisted`) and storage location.
- **Processing generation** (`legal_source_processing_generations`): one
  parse/chunk run per rendition, executed by the `legal_source_processing`
  job.
- **Chunks** (`legal_source_chunks`): text chunks belonging to one processing
  generation, with generated search vectors.
- **Bindings** (`legal_provision_chunk_bindings`): reviewed stable provision
  keys bound to exact chunks — the bridge between legal text and the code's
  requirement keys.
- **Guidance** (`guidance_sources`, `guidance_chunks`,
  `guidance_provision_bindings`): curated secondary material, retrieved
  optionally and never persisted as citable evidence.
- **Snapshot** (`legal_corpus_snapshots` + members): a validated, immutable
  selection of successful processing generations per family. Members store
  only the generation ID and position; rendition, version, and source are
  reached through the normalized parent path. Activation rejects two
  generations derived from the same legal source.

## Operator pipeline

Corpus provisioning is a platform-operator workflow, not an organization
feature:

1. Operators create sources/versions/renditions from a reviewed manifest
   (scripts + `src/server/modules/legal-corpus/`).
2. The portable job runtime processes each rendition into chunks and search vectors.
3. Reviewers bind stable provision keys to exact chunks; validation proves
   completeness and citation resolvability.
4. Activation validates the candidate, then advances the family's immutable
   snapshot pointer atomically (`activateLegalCorpusSnapshot`).

Operator actions are idempotent, audited in `platform_audit_events`, and
rate-limited (`corpus:operate`).

## Pinning and retrieval

Generation resolves the pinned legal scope per family
(`src/server/modules/grounding/legal-retrieval.ts`): the snapshot active at the
operation is fixed, chunks are ranked lexically against the query, filtered
by authority tier, and surfaced with stable citation IDs. This makes an
AI-run's legal basis exact and reproducible even after new sources are
added.

## Practical navigation

- Domain and services: `src/server/modules/legal-corpus/`.
- Processing job: `src/server/modules/legal-corpus/processing-service.ts`.
- Snapshot activation: `src/server/modules/legal-corpus/snapshot-service.ts`.
- Retrieval integration: `src/server/modules/grounding/legal-retrieval.ts`.
- Operator scripts: `scripts/` (provision, validate, activate, export).
