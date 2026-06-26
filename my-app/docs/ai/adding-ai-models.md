# Adding AI Models or Providers

This app treats provider selection as a small closed set. A provider is not only a chat model: it also owns embeddings for RAG, model capability defaults, UI labels, and environment configuration.

Use this checklist when adding a new provider or exposing a new model behind an existing provider.

## Choose The Integration Type

### Add a model to an existing provider

If the new model is available from an already supported provider, you usually do not need code changes.

Set the model environment variable:

```env
OPENAI_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_SMALL_MODEL=gpt-5-mini
```

For OpenAI-compatible services:

```env
COMPANY_AI_MODEL=qwen3-vl-32b
COMPANY_AI_EMBEDDING_MODEL=bge-m3
COMPANY_AI_SMALL_MODEL=qwen3-vl-8b
```

The optional `*_SMALL_MODEL` is used for chat summaries. If it is missing, chat still works and summary generation is skipped.

### Add a new provider

Add a new provider only when it needs a distinct API key, base URL, SDK factory, UI option, or capability profile.

## Files To Update

### 1. Provider enum

Add the provider id to `aiProviderModes`:

```ts
// lib/ai/types.ts
export const aiProviderModes = [
  "company_hosted",
  "openai",
  "self_hosted",
  "new_provider",
] as const;
```

This controls API validation for `/api/chat` and document upload requests.

### 2. Provider factory

Add a factory in `lib/ai/providers.ts`.

For an OpenAI-compatible endpoint, prefer `createOpenAICompatible`:

```ts
export function getNewProvider() {
  return createOpenAICompatible({
    name: "new-provider",
    baseURL: requireAbsoluteUrl("NEW_PROVIDER_BASE_URL"),
    apiKey: requireEnv("NEW_PROVIDER_API_KEY"),
  });
}
```

For an official SDK, add the package to `package.json`, import its factory, and wrap missing configuration in `ApiError` the same way the existing providers do.

### 3. Model resolution

Wire chat, embedding, and small-model env vars in `lib/ai/models.ts`:

```ts
if (providerMode === "new_provider") {
  return getNewProvider()(modelId);
}
```

Add matching env variables:

```env
NEW_PROVIDER_MODEL=provider-chat-model
NEW_PROVIDER_EMBEDDING_MODEL=provider-embedding-model
NEW_PROVIDER_SMALL_MODEL=provider-small-chat-model
```

Only expose providers that can support the app's RAG flow. The selected provider is used for both chat and embeddings.

### 4. Capability profile

Add defaults in `lib/ai/model-capabilities.ts`:

```ts
new_provider: {
  supportsStreaming: true,
  supportsStructuredOutputs: false,
  supportsToolCalls: false,
  maxContextTokens: 32000,
  recommendedTemperature: 0.15,
  citationReliability: "medium",
},
```

If `providerEnvPrefix()` cannot derive the env prefix cleanly, add a branch for it. These overrides are supported:

```env
NEW_PROVIDER_MAX_CONTEXT_TOKENS=32000
NEW_PROVIDER_RECOMMENDED_TEMPERATURE=0.15
NEW_PROVIDER_CITATION_RELIABILITY=medium
NEW_PROVIDER_SUPPORTS_STREAMING=true
NEW_PROVIDER_SUPPORTS_STRUCTURED_OUTPUTS=false
NEW_PROVIDER_SUPPORTS_TOOL_CALLS=false
```

### 5. UI and labels

Add labels in both dictionaries in `lib/i18n.ts`:

```ts
providers: {
  companyHosted: "Complyx hosted",
  openai: "OpenAI",
  selfHosted: "Self-hosted",
  newProvider: "New provider",
},
```

Add the dropdown option in `components/ai/assistant-chat.tsx`:

```tsx
<SelectItem value="new_provider">
  {labels.providers.newProvider}
</SelectItem>
```

### 6. Default provider

Set the default in the environment:

```env
AI_DEFAULT_PROVIDER=new_provider
```

`getDefaultAiProviderMode()` falls back to `openai` if the value is missing or not listed in `aiProviderModes`.

## Embedding Dimension Rule

All rows in `ai_document_chunks.embedding` share one pgvector dimension:

```env
AI_EMBEDDING_DIM=1536
```

Every embedding model used in the same deployment must return that dimension. If a new provider uses a different embedding dimension, do not mix it into the same table without a schema change. Options include:

- Use one embedding dimension across all providers.
- Re-index all documents after changing `AI_EMBEDDING_DIM`.
- Add separate embedding storage per provider/model.

## Reference Ingestion

Reference ingestion is disabled in the org-only v1 schema because the AI
document tables are not active. When document storage returns, curated reference
ingestion should use the selected embedding provider and re-index stored
references after embedding model or dimension changes.

## Verification

Run:

```bash
npm run test:ai
npm run build
```

Then manually check:

- The provider appears in the assistant dropdown.
- `/api/chat` accepts the provider id.
- Document upload succeeds with the provider selected.
- RAG answers include sources after documents or references are indexed.
- The debug page shows reasonable model capabilities for the selected default provider.

## Common Failure Modes

- `NEW_PROVIDER_MODEL is not configured`: the chat model env var is missing.
- Embedding request fails: the provider does not expose an embedding model through the configured SDK.
- pgvector dimension error: the embedding model output dimension does not match `AI_EMBEDDING_DIM`.
- No RAG sources: references were not ingested, the uploaded document failed processing, or the selected provider uses incompatible embeddings.
- Provider does not appear in UI: the enum was updated but the dropdown labels/options were not.
