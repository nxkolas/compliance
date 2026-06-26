# Database Structure

This document describes the current org-only v1 database model. Supabase Auth
remains the source of truth for users. The app-owned public schema stores only
organizations, memberships, and invitations.

The future compliance/questionnaire schema is planned separately in
`docs/architecture/db-schema-plan.md`.

## Workflow

The TypeScript schema in `src/db/schema.ts` is the source of truth. Apply schema
changes with:

```bash
npm run db:push
```

This project uses Drizzle Kit's push workflow and does not track generated SQL
migrations. The Drizzle config manages only these app tables:

- `organizations`
- `organization_memberships`
- `organization_invitations`

To clear Drizzle-managed app tables in development:

```bash
DB_CLEAR_CONFIRM=clear-app-tables npm run db:clear
```

To discard old development app data and reset to the org-only v1 schema:

```bash
DB_CLEAR_CONFIRM=clear-app-tables npm run db:reset
```

`db:reset` first drops known legacy app tables and enum types from the previous
schema, then runs `db:push`, then clears the current v1 tables.

Do not clear or mutate Supabase Auth tables as part of this app reset.

## Tables

### `organizations`

Stores stable organization identity data.

Columns:

- `id`: Primary key.
- `name`: Display name.
- `legal_name`: Optional legal name.
- `country`: Two-letter country code, defaults to `DE`.
- `created_at`, `updated_at`: Audit timestamps.

### `organization_memberships`

Connects Supabase Auth users to organizations.

Columns:

- `id`: Primary key.
- `organization_id`: Organization.
- `user_id`: Supabase Auth user UUID.
- `role`: `owner`, `admin`, `member`, or `auditor`.
- `status`: `active` or `suspended`.
- `created_at`, `updated_at`: Audit timestamps.

Constraints:

- A user can only have one membership per organization.
- Deleting an organization cascades its memberships.

### `organization_invitations`

Stores pending and historical invitations.

Columns:

- `id`: Primary key.
- `organization_id`: Organization.
- `email`: Invited email address.
- `role`: Role granted on acceptance; only `admin`, `member`, and `auditor` are assignable through invitations.
- `invited_by_user_id`: Supabase Auth user UUID of the inviter.
- `accepted_by_user_id`: Supabase Auth user UUID of the accepting user.
- `token_hash`: SHA-256 hash of the one-time invitation token.
- `status`: `pending`, `accepted`, `revoked`, or `expired`.
- `expires_at`, `accepted_at`: Invitation lifecycle timestamps.
- `created_at`, `updated_at`: Audit timestamps.

The raw token is returned only when an invitation is created. Accept endpoints
hash the submitted token and compare it with `token_hash`.

## Common Queries

List organizations for the current user:

```ts
const memberships = await db.query.organizationMemberships.findMany({
  where: and(
    eq(organizationMemberships.userId, user.id),
    eq(organizationMemberships.status, "active"),
  ),
  with: { organization: true },
});
```

Create an organization with an owner membership:

```ts
const organization = await db.transaction(async (tx) => {
  const [created] = await tx
    .insert(organizations)
    .values({
      name: "Example GmbH",
      legalName: "Example GmbH",
      country: "DE",
    })
    .returning();

  await tx.insert(organizationMemberships).values({
    organizationId: created.id,
    userId: user.id,
    role: "owner",
    status: "active",
  });

  return created;
});
```

## Current Placeholders

The old compliance, guest assessment, AI chat, document review, and export data
tables have been removed from the active schema. Their pages remain as static
placeholders so navigation stays intact while the new versioned questionnaire
and artifact schema is introduced later.
