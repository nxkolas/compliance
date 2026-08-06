# Docker incident response

1. Preserve evidence: timestamp, environment, active revision/color, service
   health, alert identifiers, and request/job IDs. Never copy secrets, complete
   prompts, model responses, uploaded text, signed URLs, cookies, or personal
   data into the ticket.
2. Check external availability, Caddy, web readiness, Supabase health,
   PostgreSQL, Storage backend, queue age, the configured AI endpoint, disk
   pressure, and backup freshness in that order.
3. Contain narrowly:
   - stop the affected release color for application faults;
   - revoke the configured AI provider key for AI credential exposure;
   - make the application read-only or unavailable before risking database
     corruption.
4. Recover with the preceding compatible image digest, a forward schema fix,
   or the rehearsed isolated restore. Never run `drizzle-kit push --force`.
5. Rotate exposed keys, invalidate sessions where required, validate append-only
   audit history, and preserve the legal incident record outside Loki.
6. Confirm service, persistence, queue/idempotency, Auth, signed Storage,
   retrieval, and alert recovery before closing.

For AI timeout or outage, stop new generation claims and preserve the durable
queue. Application jobs must fail within the configured provider timeout rather
than silently falling back to another endpoint.
