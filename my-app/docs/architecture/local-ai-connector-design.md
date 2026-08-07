# Local AI Connector design

Status: superseded. The installed Local Connector described here was never
built. The shipped mechanism is the browser relay, designed in
[browser-relayed-local-ai.md](../../plans/pending/browser-relayed-local-ai.md)
and documented for users in
[connecting-your-own-model.md](../../product/connecting-your-own-model.md) and
for operators in [local-model-testing.md](../../runbooks/local-model-testing.md).

This note records only the agreed design for using an AI model running on a
customer's computer from the deployed Complyx application. It does not finalize
the wider database simplification or schema-refactor decisions.

## Goal

An organization can explicitly select `self_hosted` as its AI provider. A small
Complyx Local Connector installed on a user's computer then executes AI requests
against a locally configured model, for example Ollama or another
OpenAI-compatible service published from Docker Desktop.

The deployed Complyx server cannot connect to the user's `localhost` directly.
The connector therefore initiates all communication to Complyx through an
authenticated outbound connection.

## Locked decisions

- The local model URL and any local model credentials are configured and stored
  only in the Local Connector.
- The deployed Complyx application does not store or attempt to resolve the
  user's localhost URL.
- The connector runs as an installed background process. Generation must not
  depend on a browser tab remaining open.
- The connector uses authenticated outbound requests to Complyx. It requires no
  inbound firewall port and must not expose Docker or the model to the internet.
- The connector performs model inference only. It receives no database
  credentials and does not execute Complyx business logic.
- Complyx remains responsible for evidence retrieval, prompt construction,
  output validation, citation validation, persistence, audit records, retries,
  and the final Gap Analysis or Action Plan result.
- There is no automatic fallback from `self_hosted` to OpenAI or Complyx-hosted
  AI. An unavailable connector or local model causes the selected operation to
  wait or fail according to its explicit timeout and retry policy.
- The AI audit record identifies the actual provider mode and the model metadata
  reported by the connector. Because the model is customer-controlled, this
  metadata is recorded as connector-reported rather than independently attested
  by Complyx.

## Relationship to the existing job architecture

The Local Connector must not claim an existing Gap Analysis or Action Plan
background job. Those jobs contain the complete server-side workflow and require
trusted access to Complyx data and services.

Instead, the existing background job remains the parent workflow and delegates
only individual model calls through AI processing runs:

```text
User starts Gap Analysis or Action Plan
  -> Complyx enqueues the existing background job
  -> hosted worker leases the background job
  -> worker retrieves evidence and constructs the exact AI request
  -> AI processing run becomes available to the organization's connector
  -> parent background job enters waiting_for_provider and releases its lease
  -> connector claims the AI run through an outbound request
  -> connector invokes the locally configured model
  -> connector submits the raw output and model metadata
  -> Complyx validates the response and completes the AI run
  -> parent background job is queued again
  -> hosted worker resumes the idempotent workflow and persists the result
  -> parent background job succeeds
```

Hosted and OpenAI provider modes can continue calling their provider directly;
they do not need to enter `waiting_for_provider`.

The separation of responsibilities is:

| Component | Responsibility |
| --- | --- |
| `background_jobs` | Overall workflow, progress, cancellation, retry, and final result locator |
| `ai_processing_runs` | Exact inference request, provider/model provenance, connector claim lease, returned output, and validation outcome |
| Local Connector | Claim an authorized AI request, call the local model, and return its response |
| Complyx server/worker | Retrieval, prompts, validation, citations, audit, and business persistence |

This reuses the existing durable job architecture. It does not introduce a
second general-purpose job queue or a separate connector-result subsystem.

## Required lifecycle behavior

### Connector availability

Complyx may show whether a connector has checked in recently and which models it
reports as available. A request must never silently switch providers when the
connector is offline.

### Claiming and leases

- A connector can claim only self-hosted AI runs belonging to its paired
  organization.
- Claims are leased so that work can be recovered after a connector crash.
- The connector heartbeats while a model request is running.
- Duplicate submissions are handled idempotently using the AI run ID and exact
  input hash.
- Local concurrency is bounded by the connector rather than assumed by the
  server.

### Cancellation

Cancelling the parent background job also cancels pending or running connector
work. The connector checks cancellation while heartbeating and aborts the local
HTTP request where supported. A late response for a cancelled or expired claim
is rejected.

### Retry and recovery

- A retry uses the pinned request content and input hash for that attempt.
- A lost connector lease makes the AI request claimable again unless its retry
  budget is exhausted.
- When the connector returns successfully, the parent background job is queued
  for resumable, idempotent server-side completion.
- The hosted worker must not remain occupied while waiting for a customer
  connector; this is why the parent job needs a durable waiting state.

### Validation and trust boundary

The connector response is untrusted input. Complyx validates at least:

- ownership, claim token, lease, and request identity;
- response size and JSON/schema conformance;
- requested output language;
- required query-unit coverage and citation identifiers;
- claim support against the exact server-selected context;
- consistency of the returned input/run identifier.

Only validated output may become an authoritative artifact or Action Plan.

## Local connector security boundary

- The connector authenticates to Complyx using a revocable organization pairing,
  with short-lived request credentials after pairing.
- It sends outbound HTTPS requests only to the configured Complyx deployment.
- Its local control endpoint, if one is needed, binds only to `127.0.0.1`.
- It never exposes the Docker socket, a generic network proxy, or arbitrary file
  access.
- Local model credentials are stored using the operating system's credential
  storage where available and are never returned to Complyx.
- The connector accepts a narrow, versioned inference contract rather than
  arbitrary remote commands.
- Pairing, revocation, claims, completions, failures, and reported model identity
  produce appropriate audit events without logging credentials or full sensitive
  prompts in operational logs.

## Deployment shape

An example local setup is:

```text
Complyx Local Connector
  -> http://127.0.0.1:11434
  -> Docker Desktop published port
  -> Ollama or another supported OpenAI-compatible model server
```

The Docker service must publish its model API to the host loopback interface, or
the connector must itself run in a Docker network that can reach the model. The
model URL remains a local connector concern.

## Deferred implementation details

The following details remain intentionally open until implementation planning:

- connector packaging and supported operating systems;
- polling versus a long-lived outbound channel after the initial implementation;
- pairing UX and credential rotation intervals;
- exact claim, heartbeat, completion, and cancellation API contracts;
- connector update and compatibility policy;
- maximum offline wait, lease duration, and retry budgets;
- how much parallel inference a connector may advertise;
- retention or encryption rules for the durable inference request body.

These are local-connector implementation choices, not decisions about the wider
application schema.
