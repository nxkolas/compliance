# Supabase server-only security runbook

Status: current simplified schema as of 2 August 2026.

Every public application table is declared with RLS enabled by Drizzle and has
no browser policy. Application access uses server-only credentials after
capability and organization-scope checks. Do not disable RLS or grant blanket
browser access.

## Bootstrap order

1. `npm run db:apply-operator-sql -- pre-push` creates `extensions.vector`.
2. `npm run db:push` creates the ordinary schema and generated search vectors.
3. `npm run db:apply-operator-sql -- post-push` installs only the organization
   and platform append-only audit triggers.
4. `npm run storage:bootstrap` creates/verifies private legal-corpus, document,
   and report buckets and policies.

No SQL Editor migration chain, guest cleanup function, search-vector trigger,
release publisher, or schema-discovery runner is part of this workflow.

## Verification

```powershell
npm run db:verify:server-only
npm run db:verify:integrity
npm run storage:verify
```

The first command requires the exact Drizzle table inventory, RLS on every
table, zero browser policies, and both audit triggers. The integrity command
checks current constraints/indexes, both stored generated search expressions,
the vector extension schema, exactly the two non-internal public triggers, and
persisted current-pointer/job/Action Plan invariants.

When separately authorized, a direct `anon` or `authenticated` table query
should return no rows or a permission error. Server API smoke must cover login,
organization capability boundaries, questionnaire submission, grounded Gap and
Action Plan work, report download, and private document access.

Browser access changes require an explicit Drizzle policy reviewed for the one
table and operation. Production rollout or rollback requires its own reviewed
baseline/restore procedure; never use the disposable recreation command there.
