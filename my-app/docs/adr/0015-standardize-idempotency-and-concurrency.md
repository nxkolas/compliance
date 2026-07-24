# Standardize idempotency and optimistic concurrency

Costly or create-once internal API commands will require an idempotency key and replay the stored result only when the key and request fingerprint match. Shared mutable resources expose version tokens and require conditional updates, rejecting stale writes instead of silently overwriting newer organization, draft, plan, corpus, or publication state.
