# Local model testing

There are two different things called "local" here, and they work differently.

**Browser-relayed** is the product feature. An organization chooses
`self_hosted` and records its own models; a member's browser then runs them
against a model server on that person's machine. The deployed application never
reaches the model — it cannot, because a serverless function cannot connect to
someone's `127.0.0.1`. Work only progresses while a browser is connected to the
organization; the relay worker lives in the application shell, so it keeps
serving while that tab is open - across navigation and page refreshes - and
stops only when the tab closes.

**Server-reachable** is the development and on-premises path. The application
process itself calls a model server it can reach over the network, configured
through `SELF_HOSTED_AI_*`. No browser involved. This is what you want for local
development, and it is what the rest of this runbook sets up.

Which one an organization gets is decided by data, not configuration: an
organization with a row in `organization_model_settings` is browser-relayed, and
one without falls back to the deployment's `SELF_HOSTED_AI_*` values
([service.ts](../../src/server/documents/service.ts), `resolveOrganizationEmbeddingConfig`).

## What switching providers affects

The legal corpus stores no vectors. It resolves authority through reviewed
`provision key -> chunk` bindings and otherwise ranks on its full-text index
([legal-retrieval.ts](../../src/server/ai/grounding/legal-retrieval.ts)), so gap
analysis works under any provider without re-provisioning anything.

Only **organization documents** carry embeddings, and those are per
organization. Changing an organization's embedding coordinates through settings
stages the switch and re-indexes that organization's documents; the previous
vectors keep serving until it succeeds. Changing the generation model costs
nothing at all — it is deliberately independent, so a model can be swapped
freely without rebuilding anything.

## Setup (server-reachable)

### 1. Install Ollama

Download the Windows installer from <https://ollama.com/download>, or:

```powershell
winget install Ollama.Ollama
```

The installer registers a background service that starts on login, so
`ollama serve` never needs to be run by hand. Reopen the terminal afterwards so
`ollama` is on `PATH`.

### 2. Pull the models

```powershell
ollama pull gemma3:27b
ollama pull embeddinggemma
```

Any generation model that honours `response_format: json_schema` works, and any
embedding model at all — the storage column carries no fixed dimension, so
`embeddinggemma` at 768 is as usable as a 2560-dimension model. Pick from
<https://ollama.com/library>.

### 3. Verify

```powershell
ollama list
Invoke-RestMethod http://127.0.0.1:11434/v1/models
```

Ollama listens on `127.0.0.1:11434` and serves an OpenAI-compatible API at
`/v1`. Use `Invoke-RestMethod`, not `curl`: in Windows PowerShell, `curl` is an
alias for `Invoke-WebRequest` and takes different arguments.

### 4. Switch the application over

The `SELF_HOSTED_AI_*` values in `.env.local` are inert on their own. The single
switch is `AI_DEFAULT_PROVIDER`: uncomment

```
AI_DEFAULT_PROVIDER=self_hosted
```

and set `AI_EMBEDDING_DIM` to whatever the embedding model actually returns
(768 for `embeddinggemma`), then restart `npm run dev`.

Leaving it commented keeps the application on OpenAI, embeddings included, even
when every other value in the block is set.

## Dimensions

`AI_EMBEDDING_DIM` is no longer pinned to 1536. `document_chunks.embedding` is
an undimensioned pgvector column, so each row stores its embedding at whatever
width produced it, and the only bound is pgvector's own storage ceiling of
16000.

Two consequences:

- **The declared width must match the model exactly.** `adaptEmbeddings`
  ([embeddings.ts](../../src/server/documents/embeddings.ts)) used to truncate
  anything wider. It no longer does, because truncating is only sound for a
  Matryoshka-trained model and the model is now a customer's choice. A mismatch
  raises an error naming both numbers.
- **There is no ANN index on that column**, and there cannot be a single one
  while widths vary per organization. Similarity search is a sequential scan.
  That was already true before dimensions became variable, so nothing regressed,
  but it is the cost to reckon with if the corpus grows.

## Structured outputs are mandatory

`SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS` must be `true`, and for a
browser-relayed organization the connect probe enforces the same thing by
refusing to save a model that fails it.

Setting it wrong fails in a way that is easy to misread: the AI SDK stops
sending the schema and only *asks* for JSON in the prompt. The model returns
syntactically valid JSON with keys it invented, Zod rejects it, and generation
reports a provider failure with no failed HTTP request in the model server's log
— because the request itself succeeded.

`SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS` can stay `false`; grounded generation uses
structured outputs rather than tool calls.

## How mixed embeddings are prevented

Vectors from two embedding configurations are not comparable, so retrieval
filters on `document_versions.embedding_key`
([retrieval.ts](../../src/server/documents/retrieval.ts)). That key hashes the
model, its revision, its dimensions, the query instruction profile and the
chunking version, so a change to any one of them excludes the affected rows
rather than scoring them. A half-finished re-index becomes missing results
instead of confident nonsense.

Changing any of those stages a migration rather than taking effect immediately
([embedding-migration-service.ts](../../src/server/organizations/embedding-migration-service.ts)):
a row is written to `organization_embedding_migrations`, a job re-indexes every
document, and only on success do the organization's active coordinates and the
vectors advance together — in one transaction. That is why the two can never
disagree.

This is keyed on the embedding identity, not the provider. An organization
swapping its local embedding model never changes provider, so a provider
comparison would have returned early on exactly the change that matters.

To see what an organization currently holds:

```sql
select embedding_model, embedding_dimensions, embedding_key, count(*)
from document_versions
where indexing_status = 'succeeded'
group by 1, 2, 3;
```

More than one row means an earlier re-index did not finish; re-run the switch.

## Browser-relayed setup

Only needed to exercise the product feature rather than develop against a local
model.

1. **Nothing to configure for local development.** Ollama allows `localhost` and
   `127.0.0.1` on any port out of the box, so a dev server on `:3000` works with
   `OLLAMA_ORIGINS` unset. Confirmed by preflighting Ollama directly:

   ```powershell
   Invoke-WebRequest http://127.0.0.1:11434/v1/models -Method Options -UseBasicParsing `
     -Headers @{ "Origin"="http://localhost:3000"; "Access-Control-Request-Method"="POST" } |
     ForEach-Object { $_.Headers["Access-Control-Allow-Origin"] }
   ```

   Any other origin gets `403` on the preflight, so a deployed instance does
   need `OLLAMA_ORIGINS` set to its domain. Note that Ollama reads it once at
   startup *from the environment it was launched in*: setting it and restarting
   from an already-open terminal keeps the old value and looks like the setting
   was ignored.

   Never use `*` for `OLLAMA_ORIGINS`: it would let any website the user
   visits call their local model server from the browser and run their models.
   Scope it to the exact deployment origin (plus any dev origins you use), and
   keep Ollama bound to loopback (`127.0.0.1`) rather than all interfaces.

   An HTTPS page calling `http://localhost` is permitted — browsers treat
   loopback as a potentially trustworthy origin — but verify per target browser.
2. Set the organization's provider to `self_hosted` in settings.
3. Open the local model panel, enter the model ids, and run **Test connection**.
   The probe checks the server is reachable, that the generation model honours a
   JSON schema, what width the embedding model returns, and the loaded context
   window via `/api/ps` rather than `/api/show` (which reports a much larger
   theoretical maximum).
4. Save and connect. The relay worker keeps running as long as the app is
   open in this tab - you can navigate to other pages or refresh, and it
   reconnects on its own. Closing the tab pauses the organization's
   generation, document indexing and re-indexing until a browser is open
   again.

### What to expect

A gap analysis is *categories x phases x attempts* separate round trips to the
browser, not one. Each parks the job until the browser answers, and the job
re-executes from the start when it wakes — calls already answered are matched by
input hash and skipped, so each wake-up advances by one call rather than
repeating the run.

Closing the tab does not lose work. The claim lease expires, the request becomes
claimable again, and another member's browser can pick it up. Requests nobody
answers within 30 minutes are expired by the cleanup job so the parked job fails
with a reason instead of waiting indefinitely.

Safety bounds on the relay: claim and heartbeat calls are rate limited per
member and organization (60/min), as are results and failure reports (30/min);
one member can hold at most three requests at once, and a claim can be
heartbeated for at most 15 minutes before it lapses and another browser may
take it. Request bodies are capped (32 MB for a relayed result, 16 KB for a
failure report, 8 MB default elsewhere).

## Troubleshooting

Ollama's own request log is the fastest way to tell an application-side failure
from a model-side one:

```powershell
Get-Content "$env:LOCALAPPDATA\Ollama\server.log" -Tail 40
```

A generation failure with **no `POST /v1/chat/completions` line** means the call
either never left the browser or succeeded and was rejected afterwards. A `200`
on that line with a downstream failure points at schema validation — see the
structured-outputs note above.

For a browser-relayed organization, check the request queue directly:

```sql
select kind, status, attempt_count, failure_code, created_at
from client_inference_requests
order by created_at desc limit 20;
```

Rows stuck at `pending` mean no browser is connected - the gap screen shows
"Waiting for a connected browser". Open the application in a tab and connect
once; the relay worker keeps serving while that tab stays open. Rows cycling through
`claimed` with a rising `attempt_count` mean a client keeps claiming and failing
— read `failure_code`.

`SELF_HOSTED_AI_MAX_CONTEXT_TOKENS` must not exceed the loaded context window,
and `AI_GROUNDED_MAX_OUTPUT_TOKENS` has to fit inside it alongside the prompt.
Raise Ollama's side with `OLLAMA_CONTEXT_LENGTH` and restart the service.

### Thinking models

A thinking model must be told not to think. `getGenerationOptions`
([generation-options.ts](../../lib/ai/generation-options.ts)) sends
`reasoning_effort` for Ollama and `chat_template_kwargs` for vLLM, selected by
the organization's recorded thinking style; with no recorded style it sends both
and each server ignores the one it does not know.

If reasoning is enabled by accident the symptom is distinctive: the response
carries a populated `reasoning` field, an empty `content`, and
`finish_reason: "length"`, because the model spends the whole
`AI_GROUNDED_MAX_OUTPUT_TOKENS` budget thinking. Generation then fails as
`GENERATION_TERMINAL` rather than as a schema error, since there is no JSON to
reject — so it gets no retry and no repair pass. The browser client detects this
case specifically and reports it rather than passing up a bare "no content".

To check the flag is still working:

```powershell
$body = @{ model = "gemma3:27b"; reasoning_effort = "none"; max_tokens = 300
  messages = @(@{ role = "user"; content = "Reply with JSON: {\"ok\":true}" }) } | ConvertTo-Json -Depth 6
$r = Invoke-RestMethod -Method Post http://127.0.0.1:11434/v1/chat/completions -ContentType application/json -Body $body
"finish={0} tokens={1} contentLen={2}" -f $r.choices[0].finish_reason, $r.usage.completion_tokens, $r.choices[0].message.content.Length
```

`finish=stop` with a non-zero `contentLen` is healthy. `finish=length` with
`contentLen=0` means thinking is back on.

Expect slow generations regardless. Keep `AI_PROVIDER_MAX_CONCURRENCY=1`
locally, since Ollama serialises requests by default and the queue wait is
charged to the job. `AI_PROVIDER_TIMEOUT_MS` defaults to 120s, which a local
model can exceed on a normal category; 300000 is the ceiling
`providerTimeoutMs` will accept. Browser-relayed requests are not bound by that
timeout — they are bound by the client lease and the request TTL instead.

## Reverting

Comment out `AI_DEFAULT_PROVIDER` again and restart. It falls back to `openai`,
which is the schema default. The remaining `SELF_HOSTED_AI_*` values can stay
set; they are unused while another provider is selected.

For a browser-relayed organization, switching back to OpenAI in settings stages
a re-index the same way any other embedding change does.
