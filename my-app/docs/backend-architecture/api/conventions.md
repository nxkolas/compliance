# API Conventions

> Status: current as of 3 September 2026.

All HTTP routes live under `app/api/` and are thin. They authenticate,
validate, enforce limits, and dispatch to a server service in
`src/server/<domain>/`. The shared machinery lives in `src/server/platform/http/`.

## Route handlers

Most routes are declared as exported constants built with `apiRoute(...)`
(`src/server/platform/http/handler.ts`). The wrapper:

- resolves a request ID;
- validates route parameters (any `*Id` param must match the entity ID
  schema);
- calls the handler and serializes the result into the standard envelope;
- maps errors to the error envelope;
- schedules an after-response job drain whenever a handler returns `202`;
- logs method, path, status, and duration per request.

## Envelope

Success:

```json
{
  "data": { },
  "meta": { "requestId": "..." }
}
```

`meta` may also carry `nextCursor` (pagination) or `version`.

Error:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "...",
    "details": {},
    "requestId": "..."
  }
}
```

Every response carries an `x-request-id` header. An inbound
`x-request-id` is accepted if it matches the schema; otherwise a UUID is
generated (`src/server/platform/http/request-id.ts`).

Health endpoints intentionally return bare health payloads. Authorized
document download and source-access endpoints return redirects rather than a
JSON envelope. The guest applicability routes construct the same envelope
directly because they also manage a guest-session cookie.

## Authentication and authorization

- Every protected route calls `requireApiUser()` (`src/server/platform/http/auth.ts`),
  which resolves the Supabase session server-side and returns the
  authenticated actor, or throws `401`.
- Capabilities are role-based. Organization-scoped operations use
  `authorizeOrganizationRead` / `withAuthorizedOrganizationCommand`
  (`src/server/platform/auth/organization-scope.ts`), which pin the organization
  predicate through the whole query or transaction.
- The organization ID in the URL is never authority; it is always re-checked
  against the actor's membership.

## Validation

- Bodies are read and parsed with Zod via `readJsonBody` /
  `readOptionalJsonBody` (`src/server/platform/http/request.ts`). Invalid input throws
  `400` with the Zod issues as `details`.
- The default JSON body ceiling is 8 MB; routes that legitimately move more
  data (relayed embedding results) pass an explicit larger cap.
- Route parameter entity IDs are validated by the wrapper.

## Error codes

`ApiError` (`src/server/platform/http/errors.ts`) maps status codes to stable codes:

| Status | Default code |
| --- | --- |
| 400 | `INVALID_REQUEST` |
| 401 | `AUTHENTICATION_REQUIRED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 410 | `GONE` |
| 412 / 428 | `PRECONDITION_FAILED` / `PRECONDITION_REQUIRED` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `UNPROCESSABLE_CONTENT` |
| 429 | `RATE_LIMITED` (with `retry-after` header) |
| 502 / 503 | `UPSTREAM_ERROR` / `SERVICE_UNAVAILABLE` |
| 5xx other | `INTERNAL_ERROR` |

Routes may throw `ApiError` with a domain-specific code (e.g.,
`GAP_REASSESSMENT_PREPARE_FAILED`).

## Idempotency

Retryable commands require an `Idempotency-Key` header
(`src/server/platform/http/idempotency.ts`):

- The first request creates an `in_progress` claim in
  `idempotency_records` (fingerprinted by actor, scope, operation, key, and
  request hash).
- A concurrent duplicate races to `409`.
- A completed claim replays the stored result; a failed claim can be retried.

Result locators are typed (e.g., `analysis_output_revision`,
`background_job`, `report`) so the replay returns the same resource.

## Rate limiting

Two layers exist:

- `enforceRateLimit` (`src/server/platform/http/rate-limit.ts`): fixed-window counter
  against a store (durable PostgreSQL windows in
  `api_rate_limit_windows`).
- `enforceOperationRateLimit` (`src/server/platform/http/operation-rate-limit.ts`):
  named operation policies:

| Operation | Limit |
| --- | --- |
| `uploads:create` / `uploads:complete` | 30 / 20 per minute |
| `gap:generate` / `plans:generate` / `reports:create` | 5 per 5 minutes |
| `invitations:write` | 20 per hour |
| `corpus:operate` | 20 per 5 minutes |
| `jobs:poll` | 120 per minute |
| `client-inference:claim` / `heartbeat` / `result` / `failure` | 60/60/30/30 per minute |

## Pagination

List routes use signed cursor pagination (`src/server/platform/http/pagination.ts`).
Cursors are HMAC-signed envelopes (`scope` + column values); decoding
validates the signature and scope. The secret is `API_CURSOR_SECRET` (or the
Supabase secret key).

## Long-running commands

Expensive commands (AI generation, indexing, report rendering) enqueue a
`background_jobs` row, return `202`, and let the browser poll the authorized
job endpoint (`GET /api/jobs/:jobId`). See [Jobs](../jobs/jobs.md).

## Practical navigation

- Shared machinery: `src/server/platform/http/` (handler, request, response, errors,
  auth, idempotency, rate-limit, operation-rate-limit, pagination,
  request-id).
- Contracts for envelopes, IDs, and DTOs: `src/contracts/`.
- Every route: [Route map](./route-map.md).
