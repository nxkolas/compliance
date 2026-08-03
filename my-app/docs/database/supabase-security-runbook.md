# Supabase server-only security runbook

Status: current simplified schema as of 2 August 2026.

Every public application table is declared with RLS enabled by Drizzle and has
no browser policy. Application access uses server-only credentials after
capability and organization-scope checks. Do not disable RLS or grant blanket
browser access.

## Bootstrap order

The guarded apply phase creates `extensions.vector`, pushes the ordinary schema,
installs only the organization and platform append-only audit triggers, and
reconciles the three private Storage buckets. Use the exact plan and apply
commands in the canonical [disposable schema runbook](drizzle-workflow.md).

No SQL Editor migration chain, guest cleanup function, search-vector trigger,
release publisher, or schema-discovery runner is part of this workflow.

## Verification

Verification is mandatory inside the guarded apply phase. It requires the exact
Drizzle table inventory, RLS on every table, zero browser policies, both audit
triggers, current constraints and indexes, stored generated search expressions,
the vector extension schema, persisted current-pointer/job/Action Plan
invariants, private Storage, and a final zero-drift explanation.

When separately authorized, a direct `anon` or `authenticated` table query
should return no rows or a permission error. Server API smoke must cover login,
organization capability boundaries, questionnaire submission, grounded Gap and
Action Plan work, report download, and private document access.

Browser access changes require an explicit Drizzle policy reviewed for the one
table and operation. Production rollout or rollback requires its own reviewed
baseline/restore procedure; never use the disposable recreation command there.
