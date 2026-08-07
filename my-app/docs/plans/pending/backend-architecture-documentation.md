# Backend Architecture Documentation

Status: accepted plan, implementation started 7 August 2026.

## Objective

Create a new, self-contained architecture documentation set for the backend
and database at `docs/backend-architecture/`, readable with ease by a new
developer or a professor. Frontend is out of scope.

## Decisions (agreed with the owner)

- New folder: `docs/backend-architecture/`; existing docs are untouched.
- Fully self-contained: no links to other documentation folders; operational
  runbooks are intentionally not linked.
- English first; German translation may be added later.
- Depth: understanding-first with navigational pointers; exhaustive only as
  table inventory, route map, and job catalog.
- Deep domain docs: auth, organizations, storage, documents, corpus, reports.
  Questionnaires/definitions, compliance releases, audit, and progress are
  covered inside overview, schema, and route map.
- One placeholder doc for the Betroffenheitscheck calculation (calculation is
  being redefined).
- Conventions: status line per doc, Mermaid diagrams, code paths as pointers.

## Non-goals

- Frontend pages, components, and browser API clients.
- Operational runbooks (schema changes, incident recovery, deployment steps).
- Deleting or migrating the existing `docs/architecture/` folder.

## Structure

19 files: `README.md`, `system/{overview,workflows,deployment}.md`,
`database/schema.md`, `ai/{usage,local-ai}.md`,
`calculations/{gap-analysis,action-plan,applicability-check}.md`,
`jobs/jobs.md`, `api/{conventions,route-map}.md`,
`domains/{auth,organizations,storage,documents,corpus,reports}.md`.

## Acceptance criteria

- A reader can understand the backend from this folder alone.
- Every route, table group, job kind, and AI flow is covered at the agreed
  depth.
- Betroffenheitscheck doc is an explicit placeholder.
- Existing documentation is unchanged.

## Implementation sequence

1. Scaffold folder and write docs in reading order (done for all 19 files).
2. Owner review; adjust depth or wording.
3. Later: German translation when requested.

## Verification

- All files present, Markdown fences balanced.
- No links outside `docs/backend-architecture/`.

## Risks

- Staleness: docs must be updated when the calculation or schema changes.
- The placeholder doc must be filled when the Betroffenheitscheck
  calculation is redefined.

