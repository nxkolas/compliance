# Make normalized Gap Findings authoritative

Gap Finding business state will exist only in `gap_findings` and
`gap_finding_evidence`; a Gap Artifact Revision's generic JSON result will hold
only versioned revision and model-diagnostic metadata. This removes the
unconstrained dual write while retaining the flexibility of the generic
artifact revision model without introducing a Gap-specific revision subtype
table.

