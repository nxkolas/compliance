# Legal Corpus Quality, Coverage, Freshness, and Documentation

Status: proposed implementation plan based on the repository and configured
database audit performed on 2026-07-28.

This is a follow-on plan to
`docs/plans/done/authoritative-legal-corpus-and-grounded-ai.md`. The underlying
versioned corpus, Grounding Gateway, processing worker, release pinning, and
administrative API already exist. This plan closes the remaining source
coverage, operational freshness, ingestion usability, evaluation, and
documentation gaps.

## Outcome

Deliver a corpus that is:

1. sufficient for the current Germany-focused NIS2 applicability and Gap
   Analysis scope;
2. bilingual where official German and English legal renditions exist;
3. selectively extended with official guidance and entity-specific law without
   applying specialized requirements to the wrong organizations;
4. actively monitored for upstream changes without silently changing existing
   assessments;
5. evaluated with real corpus retrieval cases rather than synthetic validation
   fixtures alone; and
6. documented for product, engineering, and operations audiences.

The target is not a general legal search engine. Source discovery remains a
human decision, crawling remains out of scope, and deterministic applicability
logic remains separate from AI retrieval.

## Audited Baseline

The configured database contained:

| Item | Baseline |
| --- | --- |
| Active corpus families | `nis2-eu-primary`, `nis2-de-primary` |
| Active legal sources | 2, both `primary_authority` |
| NIS2 Directive | Official English PDF, 73 pages, 337 chunks |
| German BSIG | Official German PDF, 54 pages, 243 chunks |
| Embedding coverage | 580 of 580 chunks |
| Reliable page-anchor coverage | 100 percent |
| Mapped legal provisions | 32 |
| Gap question-to-provision mappings | 77 |
| Corpus release evaluation | Passed for both families |
| Active URL monitors | 0 |
| Open change alerts | 0 |
| Active Gap release | `nis2-gap/reliability-v1` |
| Active Compliance release | `nis2_applicability/2026-v2` |

The current core is authoritative and traceable, but narrow. It is a suitable
minimum primary-law base for the current ten generic Gap requirements, not a
complete NIS2 implementation or sector-advice corpus.

## Confirmed Problems

### Source and language coverage

- The EU primary family contains only the English official rendition of
  Directive (EU) 2022/2555.
- No official-guidance family is pinned by the current Grounding policy.
- Commission Implementing Regulation (EU) 2024/2690 is absent, so covered
  digital providers do not receive its more specific technical and incident
  significance requirements.
- Sector overlays such as DORA, telecommunications, energy, and KRITIS rules
  are not represented in legal retrieval.
- The current corpus release member primary key permits only one rendition per
  source version in a release, which blocks the clean publication of multiple
  official language renditions of the same legal version.

### Freshness and operations

- No live source monitor is configured.
- The German source version label is `current-at-import-de` rather than a
  legally meaningful edition label.
- `upstream_published_at` is empty for both current source versions.
- Monitoring can detect a changed exact URL, but adoption still requires an
  operator to create and approve a candidate. This manual adoption boundary is
  intentional and must remain.
- Activating a new corpus release does not change an already published Gap or
  Compliance release. A new workflow release must pin the new corpus release.

### Evaluation

- `grounding-safety-v2` primarily validates citation and channel rules against
  constructed in-memory context.
- Its reported retrieval recall and precision do not execute real hybrid
  retrieval against the published corpus.
- Corpus evaluation can pass with zero provision-anchor coverage.
- The Gap requirement verification command is hard-coded to the older
  `guided-v6` release and fails when `reliability-v1` is active.

## Scope

### Included

- corpus documentation and a reproducible baseline report;
- official German NIS2 rendition;
- official BSI guidance;
- conditionally applicable Commission Implementing Regulation (EU) 2024/2690;
- multiple official renditions per source version;
- configured source monitoring and freshness reporting;
- real retrieval and provision-coverage evaluation;
- repair of release-agnostic verification commands; and
- staged publication and workflow repinning.

### Deferred

- autonomous web discovery or crawling;
- a new Platform Administrator corpus interface, including upload and
  URL-import UI;
- static HTML ingestion or changes to the currently supported direct-file URL
  formats;
- malware-scanning work;
- OCR or scanned-PDF processing improvements; scanned legal PDFs remain
  non-reviewable when reliable anchors cannot be extracted;
- authenticated or JavaScript-rendered website capture;
- ingestion from email, cloud drives, or third-party knowledge bases;
- general legal advice outside the supported framework and jurisdiction;
- broad secondary commentary;
- automatic publication or activation after an upstream change;
- a second national NIS2 profile; and
- sector overlays that the product does not yet evaluate or explain.

## Target Source Portfolio

### Primary sources required for the next release

1. Keep the official German BSIG PDF in `nis2-de-primary`.
2. Keep the official English Directive (EU) 2022/2555 rendition in
   `nis2-eu-primary`.
3. Add the official German rendition of Directive (EU) 2022/2555 to the same
   source version and corpus release.

### Official guidance required for the next release

Create `nis2-de-guidance` with Authority Tier `official_guidance` and add only
current BSI material:

- downloadable current NIS2 registration and incident-reporting instructions,
  when BSI provides them in an already supported direct-file format;
- the current BSI NIS2 risk-analysis guidance; and
- the current BSI applicability decision tree.

Do not import archived BSI FAQ content based on superseded draft legislation.
HTML-only operational pages remain documentation links rather than corpus
members.
Each guidance source needs an exact official URL, edition or retrieval date,
language, monitor schedule, and an operator-recorded scope note.

### Conditional primary source

Create `nis2-eu-digital-implementing` for Commission Implementing Regulation
(EU) 2024/2690 with official German and English renditions.

This family is conditional. It may be retrieved only when the pinned
applicability result contains one of the entity identities covered by the
regulation, including the relevant DNS, TLD, cloud, data-centre, CDN,
managed-service, managed-security, online-platform, search, social-network, or
trust-service identities.

The regulation must not be added to the unconditional generic NIS2 context.

### Later sector additions

Add DORA, EnWG/TKG, BSI-KritisV, or sector-specific BSI standards only with a
product change that defines:

- the affected entity identities;
- which NIS2 duties are replaced, redirected, or supplemented;
- the retrieval precedence rule;
- the deterministic applicability input;
- conflict behavior; and
- acceptance fixtures.

## Target Corpus Flow

```text
Platform Administrator selects an official source
  -> creates or selects the corpus family and source identity
  -> uses the existing API/operator path to upload a supported file
     or submit an exact HTTPS direct-file URL
  -> trusted worker stores immutable bytes and retrieval metadata
  -> parse the supported digital document
  -> chunk and embed
  -> inspect extraction, anchors, and metadata
  -> explicit human review
  -> assemble a draft corpus release
  -> validate and publish
  -> run real retrieval and safety evaluation
  -> activate the evaluated corpus release
  -> publish a new Gap/Compliance release that pins it
  -> new assessments use the new pins

Existing assessments retain their original workflow and corpus releases.
```

## Documentation Deliverables

Documentation is a first-class implementation workstream, not a final cleanup
task.

### Canonical engineering guide

Create `docs/ai/legal-corpus.md` with:

- what the legal corpus is and is not;
- the distinction between deterministic legal definitions, shared legal
  corpus, and Organization Evidence;
- the current supported framework and jurisdiction;
- the source-family and Authority Tier model;
- source, version, rendition, processing generation, chunk, embedding, release,
  activation, and workflow-pin concepts;
- the complete upload and URL-import pipeline;
- how hybrid retrieval, provision mappings, language selection, and citations
  work;
- why old assessments do not change when a source changes;
- current direct-file, size, MIME, and scanned-PDF limitations;
- monitoring and human-adoption behavior;
- security and external-model disclosure boundaries;
- the current source register and last verification date;
- known limitations and deferred capabilities; and
- links to the operator runbook, product scope, ADRs, and relevant commands.

This guide should contain a compact architecture flow and a table similar to
the audited baseline above. Dynamic counts must be labelled with a verification
date and regeneration command.

### Operator runbook

Create `docs/runbooks/legal-corpus-operations.md` with exact procedures for:

- creating a family and source;
- uploading a simple PDF;
- importing a direct file URL;
- inspecting processing metrics and chunk anchors;
- handling parser and embedding failures;
- reviewing a processing generation;
- assembling, publishing, evaluating, and activating a corpus release;
- publishing and activating the dependent Gap/Compliance release;
- creating, pausing, and resuming monitors;
- resolving change alerts as dismissed or candidate-created;
- withdrawing a bad source or release without breaking historical citations;
- performing an emergency activation override;
- checking queue state, source freshness, and audit history; and
- rolling back through a new forward release rather than mutating history.

Every state-changing example must identify the required capability and audit
event. The runbook must clearly state that monitor detection is not automatic
legal adoption.

### Product-facing scope document

Create `docs/product/legal-corpus-scope.md` in plain language with:

- what sources currently ground AI output;
- countries and frameworks covered;
- the difference between legal requirements and customer-uploaded evidence;
- what the AI can and cannot conclude;
- language availability;
- how often sources are checked;
- how updates are reviewed and released;
- why an older report may cite an older legal edition; and
- a dated source list with official upstream links.

This document must avoid implying legal completeness or legal advice.

### Reproducible corpus report

Add `scripts/report-legal-corpus.ts` and an npm script
`db:report:legal-corpus`.

The command must be read-only and return a safe Markdown or JSON report with:

- family, source, version, language, tier, and release status;
- upstream and effective dates;
- retrieval date and monitor freshness;
- page, chunk, embedding, and anchor counts;
- mapped provision count;
- evaluation version and result;
- active workflow pins; and
- open alerts and failed jobs.

It must never print storage paths, signed URLs, credentials, source text, or
private Organization Evidence. Add a snapshot test for the safe output shape.

### Documentation indexes

Link the new documents from:

- `docs/ai/README.md`;
- `docs/product/README.md`;
- the runbook index or `infra/README.md`, whichever is the repository's
  canonical operational entry point; and
- `docs/architecture/README.md` when the guide includes the canonical corpus
  dependency flow.

## Implementation Plan

Each numbered item is intended to be a small commit that leaves the repository
working.

### Phase 0: Record and protect the baseline

1. Add a database-backed characterization test for the safe corpus report
   query shape.
2. Implement `db:report:legal-corpus` without changing corpus state.
3. Capture `docs/qa/legal-corpus-baseline-2026-07-28.md` from the report and
   include the test evidence used in this audit.
4. Create the first version of `docs/ai/legal-corpus.md` describing current
   behavior and limitations, not the unimplemented target.
5. Create the initial operator runbook for the existing API/operator-command
   workflow.
6. Create the product-facing scope document and link the three documents from
   their indexes.
7. Replace hard-coded `guided-v6` assertions in
   `verify-gap-requirement-dictionary.ts` with release-reference or active-
   release assertions that understand `reliability-v1`.
8. Add a test proving the verifier accepts the active release contracts and
   still rejects incomplete mapped authority.

### Phase 1: Support multiple official language renditions

9. Change legal corpus release-member identity so one source version may
   include more than one rendition while each exact rendition/generation pair
   remains unique.
10. Update Drizzle constraints, relations, release hashing, member replacement,
    release reads, and integrity SQL for multilingual members.
11. Add migration and clean-bootstrap tests for the new release-member key.
12. Add release validation tests for two official renditions of one source
    version and rejection of duplicate rendition members.
13. Add retrieval tests proving locale preference selects German for German
    output and English for English output without duplicate context.
14. Add the official German Directive rendition to the existing NIS2 source
    version, process it, review it, and bind its required provisions.
15. Publish and evaluate a new `nis2-eu-primary` release containing both
    official renditions.
16. Update the engineering and product corpus source tables from the safe
    report.

### Phase 2: Add official German guidance

17. Create the `nis2-de-guidance` family and the first three BSI source
    identities.
18. Record stable version labels, official upstream URLs, publication or
    retrieval dates, language, and scope notes for every guidance source.
19. Import, process, inspect, and review the guidance sources.
20. Add provision or topic mappings where a stable legal provision exists;
    never represent guidance as primary authority.
21. Extend the Gap Grounding policy with the new required guidance family and
    preserve the independent guidance quota.
22. Add conflict tests proving BSIG primary law outranks conflicting guidance
    while both remain visible for review.
23. Publish, evaluate, and activate the first guidance release.
24. Update the source register, product scope, and operator examples.

### Phase 3: Add conditional entity-specific law

25. Add a policy model for base corpus families and conditional corpus
    families keyed by stable applicability entity codes.
26. Make the Gap publisher pin both base and conditional releases while the
    runtime resolves only the subset applicable to the assessment.
27. Persist the conditional-family decision in AI run provenance and retrieval
    diagnostics.
28. Add fail-closed behavior when an applicable conditional family is missing,
    unpublished, unevaluated, or not pinned.
29. Create `nis2-eu-digital-implementing`.
30. Import official German and English renditions of Regulation (EU) 2024/2690.
31. Map relevant regulation provisions to covered entity identities and Gap
    questions.
32. Add positive retrieval fixtures for covered digital providers.
33. Add negative fixtures proving unrelated organizations never receive
    Regulation 2024/2690 context.
34. Publish, evaluate, and activate the conditional family release.
35. Update corpus, product-scope, and framework-extension documentation.

### Phase 4: Turn on source freshness monitoring

36. Configure monitors through the existing API/operator path for the BSIG,
    both Directive renditions, all BSI
    guidance sources, and Regulation 2024/2690 renditions.
37. Add first-check baseline time, last successful check, next check,
    consecutive failures, final URL, ETag/last-modified availability, and
    current alert state to the safe corpus report and operator queries.
38. Add a freshness policy by source kind, for example weekly for current-law
    and operational-guidance URLs and monthly for immutable Official Journal
    files.
39. Add stale and failed-monitor health checks without making application
    readiness depend on an upstream website.
40. Add operator alerts for overdue checks, repeated failures, redirects,
    MIME changes, and content changes.
41. Add a candidate-diff summary based on hashes and normalized extracted text;
    never let a diff publish automatically.
42. Require updated edition/effective metadata or a recorded no-change reason
    before candidate review.
43. Add freshness status to the safe report and product source register.

### Phase 5: Replace synthetic retrieval scores with corpus evaluations

44. Define versioned real-query fixture manifests per family with query text,
    locale, as-of date, expected source/provision, forbidden source/provision,
    minimum rank, and applicability context.
45. Add direct provision, paraphrase, German/English, effective-date,
    conditional-family, conflict, and abstention cases.
46. Execute the real retrieval path against the candidate release and its
    recorded embedding configuration.
47. Measure recall at k, precision at k, reciprocal rank, required-provision
    coverage, language preference, forbidden-context rate, and latency.
48. Keep the existing citation, prompt-injection, claim-support, channel,
    translation, and tenant-isolation fixtures as a separate safety category.
49. Stop labelling constructed-context tests as retrieval recall or precision.
50. Make corpus activation require the family-specific real-query thresholds.
51. Make Gap release publication require complete mapped primary-authority
    coverage for all published question-to-provision mappings.
52. Require non-zero expected provision coverage for every primary family
    manifest.
53. Persist evaluation manifest version, embedding identity, results, failures,
    and duration.
54. Add a controlled emergency override test and operator-runbook procedure.

### Phase 6: Publish and cut over

55. Produce new evaluated releases for all required and conditional families.
56. Run the safe corpus report and manually review its source, language,
    freshness, coverage, and evaluation sections.
57. Publish a new Compliance release that pins the required corpus releases.
58. Publish a new Gap release that pins base and conditional corpus releases.
59. Run Germany applicability, generic Gap, covered-digital Gap, unrelated-
    entity exclusion, citation-link, and historical-assessment smoke tests.
60. Activate the new workflow releases only after smoke and retrieval
    evaluations pass.
61. Verify that an assessment created before activation still resolves its old
    corpus and citations.
62. Update all three corpus documents and the dated QA evidence.

## Testing Strategy

### Unit tests

- multilingual release-member validation and hashing;
- base and conditional family resolution;
- locale preference and duplicate-context suppression;
- monitor freshness calculation;
- safe corpus report redaction; and
- real retrieval metric calculation.

### Integration tests

- two official renditions of one source version publish in one release;
- candidate release retrieval uses only its exact members and embedding model;
- official guidance cannot solely support a binding claim;
- Regulation 2024/2690 is included only for covered entity identities;
- monitor changes create alerts but never mutate published content;
- candidate adoption creates a new version and release;
- corpus activation alone does not change an active workflow pin;
- Gap publication rejects incomplete mapped authority; and
- real retrieval evaluation gates activation.

### Workflow and end-to-end tests

- release assembly supports German and English renditions;
- a configured monitor establishes a baseline and later creates a resolvable
  change alert;
- a candidate can be reviewed and released without altering old reports;
- covered and unrelated organizations receive the correct conditional-family
  behavior; and
- a historical assessment retains its original corpus pins after cutover.

## Acceptance Criteria

- The canonical engineering, operator, and product corpus documents exist,
  are indexed, and accurately describe the implemented system.
- `db:report:legal-corpus` reproduces the documented source inventory without
  leaking secrets or source content.
- The current NIS2 Directive is available in official German and English
  renditions.
- Current BSI guidance is represented as official guidance and cannot override
  primary authority.
- Regulation (EU) 2024/2690 is retrieved for covered entity identities and
  excluded for every unrelated identity fixture.
- Every active source has an appropriate monitor or a documented immutable-
  source exception.
- Monitor failures and content changes are visible, but no monitor can publish
  or activate content.
- Corpus evaluation performs real hybrid retrieval and meets versioned
  family-specific thresholds.
- Every mapped Gap provision resolves to an official primary-authority chunk in
  the pinned corpus release.
- New workflow releases pin the new corpus releases while historical
  assessments remain reproducible.
- Lint, typecheck, tests, i18n, production build, database integrity,
  clean-bootstrap qualification, and Docker acceptance pass.

## Rollout

1. Ship documentation, reporting, and verifier repair first.
2. Ship the multilingual release-member migration before adding the German
   Directive rendition.
3. Add and evaluate the German Directive and BSI guidance without changing the
   active workflow.
4. Ship conditional-family policy before importing Regulation 2024/2690 into a
   workflow-visible family.
5. Configure monitors and observe at least one successful check for every
   mutable source URL.
6. Run real retrieval evaluations against candidate releases.
7. Publish and activate new corpus releases.
8. Publish and activate new Compliance and Gap releases that pin them.
9. Monitor retrieval failures, missing mapped authority, alert age, monitor
    failures, processing failures, citation access, and AI abstention rate.

## Rollback

- Do not edit or delete a published corpus release.
- Withdraw a bad release with a reason and activate the previous evaluated
  release for authoring.
- If a workflow release already pins the bad corpus, publish a new workflow
  release with corrected pins; do not mutate the existing release.
- Keep old bytes, source versions, processing generations, chunks, embeddings,
  AI context, and citations available for historical inspection.
- Disable a failing monitor or parser capability without disabling historical
  retrieval.
- Roll back additive code while leaving compatible multilingual and reporting
  schema in place; use a forward migration for schema corrections.
- Use an emergency override only when the recorded business impact justifies
  failed evaluation, and replace it with a normally evaluated release as soon
  as possible.

## Completion Evidence

The implementation is complete only when the repository contains:

- the three indexed corpus documents;
- a safe dated corpus baseline generated by the report command;
- migration and integrity evidence for multilingual release members;
- source manifests and official upstream links;
- monitor check evidence for mutable sources;
- versioned real-query evaluation results;
- Gap mapped-authority verification;
- historical pin reproducibility evidence; and
- full application and Docker acceptance results.
