# Limit expensive backend operations

Uploads, AI generations, retries, reports, and polling will enforce configurable per-user and per-organization quotas plus domain-level single-flight and worker-concurrency limits. Rejected work returns a stable rate-limit error with retry guidance, and usage visibility is restricted to Platform Administrators.
