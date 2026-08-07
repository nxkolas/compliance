# Authentication and Authorization

> Status: current as of 7 August 2026.

## Authentication

Authentication is provided by Supabase Auth:

- The browser signs in through the application; session cookies terminate at
  the application origin, not in the browser's storage.
- Server-side Supabase clients (`lib/supabase/server.ts`) resolve the request
  session; `proxy.ts` (delegating to `lib/supabase/proxy.ts`) refreshes
  sessions during navigation and API requests.
- API routes call `requireApiUser()` (`src/server/api/auth.ts`), which
  resolves the authenticated actor or throws `401`.
- Server-rendered pages use the same actor resolution through
  `resolveAuthenticatedActor()` (`src/server/auth/authenticated-actor.ts`).

The authenticated actor is projected into application state
(`src/server/users/projection.ts`): Supabase user identity plus a minimal
`user_profiles` row used for display and audit.

Anonymous users are rejected; a guest applicability check uses its own token
mechanism instead of an account.

## Authorization model

Authorization is capability-based and layered:

1. **Roles** — an `organization_memberships` row gives a user one of three
   roles: `owner`, `contributor`, or `viewer`.
2. **Capabilities** — each role maps to a set of named capabilities
   (`src/server/auth/capabilities.ts`), e.g. `gap:read`, `gap:contribute`,
   `reports:create`, `members:manage`, `audit:read`.
3. **Organization scopes** — services resolve the actor's membership and the
   required capability, then pin the organization predicate through the whole
   query or transaction (`src/server/auth/organization-scope.ts`):
   - `authorizeOrganizationRead` for reads;
   - `withAuthorizedOrganizationCommand` for writes, which locks the
     organization and membership rows inside the transaction so
     archive/removal cannot race the check.

The organization ID in a URL is never authority by itself.

### Role → capability summary

| Capability | owner | contributor | viewer |
| --- | --- | --- | --- |
| Read org, members, docs, gap, plans, reports | yes | yes | yes |
| Submit applicability, write documents | yes | yes | no |
| Contribute to / review gap, manage plans | yes | yes | no |
| Update org, archive, invite, manage members | yes | no | no |
| Audit read | yes | no | yes |

Platform operators have a separate capability (`corpus:operate`) used by
operator commands and worker processes, not by web users.

## Row-level security

Every ordinary public table has RLS enabled with no browser-role application
policies. Direct browser access is denied by default; trusted web and worker
connections use the application role and rely on the service-layer scopes
above. This makes RLS a second line of defense rather than the primary
authorization mechanism.

## Audit

Business mutations write append-only `audit_events` rows (actor, event type,
entity, request ID, metadata); platform operations write
`platform_audit_events`. Triggers enforce append-only behavior.

## Practical navigation

- Session and actor resolution: `lib/supabase/server.ts`,
  `src/server/auth/authenticated-actor.ts`,
  `src/server/users/projection.ts`.
- Capabilities and scopes: `src/server/auth/capabilities.ts`,
  `src/server/auth/organization-scope.ts`.
- API enforcement: `src/server/api/auth.ts`.
