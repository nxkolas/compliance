# Docker incident response

1. Preserve evidence: timestamp, environment, active revision/color, service
   health, alert identifiers, and request/job IDs. Never copy secrets, complete
   prompts, model responses, uploaded text, signed URLs, cookies, or personal
   data into the ticket.
2. Check external availability, Caddy, web readiness, Supabase health,
   PostgreSQL, Storage backend, queue age, LiteLLM, vLLM, GPU state, WireGuard,
   disk pressure, and backup freshness in that order.
3. Contain narrowly:
   - stop the affected release color for application faults;
   - revoke one LiteLLM application key for AI credential exposure;
   - block the WireGuard peer for suspected host compromise;
   - make the application read-only or unavailable before risking database
     corruption.
4. Recover with the preceding compatible image digest, a forward schema fix,
   or the rehearsed isolated restore. Never run `drizzle-kit push --force`.
5. Rotate exposed keys, invalidate sessions where required, validate append-only
   audit history, and preserve the legal incident record outside Loki.
6. Confirm service, persistence, queue/idempotency, Auth, signed Storage,
   retrieval, and alert recovery before closing.

For AI timeout/OOM, stop new generation claims, preserve the durable queue,
inspect DCGM/vLLM metrics, and restart only the failing inference service.
For WireGuard loss, application jobs must fail within the configured provider
timeout without exposing a public AI fallback.
