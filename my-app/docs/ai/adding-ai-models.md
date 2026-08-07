# AI models and providers

The application has exactly two provider modes, and they differ in more than
which endpoint gets called.

| Mode | Who runs the model | Who chooses the model |
| --- | --- | --- |
| `openai` | the server | the deployment |
| `self_hosted` | the customer | the organization |

`self_hosted` splits again by whether the server can reach the model. An
organization that has recorded its own models in `organization_model_settings`
is reached through its browser, because a deployed function cannot connect to
someone's `127.0.0.1`. One without that row uses the deployment's
`SELF_HOSTED_AI_*` endpoint directly, which is the development and
on-premises path. `resolveOrganizationEmbeddingConfig` (embeddings) and
`configuredProviders` (generation) are
where that fork is decided.

Adding a *third* provider mode is a larger change than it looks and is not
currently intended. What follows covers the two things that do come up.

## Changing the model for an OpenAI deployment

No code changes. Set the environment variables:

```env
OPENAI_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_SMALL_MODEL=gpt-5-mini
AI_EMBEDDING_DIM=1536
```

The optional `*_SMALL_MODEL` is used for chat summaries. If it is missing, chat
still works and summary generation is skipped.

Changing `OPENAI_EMBEDDING_MODEL` changes the vector space. See "Embedding
identity" below — it is not a free swap.

## Changing the model an organization runs itself

Through the local model panel in organization settings, not through
configuration. The connect probe records what the models actually do, because
declaring a capability is not the same as having it: a model that ignores a JSON
schema returns HTTP 200 with invented keys, and nothing downstream can tell that
apart from a model that simply answered badly. A model failing the schema probe
cannot be saved.

The generation model and the embedding model are independent:

- **Generation** changes take effect immediately. Nothing stored depends on
  which model wrote it.
- **Embedding** changes stage a migration. Every stored vector was produced by
  the previous model, so the organization's active coordinates advance only once
  a re-index has rebuilt them, in the same transaction that finishes it.

## Embedding identity

A vector's identity is the tuple hashed into `embedding_key`
([document-config.ts](../../src/server/documents/document-config.ts)):

- model
- model revision
- dimensions
- retrieval instruction profile
- chunking version

Retrieval filters on that key, so vectors from any other configuration are
excluded rather than scored. This is what turns a half-finished re-index into
missing results instead of confident nonsense.

Two rules follow:

- **Every write of those columns goes through `embeddingIdentityColumns`.**
  Writing the key without its components, or the reverse, produces a row whose
  stored identity and stored hash disagree.
- **Adding a field to `EmbeddingCoordinates` invalidates every stored vector.**
  The hash lists its fields explicitly rather than spreading the type, so that
  has to be a deliberate decision rather than a side effect of widening a type.

Dimensions are no longer fixed. `document_chunks.embedding` is an undimensioned
pgvector column and each row stores its native width. The cost is that no single
ANN index can cover heterogeneous widths; there is no ANN index today, so
nothing regressed, but that is the constraint to weigh before adding one.

## Retrieval instruction profiles

Some embedding families expect an instruction prefix on query text and none on
document text. The profile is part of the embedding identity, because a document
embedded without the prefix and a query embedded with it are not comparable.

Supported profiles are in
[embeddings.ts](../../src/server/documents/embeddings.ts):
`none`, `qwen3-query-v1`, `e5-query-v1`. Adding one means adding a branch there
and an option to the settings contract — and it is a vector-invalidating change
for any organization that switches to it.

## Generation concurrency and batching

```env
AI_CATEGORY_CONCURRENCY=3
AI_PROVIDER_MAX_CONCURRENCY=3
AI_EMBEDDING_BATCH_SIZE=64
```

- `AI_CATEGORY_CONCURRENCY` accepts 1-5 and controls how many category workers
  can prepare and generate concurrently inside one job.
- `AI_PROVIDER_MAX_CONCURRENCY` accepts 1-100 and limits simultaneous chat
  provider calls across Gap, Action Plan, repair, correction, and guidance work
  in one Node.js process. It does not limit embeddings and does not coordinate
  permits between application instances. The permit is released when a
  browser-relayed call suspends, so a client wait never holds a slot.
- `AI_EMBEDDING_BATCH_SIZE` accepts 1-512 and controls how many initial Gap
  retrieval queries are sent in one embedding request. For a browser-relayed
  organization this is also the size of one round trip to the client.

## Verification

```bash
npm run test:ai
npm run build
```

Then manually check:

- Both provider options appear in organization settings.
- Gap analysis completes for an `openai` organization with no
  `client_inference_requests` row created.
- The local model panel's probe rejects a model that ignores JSON schemas.
- Changing an organization's embedding model stages a migration; changing its
  generation model does not.

## Common failure modes

- `OPENAI_MODEL is not configured`: the chat model env var is missing.
- Embedding request fails: the provider does not expose an embedding model
  through the configured SDK.
- `Embedding model returned N dimensions, but the configuration declares M`: the
  declared width does not match the model. Truncation was removed deliberately;
  fix the declaration rather than reintroducing it.
- No RAG sources: documents were never indexed, the re-index has not finished,
  or the organization's embedding key changed and the rebuild is still running.
- Gap analysis parked forever: a `self_hosted` organization with no browser
  connected. The gap screen shows "Waiting for a connected browser"; connect
  once from the local model panel and keep the app open in a tab. Check
  `client_inference_requests` for rows stuck at `pending`.
