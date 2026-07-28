# Authentication Route Blocking

Status: proposed implementation plan; behavior and security boundaries confirmed
on 2026-07-23.

## Outcome

Keep authentication centralized while correcting the response type for private
API requests and preventing full authenticated users from reopening guest-only
authentication pages.

The proxy remains the primary HTTP authentication gate. Route-level
`requireApiUser()` checks remain as defense in depth, provide the trusted actor
ID, and protect handlers when they are invoked outside the normal proxy path.
Organization and Platform Administrator authorization remains in server
services because it depends on the requested resource and capability.

## Confirmed behavior

| Request | Session | Result |
| --- | --- | --- |
| Private browser page | None or anonymous | `307` to login with a safe `next` |
| Private API | None or anonymous | JSON `401 AUTHENTICATION_REQUIRED` |
| Private API | Supabase unconfigured | JSON `503 SERVICE_UNAVAILABLE` |
| Guest-only authentication page | Full user | Redirect to a safe `/tool` destination |
| Private page or API | Full user | Continue to the page or handler |
| Public authentication or check route | Any | Continue normally |

The guest-only authentication pages are:

- `/auth/login`
- `/auth/sign-up`
- `/auth/forgot-password`

The following authentication-flow routes remain accessible regardless of
session state:

- `/auth/callback`
- `/auth/confirm`
- `/auth/error`
- `/auth/update-password`

Supabase anonymous sessions are treated as unauthenticated for private pages
and APIs. They may still use login, sign-up, forgot-password, and public guest
applicability-check routes.

## Route policy

Add a pure route-policy module under `lib/auth` that defines:

- the explicit guest-only authentication routes;
- the explicit public authentication-flow routes;
- the exact public guest API endpoints;
- segment-safe `/api` and `/check` matching; and
- a `parseSafeToolNext()` helper.

Unknown routes remain private by default. Prefix checks must honor path
boundaries so that, for example, `/authentication` does not inherit `/auth`
policy, `/checklist` does not inherit `/check` policy, and `/apix` is not
treated as an API route.

`parseSafeToolNext()` accepts only `/tool` or a path starting with `/tool/`.
Invalid, external, API, or authentication destinations fall back to
`/tool/organizations`.

## Proxy changes

Refactor `lib/supabase/proxy.ts` so that it continues to resolve the Supabase
user and refresh session cookies before applying the route policy.

For private APIs:

1. Return the standard JSON `503 SERVICE_UNAVAILABLE` envelope when Supabase
   configuration is missing.
2. Return the standard JSON `401 AUTHENTICATION_REQUIRED` envelope when there
   is no user or the user is anonymous.
3. Continue to the route handler when a full authenticated user exists.

The two exact public guest API endpoints continue without this private API
gate:

- `/api/guest/applicability-check/submissions`
- `/api/guest/applicability-check/result`

`/api/guest/applicability-check/claim` remains private.

For browser pages:

1. Redirect unauthenticated or anonymous users from private pages to
   `/auth/login`.
2. Preserve the requested path and query in `next` only when it is an allowed
   `/tool` destination.
3. Redirect full authenticated users away from guest-only authentication
   pages to a valid `next` destination or `/tool/organizations`.
4. Continue to allow callback, confirmation, error, update-password, home, and
   applicability-check routes.

Every redirect or proxy-generated API error must copy refreshed or cleared
Supabase cookies from the session response. This prevents browser and server
session state from diverging.

## Standard API errors

Proxy-generated errors must use the existing common API envelope:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication required",
    "requestId": "..."
  }
}
```

Reuse `jsonError()` from `src/server/api/response.ts`. Extract the lightweight
request-ID resolver from `src/server/api/handler.ts` into a shared API utility
so both normal handlers and the proxy use the same validation and generation
rules. Responses must include the same `x-request-id` header as normal API
errors.

## Route-level defense in depth

Update `requireApiUser()` to detect missing Supabase configuration before
creating a client and throw:

- status: `503`
- code: `SERVICE_UNAVAILABLE`
- message: an implementation-safe authentication service unavailable message

Keep `requireApiUser()` in every private API handler. The proxy prevents
unauthenticated HTTP access centrally; the handler check supplies the trusted
user and protects direct invocation in tests or future internal entry points.

Do not add a test that scans source files for the text `requireApiUser`. Such a
test would be coupled to implementation syntax and could reject valid indirect
authentication or miss unsafe implementations.

## Client redirect handling

Replace the duplicated permissive `getNextPath()` implementations in:

- `components/login-form.tsx`
- `components/sign-up-form.tsx`

Both components use the shared `/tool`-only parser. This keeps links between
login and sign-up consistent with the server-side redirect policy and prevents
navigation into API endpoints or authentication loops.

Do not apply the `/tool` restriction to the authentication callback's `next`
parameter. Password recovery intentionally uses:

```text
/auth/callback?next=/auth/update-password
```

Restricting callback destinations to `/tool` would break that flow.

## Regression tests

Add focused Vitest coverage without introducing a browser-test framework.

### Route-policy tests

- Exact guest-only and public authentication routes.
- Exact public guest APIs.
- Private guest claim API.
- Segment-boundary cases for `/auth`, `/check`, and `/api`.
- Valid `/tool` destinations.
- External, protocol-relative, API, authentication, and redirect-loop
  destinations.

### Proxy tests

- Unauthenticated private page returns a login redirect with its path and
  query preserved.
- Unauthenticated private API returns JSON `401`, not a redirect.
- Anonymous sessions follow the same private page and API behavior.
- Anonymous sessions may open guest-only authentication pages.
- Missing configuration returns JSON `503` for private APIs.
- Full users are redirected from login, sign-up, and forgot-password.
- Valid `/tool` `next` values are honored.
- Invalid `next` values fall back to `/tool/organizations`.
- Callback, confirm, error, and update-password continue normally.
- Public guest API endpoints continue normally.
- Refreshed and cleared session cookies survive redirects and JSON errors.
- API errors contain the standard envelope and `x-request-id`.

### API authentication tests

- `requireApiUser()` returns the authenticated non-anonymous user.
- Missing or invalid sessions return `401 AUTHENTICATION_REQUIRED`.
- Anonymous sessions return `401 AUTHENTICATION_REQUIRED`.
- Missing Supabase configuration returns `503 SERVICE_UNAVAILABLE` without
  attempting to construct the Supabase client.
- A representative private API continues to produce its standard route-level
  `401` when invoked directly outside the proxy.

## Verification

After implementation:

1. Run linting and TypeScript checking.
2. Run the focused authentication and proxy tests.
3. Run the complete route test suite.
4. Repeat the unauthenticated inventory of all private pages and APIs.
5. Verify platform-admin and organization-admin-equivalent sessions.
6. Confirm private API failures use JSON, never login HTML.
7. Confirm every API error includes a request ID in its body and header.
8. Confirm login and sign-up honor only safe `/tool` destinations.
9. Confirm password recovery still reaches `/auth/update-password`.

## Acceptance criteria

- No unauthenticated private API request redirects to an HTML login page.
- Private APIs remain centrally protected by the proxy.
- Route-level authentication remains in place as defense in depth.
- Full authenticated users cannot reopen guest-only authentication pages.
- Anonymous sessions are not treated as full accounts.
- Password recovery and authentication callbacks continue to work.
- Route classification is deny-by-default and segment-safe.
- Session cookies are preserved on every proxy-generated response.
- Existing API success and authorization behavior remains unchanged.
