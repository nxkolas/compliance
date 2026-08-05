# Local model testing

Optional. Development normally runs against OpenAI; this runbook is only for
exercising the `self_hosted` provider path against a host-run Ollama.

There is no Docker involved. Ollama runs natively on the host and the
application reaches it over loopback.

## What switching providers affects

The legal corpus stores no vectors. It resolves authority through reviewed
`provision key -> chunk` bindings and otherwise ranks on its full-text index
([legal-retrieval.ts](../../src/server/ai/grounding/legal-retrieval.ts)), so
gap analysis works under any provider without re-provisioning anything.

Only **organization documents** carry embeddings, and those are per
organization. Changing an organization's embedding provider through settings
stages the switch and re-indexes that organization's documents in the
background; the previous vectors keep serving until it succeeds. Changing the
generation provider costs nothing at all.

## Setup

### 1. Install Ollama

Download the Windows installer from <https://ollama.com/download>, or:

```powershell
winget install Ollama.Ollama
```

The installer registers a background service that starts on login, so
`ollama serve` never needs to be run by hand. Reopen the terminal afterwards so
`ollama` is on `PATH`.

### 2. Pull the models

Run from any directory. Ollama is a global CLI and always writes to
`%USERPROFILE%\.ollama\models`, regardless of the working directory.

```powershell
ollama pull qwen3.5:9b-q4_K_M
ollama pull qwen3-embedding:4b-q4_K_M
```

`pull` only downloads. Models load into memory on the first inference request,
so expect the first call after a restart to be slow. Roughly 8 GB of disk is
needed for both.

These tags carry over from the deleted Compose stack and have not been verified
against Ollama's public registry. If either fails, pick a replacement from
<https://ollama.com/library> — subject to the dimension constraint below.

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

then restart `npm run dev` and `npm run worker:local`.

Leaving it commented keeps the application on OpenAI, embeddings included, even
when every other value in the block is set. Read the mixed-embedding warning
below before flipping it.

## Why these models

`AI_EMBEDDING_DIM` is pinned to 1536 in
[common.ts](../../src/config/env/common.ts) and the schema uses `vector(1536)`
columns. `adaptEmbeddings` in
[embeddings.ts](../../src/server/documents/embeddings.ts) truncates longer
vectors but throws on shorter ones, so the embedding model must emit at least
1536 dimensions.

| Model | Dimensions | Usable |
| --- | --- | --- |
| `qwen3-embedding:4b` | 2560 | yes, truncated to 1536 |
| `qwen3-embedding:0.6b` | 1024 | no |
| `mxbai-embed-large` | 1024 | no |
| `bge-m3` | 1024 | no |
| `nomic-embed-text` | 768 | no |

Truncating Qwen3-Embedding is legitimate because it is Matryoshka-trained.
Truncating a model that is not would degrade quality silently.

`SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS` must be `true`. Ollama enforces
`response_format: json_schema` natively via grammar constraints.

Setting it to `false` fails in a way that is easy to misread: the AI SDK stops
sending the schema and only *asks* for JSON in the prompt. The model returns
syntactically valid JSON with keys it invented, Zod rejects it, and gap
generation reports a provider failure with no failed HTTP request in Ollama's
log — because the request itself succeeded.

`SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS` can stay `false`; grounded generation uses
structured outputs rather than tool calls.

## How mixed embeddings are prevented

Vectors from two embedding models are not comparable, so document retrieval
filters on `document_versions.embedding_model` alongside organization, version
and indexing status ([retrieval.ts](../../src/server/documents/retrieval.ts)).
Rows produced by any other model are excluded rather than scored, which turns a
half-finished re-index into missing results instead of confident nonsense.

`AI_DEFAULT_PROVIDER` is only the server-wide fallback. An organization follows
its own `ai_provider_mode`, which is a single choice covering generation and
embeddings alike. Changing it through settings does not take effect
immediately: a row is written to `organization_embedding_migrations`, a job
re-indexes every document, and only on success do the provider and the vectors
advance together. That is why the two can never disagree.

To see what an organization currently holds:

```sql
select embedding_model, count(*)
from document_versions
where indexing_status = 'succeeded'
group by embedding_model;
```

More than one row means an earlier re-index did not finish; re-run the switch.

The legal corpus is unaffected either way — it stores no vectors at all.

## Troubleshooting

Ollama's own request log is the fastest way to tell an application-side failure
from a model-side one:

```powershell
Get-Content "$env:LOCALAPPDATA\Ollama\server.log" -Tail 40
```

A generation failure with **no `POST /v1/chat/completions` line** means the call
either never left the application or succeeded and was rejected afterwards. A
`200` on that line with a downstream failure points at schema validation — see
the structured-outputs note above.

To check the real context window, use `/api/ps` (the loaded slot) rather than
`/api/show` (the model's theoretical maximum, which is far larger and misleading):

```powershell
(Invoke-RestMethod http://127.0.0.1:11434/api/ps).models |
  ForEach-Object { "{0} ctx={1}" -f $_.name, $_.context_length }
```

`SELF_HOSTED_AI_MAX_CONTEXT_TOKENS` must not exceed that number, and
`AI_GROUNDED_MAX_OUTPUT_TOKENS` has to fit inside it alongside the prompt. Raise
Ollama's side with `OLLAMA_CONTEXT_LENGTH` and restart the service.

Expect slow generations. Qwen3.5 is a thinking model, and
`getGenerationOptions` disables thinking through `extra_body.chat_template_kwargs`,
which is a vLLM parameter that Ollama ignores — so reasoning tokens are still
generated and counted against the output budget. A small structured generation
takes roughly 20 seconds. Keep `AI_PROVIDER_MAX_CONCURRENCY=1` locally, since
Ollama serialises requests by default and the queue wait is charged to the job.

## Reverting

Comment out `AI_DEFAULT_PROVIDER` again and restart. It falls back to `openai`,
which is the schema default. The remaining `SELF_HOSTED_AI_*` values can stay
set; they are unused while another provider is selected.
