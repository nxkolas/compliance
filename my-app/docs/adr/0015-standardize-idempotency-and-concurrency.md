# Standardize idempotency and concurrency

Status: amended 2 August 2026.

Costly and create-once internal commands require an idempotency key and replay a
small typed locator only after reauthorizing the caller and reloading the target.
Per-resource version/lock columns are not mandatory. Current mutable status
updates are last-write-wins; any future lost-update protection must be designed
consistently at the API boundary, for example with ETags.
