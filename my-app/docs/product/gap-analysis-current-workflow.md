# Current Gap-Analysis Workflow

Status: single organization lifecycle, compact finding sources, and positive
applicability eligibility guard implemented on 2026-07-25.

Each organization can generate one AI Gap Analysis and one action plan:

```text
answer questions
  -> select optional documents
  -> review exact inputs
  -> generate Gap Analysis
  -> manually correct findings
  -> generate action plan
  -> Gap Analysis permanently locked
```

## Before generation

The organization must have an approved applicability result compatible with
the active Gap release and its parsed outcome must be `essential_entity` or
`important_entity`. Approval records successful deterministic evaluation; it
does not by itself establish Gap eligibility.

The Gap page remains visible when this prerequisite is blocked. It shows a
reason-specific explanation for a missing result, unsupported country, other
clarification, not-directly-in-scope result, or release/status failure. It
offers only applicability-related navigation and exposes no start, prepare,
generate, or retry action. Direct service and worker calls independently
enforce the same policy.

For an eligible organization, contributors complete a numbered four-step
wizard:

1. **Answer questions**
2. **Select documents**
3. **Review information**
4. **Gap Analysis results**

Step circles always display their number. Documents are optional. Answers and
document selection remain editable until generation succeeds. While a
generation job is active, the reviewed inputs are frozen. Failed or cancelled
jobs return to editable inputs and may be retried.

Before enqueue and again in the worker, the service validates the pinned
positive outcome and requires at least one applicable requirement. These
guards run before a background job, draft lock, or AI processing run is
created.

The first generation uses an immutable assessment revision and the exact
selected document versions. Every mutation route checks that no successful
Gap revision exists; direct calls cannot start a second generation.

## After generation

The wizard is replaced by two addressable views:

- `?view=results` — **Gap Analysis results**, the default;
- `?view=inputs` — **Inputs used**, the exact pinned questionnaire and document
  snapshot.

The input view reads the `assessment_revision` and `document_version` sources
of the current Gap revision. Later questionnaire changes, document versions,
or document archival do not rewrite the displayed snapshot. An empty document
selection has an explicit empty state.

Owners and administrators may manually correct findings while no action plan
exists. Members and auditors retain their read-only permissions. A correction
creates a complete immutable child revision and copies its pinned input and
evidence sources.

Findings and citations are authoritative normalized rows. The generated
revision's JSON contains only locale, diagnostics, and correction metadata; it
never contains a second findings payload. Assessment, artifact, and document
lineage use typed foreign-key tables, so a source cannot silently point at the
wrong kind of record or owner.

Finding status and document support are independent. `fulfilled` is valid
without an organization document. **No document provided** is displayed with
an accessible amber warning icon and does not block finalization or create an
action-plan item.

Every result card has an always-visible **Sources** footer. It deduplicates
questionnaire support, exact organization document versions, and legal-source
versions, shows three sources before an inline `+N` expansion, and has an
explicit empty state. Organization documents open through an authorized,
short-lived same-origin access route; cited PDFs open on the first cited page.
Official HTTP(S) legal URLs open upstream, while missing or unsafe URLs remain
visible as unavailable sources. Questionnaire support is displayed as the
non-link **Your information** source.

The result-card projection is an explicit allowlist. Full excerpts, citation
IDs, assumptions, requirement codes, contradiction diagnostics, storage
coordinates, and revision-result JSON remain server-side for generation,
review, and audit behavior. They are not sent in the current workflow or the
customer-accessible historical revision response.

The `guided-v3` prompt asks the model to explain interpreted disagreements
between its status and questionnaire assertions in
`questionnaireDisagreements`. The UI presents a neutral, non-blocking
disagreement indicator without returning the raw diagnostic strings. Genuine
contradictions still use `contradictions` and `requiresReview` server-side. A
manual correction suppresses stale AI disagreement metadata for that finding.

## Atomic action-plan boundary

Editable results expose one **Generate action plan** action. Its confirmation
dialog explains that the command confirms the current Gap Analysis, creates
one fixed measure set, and permanently locks the Gap Analysis.

The server command locks the organization's Gap artifact and, in one database
transaction:

1. validates the current pinned revision, sources, coverage, citations, and
   review blockers;
2. approves and accepts the Gap revision;
3. creates the organization's only active action plan;
4. creates items for all non-fulfilled findings; and
5. writes Gap-approval and plan-generation audit events.

Any failure rolls the entire transaction back. Concurrent correction and
finalization requests serialize on the same artifact row. The standalone Gap
approval endpoint is rejected, and a second plan returns
`ACTION_PLAN_ALREADY_EXISTS`.

After plan creation, results and inputs remain readable, correction controls
are absent, and the page explains that plan generation locked the analysis.
Server routes independently reject later questionnaire, evidence, generation,
correction, and standalone approval requests.

## Action plan and Documents hub

The action plan contains one fixed generated measure set. Status, assignee,
deadline, and supported execution notes remain editable with optimistic
concurrency and audit history. There is no reconciliation, refresh, or
replacement-plan route.

The Documents page is a generic hub for upload, search, processing/indexing
status, versions, and archive visibility. It does not load Gap workflow state
or display Gap selection, reassessment, result-usage, or action-plan-usage
controls. The pre-generation Gap document step remains a separate consumer of
eligible current document versions.

## Release publication and activation

The immutable single-lifecycle prompt is registered as
`nis2-gap/guided-v3`. For a reviewed non-production environment:

```text
npm run db:publish:gap -- nis2-gap/guided-v3
npm run db:activate:gap -- nis2-gap/guided-v3
```

Production publication and activation use the reviewed deployment procedure.
The earlier `guided-v2` contract remains immutable for historical results.

## Verification

```text
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run build
```

Database-backed smoke QA additionally requires configured Supabase, worker,
AI-provider, and corpus-release credentials.

The automated acceptance path is:

```text
REMEDIATION_SMOKE_USER_ID=<active-admin-uuid> npm run db:smoke:authenticated-gap
npm run db:smoke:country-support
npx tsx scripts/benchmark-gap-workflow.ts --organization-id <uuid> --user-id <uuid> --samples 3 --assert
```
