# Current AI generation contracts

Status: current as of 2 August 2026.

The deployed application has one executable Gap contract and one executable
Action Plan contract. They are code-owned and exposed only through:

- `src/server/gap-analysis/current-contract.ts`; and
- `src/server/action-plans/current-contract.ts`.

The current behavior is the behavior formerly named Gap v12 and Action Plan
v6. Those labels describe compatibility history; they are not runtime release
selectors. No database release lookup, publication, activation, or inheritance
chooses an executable definition.

## Provenance

A definition hash is the canonical, key-sorted fingerprint of the code-owned
inputs for its product domain. Gap and Action Plan use separate hashes so an
unrelated definition change does not stale work. Drafts, jobs, generated
outputs, and AI runs retain the applicable hashes. Unfinished work with a
different deployed definition is rejected or restarted; completed normalized
snapshots remain readable and are reported as outdated where appropriate.

An AI run's prompt hash is computed from the exact normalized system and user
messages plus response-schema metadata sent to the provider. It is not a
release ID. Provider, model, usage, admitted context, validated output, build
hash, and domain definition hash complete the run provenance.

## Server-owned semantics

The server owns category identity, Gap kinds, triggering and satisfied
questions, statement cardinality, Action mode, Gap coverage, priority,
ordering, mandatory citations, locale, and persistence metadata. Provider
output supplies only the bounded prose and optional organization citations
allowed by the strict current schemas.

Material Gap contradictions must return the exact unique allowlisted
organization citation IDs involved. Missing, weak, irrelevant, or uncited
optional evidence is not a contradiction. Action Plan generation is a distinct
grounded provider operation with complete category-scoped many-to-many Gap
coverage.

Historical numeric contract modules remain only as compatibility fixtures
while their tests are retained. Runtime code must import the current-contract
boundaries and must never select a numeric contract dynamically.
