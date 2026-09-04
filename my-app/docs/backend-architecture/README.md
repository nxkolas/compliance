# Backend Architecture

> Status: current as of 4 September 2026.
> Scope: backend and database only. Frontend pages, browser components, and
> browser API clients are intentionally not covered.

This folder explains how the backend of the NIS2 Compliance Checker works:
the system as a whole, the database, the API, background jobs, AI usage, the
compliance calculations, and the main backend domains.

The documentation is self-contained. You do not need to read any other
documentation folder to understand the architecture, and nothing in this
folder links out to the older architecture notes.

## Folder map

```
backend-architecture/
├── README.md                  ← you are here: index, reading paths, glossary
├── system/
│   ├── overview.md            ← system context, processes, module map
│   ├── workflows.md           ← the main end-to-end backend journeys
│   └── deployment.md          ← deployment modes and self-hosted topology
├── database/
│   └── schema.md              ← data model, table inventory, RLS, immutability
├── ai/
│   ├── usage.md               ← provider modes, grounding, generation pipeline
│   └── local-ai.md            ← local and browser-relayed model inference
├── calculations/
│   ├── gap-analysis.md        ← how Gap-Analyse results are computed
│   ├── action-plan.md         ← how Action Plans are generated
│   └── applicability-check.md ← Betroffenheitscheck (calculation TBD)
├── jobs/
│   └── jobs.md                ← durable job runtime and job catalog
├── api/
│   ├── conventions.md         ← envelopes, auth, validation, errors, limits
│   └── route-map.md           ← every API route grouped by domain
└── domains/
    ├── auth.md                ← authentication and authorization
    ├── organizations.md       ← multi-tenancy, members, invitations
    ├── storage.md             ← private object storage and uploads
    ├── documents.md           ← organization document processing
    ├── corpus.md              ← the authoritative legal corpus
    └── reports.md             ← PDF report generation
```

## How to read this

**For a professor or someone new to the project** — start with the journeys
in `system/workflows.md`, then read `system/overview.md` to see the parts of
the system those journeys touch. Follow up with `database/schema.md` and the
`calculations/` folder. The `api/`, `jobs/`, `ai/`, and `domains/` folders
provide detail on demand.

**For a developer joining the project** — start with `system/overview.md` and
`api/conventions.md`, then `jobs/jobs.md`. The route map, database inventory,
and domain docs are the practical reference for making changes. Every doc
contains code pointers so you can jump from a concept to the implementation.

## Conventions used here

- Every document carries a status line naming the date it reflects.
- Diagrams are Mermaid and describe the backend; browsers appear only as
  system boundaries.
- Source code is referenced by path relative to `compliance/my-app/`, e.g.
  `src/server/modules/gap-analysis/`.
- The documentation is written in English. German product terms are kept
  where they are part of the product vocabulary and glossed at first use.

## Glossary

| Term | Meaning |
| --- | --- |
| Betroffenheitscheck | The applicability check: a questionnaire that decides whether an organization is affected by NIS2 in a jurisdiction. |
| Gap-Analyse | Gap analysis: an AI-grounded assessment of an organization's compliance against NIS2 requirements, producing findings and atomic gaps. |
| Action Plan (Maßnahmenplan) | The generated remediation plan built from a finalized Gap revision. |
| Compliance release | A versioned, immutable bundle of questionnaire, rules, and evaluator code for a calculation. |
| Organization | The tenant boundary of the application; all compliance data belongs to one organization. |
| Revision | An immutable, published snapshot of an assessment or generated result. |
| Evidence | Legal text or organization documents retrieved and cited by a generation run. |
| Grounding | Supplying the model with exact, retrievable evidence and validating that its output stays within that evidence. |
| Durable job | A long-running background task whose state and leases live in PostgreSQL. |
| Legal corpus | The centrally curated, versioned collection of legal sources used for grounding. |
| RLS | Row-Level Security, PostgreSQL's per-row access control. |

## What is intentionally not here

- Frontend rendering, components, and browser-side API clients.
- Step-by-step operational runbooks (schema changes, incident recovery,
  deployment procedures).
- Product-level documentation of questionnaire content.
