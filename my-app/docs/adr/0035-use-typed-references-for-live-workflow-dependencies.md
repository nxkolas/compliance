# Use typed references for live workflow dependencies

Status: amended 2 August 2026.

Business lineage uses direct typed foreign keys owned by each use case. Small,
validated replay/result locators live directly on jobs, uploads, and idempotency
records and are resolved only after authorization. Append-only audit events keep
polymorphic entity identifiers because historical statements outlive temporary
targets.
