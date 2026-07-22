# Standardize job status and cancellation

Asynchronous feature commands will return a common authorized job reference that clients poll for state, progress, attempts, safe errors, timestamps, and result linkage. Authorized users may cancel queued work and request best-effort cancellation at safe checkpoints for running work, while corpus jobs remain Platform Administrator-only and cancellation never deletes inputs, attempts, cost, or audit provenance.
