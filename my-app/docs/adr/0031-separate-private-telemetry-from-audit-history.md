# Separate private telemetry from audit history

Operational logs and metrics will correlate requests, jobs, AI runs, retrieval behavior, cost, failures, and worker health without recording source excerpts, prompts, signed URLs, credentials, or sensitive organization fields. This privacy-safe telemetry is separate from append-only business audit events, which record attributable domain actions rather than runtime diagnostics.
