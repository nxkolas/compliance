# End-to-end compliance workflow

Status: current simplified workflow as of 2 August 2026.

1. The deployed build loads the applicability questionnaire and deterministic
   Germany/EU rules from code. Submission creates an immutable assessment and
   applicability output revision. Non-German jurisdiction is explicitly
   unsupported and cannot unlock Gap Analysis.
2. An eligible organization opens one unfinished Gap cycle. Answers remain
   mutable JSON until leaving the question stage, when an immutable localized
   assessment revision is created. Optional current, indexed document versions
   are selected and locked for generation; archived documents are excluded.
3. The Gap worker pins the current legal snapshots, retrieves legal and selected
   organization evidence, invokes the configured provider, validates grounded
   output, and stages exact admitted context. One transaction publishes the
   normalized findings, atomic gaps, context links, immutable output revision,
   successful AI-run state, and current pointers. Successful cycles remain
   navigable history.
4. Missing or weak documents do not block. An unresolved material direct
   contradiction does. The user chooses only “trust questionnaire” or “trust
   document.” A conflict-resolution job creates a new immutable current Gap
   revision with exact citation, actor/time, and original finding/revision
   lineage. Document-authoritative resolution regenerates that finding only
   from the stored conflicting excerpts.
5. An Owner may create the organization’s single Action Plan from the current,
   compatible, unblocked Gap revision. A distinct grounded provider operation
   generates one or more actions per category with complete many-to-many Gap
   coverage. Plan, item/link, AI-run, and audit publication is atomic. Later Gap
   history can make the plan outdated but cannot replace it.
6. A report pins one applicability revision, one Gap revision, an optional
   Action Plan, selected document versions, rendering job, and final PDF
   locator. The PDF renders the pinned answers, applicability outcome, findings,
   atomic gaps, exact cited excerpts, and Action Plan items.

Supporting flows use the same narrow model: guest results are copied then
deleted on claim, documents keep immutable version/index history, organization
archive preserves all history while blocking ordinary writes, and cleanup jobs
remove expired invitations, guest checks, uploads, idempotency rows, rate-limit
windows, and old unreferenced terminal jobs.

Legal text is evidence rather than executable configuration. Operators use
`db:provision:legal-corpus` to create immutable source, version, rendition, and
processing lineage. Workers produce chunks and embeddings, reviewers bind
stable provision keys to exact chunks, and `db:activate:legal-snapshot`
validates successful lineage before atomically advancing a corpus-family
snapshot pointer and appending a platform audit event.
