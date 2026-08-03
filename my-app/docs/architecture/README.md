# Architecture Docs

This folder contains system architecture, data model, and API design notes.

## Guides

- [End-to-end compliance workflow](./end-to-end-compliance-workflow.md)
- [Database structure](./database-structure.md)
- [Framework change and extension effort](./framework-change-effort.md)
- [Organization API architecture](./organization-api-architecture.md)
- [API route inventory](./api-route-inventory.md)
- [Organization progress and tutorial boundary](./tutorial/organization-progress.md)
- [AI generation contract versions](./ai-generation-contract-versions.md)
- [Generation job reconciliation runbook](../runbooks/generation-job-reconciliation.md)
- [Portable PostgreSQL job execution](../runbooks/portable-job-execution.md)

## Background jobs

Durable background work uses one PostgreSQL-backed execution module with
multiple bounded wake-up adapters. Next.js `after()` handles low-latency
request-driven execution, an authenticated internal route provides scheduled
recovery, job polling can re-wake non-terminal work, and the optional resident
worker repeats the same drain for self-hosted throughput.
