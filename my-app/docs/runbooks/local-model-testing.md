# Local model testing

Optional. Development normally runs against OpenAI; this runbook is only for
exercising the `self_hosted` provider path against a host-run Ollama.

There is no Docker involved. Ollama runs natively on the host and the
application reaches it over loopback.

## Setup

Install Ollama, then pull the two models:

```powershell
ollama pull qwen3.5:9b-q4_K_M
ollama pull qwen3-embedding:4b-q4_K_M
```

Ollama listens on `127.0.0.1:11434` and serves an OpenAI-compatible API at
`/v1`. Confirm it is up:

```powershell
curl http://127.0.0.1:11434/v1/models
```

Uncomment the `# Local/self-hosted` block in `.env.local`, then restart
`npm run dev` and `npm run worker:local`.

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

`SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS` starts at `false`. The previous
value of `true` described LiteLLM in front of vLLM, not Ollama directly. Raise
it only after confirming structured generation works.

## Mixed embeddings will corrupt retrieval

Document retrieval filters on organization, document version, indexing status,
and a non-null embedding. It does **not** filter on `embedding_model`
([retrieval.ts](../../src/server/documents/retrieval.ts)). OpenAI and Qwen
vectors occupy different spaces, so a single organization holding both returns
meaningless cosine similarities without any error.

`document_versions.embedding_model` records which model produced each row, so
the damage is detectable after the fact:

```sql
select embedding_model, count(*)
from document_versions
where indexing_status = 'succeeded'
group by embedding_model;
```

More than one row means the organization's vectors are mixed.

Before switching providers, pick one:

- test against a separate database, or
- test with a throwaway organization whose documents are all re-indexed after
  the switch, or
- re-embed existing documents.

Switching back to OpenAI has the same problem in reverse.

The legal corpus path is safe: it compares the active embedder against the
recorded generation and refuses to mix
([processing-service.ts](../../src/server/corpus/processing-service.ts)).

## Reverting

Comment the block out again. `AI_DEFAULT_PROVIDER` falls back to `openai`,
which is the schema default.
