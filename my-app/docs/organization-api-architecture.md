# Organization API Architecture

This is the backend contract for the first organization feature. No frontend
components are required for this layer.

## Design

The code is split into three layers:

- `app/api/.../route.ts`: Thin Next.js route handlers. They authenticate the
  request, parse JSON, call a service, and return JSON.
- `src/server/organizations/service.ts`: Business logic. This owns
  authorization rules, validation, invitation token handling, and transactions.
- `src/server/organizations/types.ts`: Request/response/domain types for this
  feature.

Shared API helpers live in:

- `src/server/api/auth.ts`: Authenticated API user lookup through Supabase Auth.
- `src/server/api/errors.ts`: Consistent JSON error responses.
- `src/server/api/request.ts`: JSON body parsing and small request validators.

## Routes

### `GET /api/organizations`

Returns all organizations where the current Supabase Auth user is a member.

Response:

```json
{
  "organizations": []
}
```

### `POST /api/organizations`

Creates an organization and automatically adds the current user as `owner`.
The creation runs in one transaction so the organization cannot exist without
its owner membership.

Request:

```json
{
  "name": "Example GmbH",
  "legalName": "Example GmbH",
  "employeeCount": 85,
  "annualRevenueEur": "12000000.00",
  "balanceSheetTotalEur": "8000000.00",
  "size": "medium",
  "countryCode": "DE"
}
```

Response:

```json
{
  "organization": {
    "id": "..."
  }
}
```

### `GET /api/organizations/:organizationId/invitations`

Lists invitations for one organization. Only `owner` and `admin` members can
call this route.

Response:

```json
{
  "invitations": []
}
```

### `POST /api/organizations/:organizationId/invitations`

Creates an invitation. Only `owner` and `admin` members can invite users.
The API returns the raw token once. The database stores only `token_hash`.

Request:

```json
{
  "email": "teammate@example.com",
  "role": "member",
  "expiresInDays": 14
}
```

Response:

```json
{
  "invitation": {
    "id": "...",
    "email": "teammate@example.com",
    "role": "member",
    "status": "pending",
    "token": "raw-token-for-link"
  }
}
```

Frontend link shape later:

```text
/invitations/accept?token=<raw-token-for-link>
```

There is no email adapter yet. The next layer can either send email through a
provider or show/copy the invitation link in the UI.

### `POST /api/organization-invitations/accept`

Accepts an invitation for the logged-in user. The logged-in user's Supabase
Auth email must match the invitation email.

Request:

```json
{
  "token": "raw-token-from-link"
}
```

Response:

```json
{
  "invitation": {
    "id": "...",
    "status": "accepted",
    "acceptedByUserId": "..."
  }
}
```

## Business Rules

- A logged-in user can create an organization.
- The creator becomes `owner`.
- Only `owner` and `admin` can list/create invitations for an organization.
- Invitations can grant `admin`, `member`, or `auditor`.
- Invitations cannot grant `owner`.
- Creating a new pending invitation for the same organization and email revokes
  older pending invitations for that same pair.
- Invitation tokens are generated with `crypto.randomBytes`.
- Only a SHA-256 token hash is stored in the database.
- Invitations expire after 14 days by default.
- `expiresInDays` must be between 1 and 90.
- Accepting an invitation creates an `organization_members` row.
- Accepting an invitation is idempotent for already-existing memberships because
  the insert uses `onConflictDoNothing`.

## Error Shapes

All API errors return:

```json
{
  "error": "Message"
}
```

Common statuses:

- `400`: Invalid input.
- `401`: User is not logged in.
- `403`: User is logged in but not allowed.
- `404`: Organization or invitation not found.
- `409`: Invitation was already accepted/revoked/expired.
- `410`: Invitation expired during acceptance.
- `500`: Unexpected server error.

## Example Client Calls

Create organization:

```ts
await fetch("/api/organizations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Example GmbH",
    employeeCount: 85,
    size: "medium",
  }),
});
```

Invite member:

```ts
await fetch(`/api/organizations/${organizationId}/invitations`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "teammate@example.com",
    role: "member",
  }),
});
```

Accept invitation:

```ts
await fetch("/api/organization-invitations/accept", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    token,
  }),
});
```
