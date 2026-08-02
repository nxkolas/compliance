# End-to-end compliance workflow

Status: current simplified workflow as of 2 August 2026.

1. The deployed build loads the applicability questionnaire and deterministic
   Germany/EU rules from code. Submission creates an immutable assessment and
   applicability output revision. Non-German jurisdiction is explicitly
   unsupported and cannot unlock Gap Analysis.
2. An eligible organization opens one unfinished Gap cycle. Answers remain
   mutable JSON until leaving the question stage, when an immutable localized
   assessment revision is created. Optional indexed document versions are
   selected and then locked for generation.
3. A `gap_analysis` job records provider/model and input/claim provenance,
   creates normalized findings and atomic gaps, and atomically advances the Gap
   output pointer. Successful cycles remain history; a new cycle may be opened
   until the Action Plan exists. Prefill is allowed only for the same definition
   hash.
4. Missing or weak documents do not block. An unresolved material direct
   contradiction does. The user chooses only “trust questionnaire” or “trust
   document.” A conflict-resolution job creates a new immutable current Gap
   revision with exact citation, actor/time, and original finding/revision
   lineage. Document-authoritative resolution regenerates that finding only
   from the stored conflicting excerpts.
5. An Owner may create the organization’s single Action Plan from the current,
   compatible, unblocked Gap revision. Generated plan/item content is immutable;
   item status is last-write-wins `open`, `in_progress`, or `done`, with an audit
   event per change. Later Gap history can make the plan outdated but cannot
   replace it.
6. A report pins one applicability revision, one Gap revision, optional Action
   Plan, selected document versions, rendering job, and final PDF locator.
   Readiness/failure is derived from the job and complete PDF metadata.

Supporting flows use the same narrow model: guest results are copied then
deleted on claim, documents keep immutable version/index history, organization
archive preserves all history while blocking ordinary writes, and cleanup jobs
physically remove expired invitations, guest checks, uploads, idempotency rows,
and rate-limit windows.

Legal text is evidence rather than executable configuration. Operators create
immutable legal source/version/rendition/processing history, workers produce
chunks and embeddings, reviewers bind stable provision keys to exact chunks,
and `db:activate:legal-snapshot` validates successful lineage before atomically
advancing a corpus-family snapshot pointer and appending a platform audit event.
