# End-to-end compliance workflow

Status: current simplified workflow as of 2 August 2026.

1. The deployed build loads the applicability questionnaire and deterministic
   Germany/EU rules from code. Submission creates an immutable assessment and
   applicability output revision. Unsupported jurisdictions cannot unlock Gap.
2. An eligible organization opens one unfinished Gap cycle. Leaving the
   question stage creates an immutable localized assessment revision. Optional
   current, indexed document versions are selected and locked; archived
   documents are excluded.
3. The Gap worker pins current legal snapshots, retrieves legal and selected
   organization evidence, invokes the provider through the current contract,
   and validates strict grounded output. One transaction publishes normalized
   findings, atomic gaps, exact evidence links, the immutable output revision,
   successful AI-run state, and current pointers.
4. Missing or weak evidence does not block. A material direct contradiction
   identifies the exact organization citation IDs involved. “Trust
   questionnaire” rejects only those `conflicting` links. “Trust document”
   regenerates one finding from only those exact excerpts. Either choice creates
   a new immutable Gap revision with actor/time, original lineage, source
   choice, and exact resolution citations; unrelated `supporting` links remain.
5. An Owner may create the organization's single Action Plan from the current,
   compatible, unblocked Gap revision. A distinct grounded provider operation
   creates complete category-scoped many-to-many Gap coverage. AI-run creation
   and final publication both require the executing worker's exact live lease;
   plan, items, links, audit, and job success publish atomically.
6. A report pins one applicability revision and optionally a current Gap
   revision, Action Plan, and selected document versions. An applicability-only
   report identifies its reduced scope and omits Gap and Action Plan sections.
   The successful attempt captures
   one explicit render snapshot including current Action Plan item statuses,
   hashes and renders that same in-memory object, uploads to the deterministic
   report key, and atomically commits the hash with all PDF metadata. Completed
   reports are immutable.

Legal text is evidence rather than executable configuration. Operators create
source/version/rendition/processing lineage from a reviewed manifest, workers
produce chunks and embeddings, reviewers bind stable provision keys to exact
chunks, validation proves completeness and citation resolvability, and only
then activation advances the immutable family snapshot pointer.

Executable Gap and Action Plan behavior is code-owned behind current-contract
boundaries. Definition and exact-prompt hashes provide staleness and provenance;
there is no database publication or activation control plane for executable
definitions.
