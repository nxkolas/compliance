# Backend Module Organization Plan

## Status

Completed on 4 September 2026. The implementation preserves the public API and
database model while applying the module, platform, bootstrap, operations, and
physical schema boundaries described below.

## Objective

Make the backend easier to navigate and change by turning the existing feature
folders into explicit modules with small interfaces and clear dependency
direction.

The refactor should:

- make the owner of each backend behavior obvious;
- reduce catch-all `service.ts` files;
- prevent callers from depending on module internals;
- separate business modules from reusable platform code;
- split the physical Drizzle schema without changing the database model;
- preserve all routes, contracts, behavior, authorization, and job semantics;
- avoid speculative repositories, dependency-injection containers, or new
  dependencies; and
- remain reviewable as a sequence of small, behavior-preserving commits.

## Current state

The backend already has useful feature-oriented folders under `src/server`, but
their interfaces and ownership are inconsistent.

- `src/server` contains about 200 TypeScript files across roughly 25 top-level
  folders.
- `documents/service.ts`, `applicability-check/service.ts`, and
  `organizations/service.ts` each contain more than 800 lines and expose more
  than 20 operations.
- `src/db/schema.ts` contains all enums and approximately 45 tables in one file.
- More than 40 backend files import tables directly from the schema.
- Some feature folders provide an `index.ts` interface while others require
  callers to import implementation files directly.
- Shared infrastructure sometimes imports business behavior. For example, the
  grounding gateway imports a Gap-specific locale instruction, and the job
  definition registry imports Gap and Action Plan release hashes.
- Generic content processing currently depends on both Documents and Corpus,
  obscuring which module owns parsing and chunking.
- Backend and frontend tests are mixed in one flat `tests/` directory.
- The previous backend schema simplification plan still says it is ready for
  implementation even though much of its target state is present in the code.

The routes under `app/api` and the shared schemas under `src/contracts` are not
architectural mistakes. The App Router determines route placement, and the
contracts form the HTTP seam shared with browser code. They should remain in
place during this backend-only refactor.

## Architectural decisions

### 1. Organize by business module, not technical layer

The primary business modules are:

- Organizations;
- Applicability Check;
- Documents;
- Compliance Content;
- Legal Corpus;
- Grounding;
- Gap Analysis;
- Action Plans;
- Reports; and
- Audit.

Reusable execution and integration code belongs under `platform`. Operator-only
commands belong under `operations`. Application-wide wiring belongs under
`bootstrap`.

Do not create a universal `domain/application/infrastructure` directory tree
inside every module. Add a subfolder only when a module contains enough related
files to justify it.

### 2. Give every module one interface

Each business module exposes its supported operations from `index.ts`. Code
outside that module imports from this interface rather than from implementation
files.

The interface can include commands, queries, DTOs needed by server callers, and
job handlers. It should not expose parsers, persistence helpers, private policy
functions, or intermediate database row shapes merely to make tests convenient.

Inside a module, use relative imports. Tests should primarily exercise behavior
through the same interface used by callers.

### 3. Preserve direct Drizzle access inside modules

Direct database access is not the cause of the current readability problem.
Module implementation files may continue to use Drizzle and the shared schema.
Do not add one-method repository classes or ports with only one adapter.

Introduce a port only for behavior that genuinely varies, such as a production
external provider and its test adapter.

### 4. Keep transport thin

Files under `app/api` continue to own HTTP concerns:

- authentication;
- route parameters;
- request parsing and validation;
- idempotency and rate limiting at the HTTP seam;
- response envelopes; and
- cache revalidation.

They call business module interfaces for application behavior. Do not add an
extra controller layer between a thin route and its module.

### 5. Platform code cannot depend on business modules

Dependency direction should be:

```text
app/api and server-rendered pages
            |
            v
      business modules
            |
            v
       platform code
            |
            v
      database/external systems
```

Business modules may depend on other business modules through their public
interfaces when the product workflow requires it. Such dependencies must be
one-directional. Cross-module cycles must be removed rather than hidden behind
barrels.

### 6. Move files only after their ownership is clear

First split implementations and correct dependency direction in their current
locations. Move the stable groups into `modules`, `platform`, `bootstrap`, and
`operations` afterward. This keeps behavioral edits separate from mechanical
path changes.

## Target structure

```text
src/
|-- contracts/                         # shared HTTP schemas and DTOs; unchanged
|-- db/
|   |-- index.ts                       # connection and Drizzle instance
|   |-- schema.ts                      # stable public re-export
|   |-- schema/
|   |   |-- organizations.ts
|   |   |-- assessments.ts
|   |   |-- documents.ts
|   |   |-- jobs.ts
|   |   |-- ai.ts
|   |   |-- legal-corpus.ts
|   |   |-- gap-analysis.ts
|   |   |-- action-plans.ts
|   |   |-- reports.ts
|   |   `-- operations.ts
|   `-- relations.ts
`-- server/
    |-- modules/
    |   |-- organizations/
    |   |-- applicability-check/
    |   |-- documents/
    |   |-- compliance/
    |   |-- legal-corpus/
    |   |-- grounding/
    |   |-- gap-analysis/
    |   |-- action-plans/
    |   |-- reports/
    |   `-- audit/
    |-- platform/
    |   |-- http/
    |   |-- auth/
    |   |-- jobs/
    |   |-- ai/
    |   |-- content-processing/
    |   |-- storage/
    |   |-- idempotency/
    |   |-- rate-limit/
    |   `-- health/
    |-- bootstrap/
    |   |-- job-definitions.ts
    |   `-- maintenance.ts
    `-- operations/
```

This is a target map, not a requirement to create every listed directory at
the start. Empty scaffolding should not be committed.

## Target ownership map

| Current location | Target ownership |
| --- | --- |
| `src/server/api` | `src/server/platform/http` |
| `src/server/auth`, `src/server/users` | Business-facing identity/access modules initially; consolidate only where responsibilities overlap in practice |
| `src/server/jobs`, `src/server/job-execution` | `src/server/platform/jobs` for generic queue, lease, cancellation, and drain behavior |
| `src/server/ai/generation`, provider integrations | `src/server/platform/ai` |
| `src/server/ai/grounding` | `src/server/modules/grounding` because it coordinates compliance evidence for product workflows |
| `src/server/content-processing` plus generic parser/chunker types | `src/server/platform/content-processing` |
| `src/server/uploads`, `supabase-admin.ts` | `src/server/platform/storage` |
| `src/server/idempotency`, `src/server/rate-limit` | matching platform modules |
| `src/server/compliance` | `src/server/modules/compliance` |
| `src/server/corpus` | `src/server/modules/legal-corpus` |
| `src/server/definitions/applicability.ts` | Applicability Check module |
| `src/server/definitions/gap.ts` | Gap Analysis module |
| `src/server/dashboard`, `src/server/organization-progress` | Organization read models, unless future behavior proves they deserve a separate module |
| `src/server/operator-commands` | `src/server/operations` |
| `src/server/questionnaires` | Delete after the caller inventory confirms it remains unused |

## Proposed module shapes

Use filenames that describe behavior rather than repeating `service`.

### Organizations

```text
organizations/
|-- index.ts
|-- model.ts
|-- queries.ts
|-- lifecycle.ts
|-- memberships.ts
|-- invitations.ts
|-- settings.ts
|-- model-settings.ts
|-- embedding-migration.ts
`-- read-models.ts
```

Split the current `service.ts` by existing workflows. Do not introduce new
facade functions solely to preserve the old filename; `index.ts` is the stable
interface.

### Documents

```text
documents/
|-- index.ts
|-- model.ts
|-- queries.ts
|-- uploads.ts
|-- indexing.ts
|-- retrieval.ts
|-- retrieval-policy.ts
`-- embedding-policy.ts
```

Generic byte parsing, page extraction, text chunking, and embedding interfaces
move to platform content processing. Document-specific upload validation,
storage policy, persistence, retrieval, and organization embedding selection
remain in Documents.

### Applicability Check

```text
applicability-check/
|-- index.ts
|-- model.ts
|-- queries.ts
|-- submissions.ts
|-- guest.ts
|-- validation.ts
|-- rules.ts
`-- release/
```

The release loader and current applicability definition become implementation
of this module. Shared compliance release types remain owned by Compliance so
Compliance does not import Applicability Check.

### Gap Analysis

```text
gap-analysis/
|-- index.ts
|-- model.ts
|-- cycles.ts
|-- questionnaire.ts
|-- generation.ts
|-- contradiction-resolution.ts
|-- queries.ts
|-- progress.ts
`-- release/
```

Keep deterministic evaluation, grounded generation, and contradiction
resolution as internal clusters. Expose workflow operations, not their helper
functions.

### Action Plans and Reports

Keep their existing feature folders, but rename catch-all files according to
their behavior and restrict their `index.ts` files to supported operations.
Rendering internals and generation schemas remain private unless another module
has a demonstrated need for them.

## Implementation sequence

### Phase 0: Establish a verified baseline

1. Run type checking and the current test suite.
2. Record the current public imports used by API routes, server-rendered pages,
   scripts, and job dispatch.
3. Verify whether `src/server/questionnaires/service.ts` still has no caller.
4. Reconcile the status of
   `docs/plans/backend-schema-and-grounding-simplification.md` with the code.
   Mark it completed or list its remaining work; do not leave it as a competing
   active architecture plan.
5. Add no architectural abstraction in this phase.

Expected verification:

```powershell
npm run typecheck
npm test
```

### Phase 1: Define stable module interfaces

1. Add or tighten `index.ts` in Organizations, Documents, Applicability Check,
   Gap Analysis, Action Plans, Reports, Corpus, and Audit.
2. Update external callers to import from the relevant `index.ts`.
3. Keep module-internal imports relative and direct.
4. Stop exporting low-level document parser, chunker, embedding, and persistence
   helpers from the Documents interface.
5. Stop exporting Gap release and generation internals unless an external
   caller demonstrably needs them.
6. Preserve all existing function behavior and signatures during this phase.

Do not add compatibility wrappers. A temporary re-export is allowed only when
it enables a small, independently passing commit, and must be removed in the
same phase.

### Phase 2: Split the three catch-all implementations

Split one module at a time, with tests passing after each split.

#### Organizations

- Move organization list/detail reads to `queries.ts`.
- Move create, update, archive, and restore operations to `lifecycle.ts`.
- Move member operations to `memberships.ts`.
- Move invitation operations to `invitations.ts`.
- Keep settings and model settings in their already separate files, renaming
  only where it improves consistency.
- Fold dashboard and organization progress reads into `read-models.ts` if doing
  so removes the two shallow top-level folders without enlarging the interface
  unnecessarily.

#### Documents

- Move list/detail/source-access reads to `queries.ts`.
- Move upload-session and upload-finalization behavior to `uploads.ts`.
- Move indexing and re-embedding job handlers to `indexing.ts`.
- Keep retrieval and retrieval policy in their existing focused files.
- Keep organization-specific embedding selection near indexing; do not expose
  it as a generic platform interface.

#### Applicability Check

- Move questionnaire, overview, answer, result, and lock reads to `queries.ts`.
- Move authenticated submission behavior to `submissions.ts`.
- Move guest submit/read/claim/delete behavior to `guest.ts`.
- Keep evaluation and validation in their focused files.

Delete the old `service.ts` after all imports have moved. Do not retain it as a
permanent forwarding layer.

### Phase 3: Correct dependency direction

#### Grounding and Gap Analysis

1. Remove the grounding gateway's import of
   `gap-analysis/grounding-instruction`.
2. Let Gap Analysis and Action Plans provide their workflow-specific grounding
   and locale instructions through the existing grounded-operation input.
3. Keep provider selection, snapshot pinning, evidence retrieval, prompt
   construction, validation, and provenance behind the Grounding interface.
4. Keep workflow output schemas, prompts, query units, and operation kinds in
   their owning workflow modules.

#### Compliance and Applicability Check

1. Move shared release and NIS2 rule types into Compliance.
2. Make Applicability Check depend on Compliance release types.
3. Remove imports from Compliance back into Applicability Check.
4. Move the current applicability definition into the Applicability Check
   module and the current Gap definition into Gap Analysis.
5. Delete `src/server/definitions` after its public callers use the owning
   module interfaces.

#### Content processing

1. Move `ParsedDocument`, extracted-page, chunk input, parser, and chunker
   ownership into Content Processing.
2. Make Documents and Legal Corpus consume that interface.
3. Keep module-specific maximum sizes, MIME policies, storage buckets, and
   persistence in their owning modules.
4. Keep Docling as an external adapter at the content-processing seam if both
   native parsing and Docling remain real alternatives.

#### Job registry

1. Keep job persistence, leasing, heartbeat, cancellation, retry, and drain
   behavior in the Jobs platform module.
2. Let each business module own its payload schema, handler, result schema,
   capability requirements, and failure classification where workflow-specific.
3. Assemble the plain `jobDefinitions` object in
   `src/server/bootstrap/job-definitions.ts`.
4. Do not introduce a registration framework or runtime plugin system. The
   statically imported object is sufficient.
5. Ensure the Jobs platform module no longer imports Gap, Action Plans,
   Reports, Documents, Corpus, or their release hashes.

### Phase 4: Move stable folders into the target structure

After Phases 1-3 remove the problematic dependency directions:

1. Move business folders under `src/server/modules` one module per commit.
2. Move reusable infrastructure under `src/server/platform` one cluster per
   commit.
3. Move operator commands under `src/server/operations`.
4. Place application-wide job and maintenance wiring under
   `src/server/bootstrap`.
5. Update aliases and imports mechanically without changing behavior.
6. Delete empty legacy directories after repository search proves nothing
   imports them.

Do not combine file moves with logic changes. This phase should produce mostly
rename-only diffs.

### Phase 5: Split the Drizzle schema physically

1. Create `src/db/schema/` files grouped by table ownership.
2. Keep enums with the module that owns them; place genuinely shared enums in
   the lowest-level schema file needed by their consumers.
3. Preserve every table name, column, constraint, index, foreign key, default,
   and RLS setting exactly.
4. Make `src/db/schema.ts` re-export the complete schema so existing imports,
   tests, and Drizzle configuration continue to work.
5. Split `relations.ts` only if Drizzle's composition remains straightforward.
   At roughly 360 lines, leaving relations centralized is acceptable if a split
   adds indirection or initialization cycles.
6. Generate a disposable schema plan and verify that it contains no SQL
   changes. Any generated database change means the physical split is not
   behavior-preserving and must be corrected.

Suggested schema dependency order:

```text
organizations -> assessments/documents/jobs -> ai/legal-corpus
              -> gap-analysis -> action-plans -> reports
```

### Phase 6: Add lightweight architecture enforcement

Add one focused Vitest architecture check using Node's standard library. It
should verify:

- platform files do not import from `src/server/modules`;
- external callers do not deep-import module implementation files;
- no imports reference deleted legacy paths; and
- each business module has an `index.ts` interface.

Do not add a dependency graph package solely for this check. Keep the rules
small enough that a developer can understand and update them directly.

When touching backend tests, move them gradually into:

```text
tests/backend/
|-- architecture/
|-- organizations/
|-- applicability-check/
|-- documents/
|-- grounding/
|-- gap-analysis/
|-- action-plans/
|-- reports/
`-- jobs/
```

Do not perform a standalone move of all tests. Untouched tests can remain at
their current paths until related behavior changes.

### Phase 7: Update backend documentation

Update:

- `docs/backend-architecture/README.md`;
- `docs/backend-architecture/system/overview.md`;
- `docs/backend-architecture/system/workflows.md`;
- domain documents whose code pointers changed;
- AI and job documents for the new Grounding and job-registry ownership; and
- database documentation for the physical schema layout.

Document the dependency rules and target navigation path:

1. start at an `app/api` route or server-rendered page;
2. enter a business module through its `index.ts`;
3. follow module-local implementation files;
4. cross into platform code only for generic execution or external I/O; and
5. follow persistence into the owning `src/db/schema/` file.

## Commit strategy

Prefer small commits in this order:

1. baseline and plan-status reconciliation;
2. one module interface at a time;
3. one catch-all file split at a time;
4. one dependency inversion at a time;
5. one directory move at a time;
6. schema split with a no-op database diff;
7. architecture enforcement; and
8. documentation updates.

Each commit should typecheck and have focused tests. Avoid a single repository-
wide import rewrite that combines all modules.

## Verification

Run focused tests after each module change. At phase boundaries run:

```powershell
npm run typecheck
npm test
npm run check:i18n
npm run lint
```

After the schema split also run:

```powershell
npm run db:plan:disposable
npm run db:verify:integrity
npm run db:verify:server-only
```

The disposable schema plan must show no semantic database changes.

Before completion run:

```powershell
npm run verify
npm.cmd run build
```

Run connected database and external-provider qualifications only when their
required local services and credentials are available.

## Acceptance criteria

- Every business module has one documented `index.ts` interface.
- API routes and other external callers do not import module implementation
  files directly.
- Module-internal code uses relative imports.
- Platform code has no dependency on business modules.
- Grounding contains no Gap-specific imports.
- The generic Jobs module contains no workflow hashes or business handlers.
- Generic parsing and chunking are not owned by Documents or Legal Corpus.
- `organizations/service.ts`, `documents/service.ts`, and
  `applicability-check/service.ts` no longer exist as catch-all files.
- The obsolete Definitions and Questionnaires folders are removed after their
  responsibilities are moved or proven unused.
- `src/db/schema.ts` is a small public export over ownership-based schema files.
- The schema split produces no SQL changes and preserves default-deny RLS.
- All existing API paths and HTTP contracts remain unchanged.
- Job leasing, retries, cancellation, idempotency, and after-response execution
  retain their existing behavior.
- Existing backend tests pass, and the architecture check prevents the primary
  dependency regressions.
- Backend architecture documentation points to the new locations.

## Non-goals

- Frontend component or client reorganization.
- Changing App Router paths or HTTP contracts.
- Database normalization, migrations, or data changes.
- Replacing PostgreSQL jobs with an external queue.
- Adding microservices.
- Creating repositories for every table.
- Introducing dependency-injection containers, factories, registries beyond
  the existing static job map, or interfaces with only one implementation.
- Splitting every function into its own file.
- Moving all tests in one mechanical change.
- Rewriting business logic, prompts, compliance rules, or release content.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Large move-only diffs hide behavior changes | Separate logical changes from path moves and keep one module per commit |
| Barrels create circular dependencies | Keep internals on relative imports; reserve `index.ts` for external callers |
| Schema split changes Drizzle metadata accidentally | Require a no-op disposable schema plan and existing schema tests |
| New folders become shallow forwarding layers | Delete compatibility files within the same phase and apply the deletion test |
| Architecture rules become burdensome | Enforce only dependency direction and public-interface imports with one small standard-library test |
| Test moves destroy history | Move only tests associated with files already being changed |

## Completion condition

The work is complete when a developer can begin at a route, enter one explicit
business module interface, and understand that workflow without searching
through unrelated backend folders, while all existing behavior and database
semantics remain unchanged.
