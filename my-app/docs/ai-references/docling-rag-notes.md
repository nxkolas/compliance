# Docling And RAG Notes

## Short Decision

Docling is worth implementing for the Compliance Checker, but it should be used as the document parsing/scanning layer, not as the RAG engine itself.

Recommended role:

```txt
PDF/DOCX/images/scans
-> Docling extracts structured Markdown/text/tables/OCR
-> app chunks extracted text
-> selected provider's embedding model creates vectors
-> pgvector retrieves matching chunks
-> selected chat model answers
```

Docling should not replace embeddings, pgvector retrieval, or the selected chat model.

## Why It Helps

The current parser path is good enough for simple digital documents:

```txt
PDF/DOCX/TXT/MD
-> pdf-parse / mammoth / raw text
-> chunks
-> embeddings
-> pgvector search
-> chat answer
```

Docling becomes useful for compliance evidence because those files often include:

- scanned PDFs
- tables
- annexes
- forms
- headers and footers
- complex reading order
- layout-heavy policies
- screenshots or image-based evidence

Better document extraction improves RAG quality before the model sees anything.

## Recommended Architecture

Do not run Docling directly inside the Next.js API route. It is Python-heavy, may need OCR/model dependencies, and can be slow.

Use a separate service/container:

```txt
Next.js app
-> upload file to Supabase Storage
-> call docling-service /parse
-> receive Markdown + metadata
-> chunk + embed
-> store in ai_document_chunks
```

This keeps the web app responsive and makes customer-side deployments cleaner.

## Rollout Plan

### v1

Keep the current parser path as the fast default:

- `pdf-parse` for simple PDFs
- `mammoth` for DOCX
- raw text for TXT/MD

### v1.5

Add Docling as an optional parser for:

- scanned PDFs
- image-heavy PDFs
- files where table extraction matters
- files where current extraction returns too little text

### v2

Run Docling as a dedicated worker/service and route difficult documents to it automatically.

## Provider Model Rule

The user selects one AI provider for the app. That selected provider should own both chat and embeddings.

Important distinction:

```txt
Chat model = writes answers
Embedding model = searches documents
Docling = parses documents
```

The chat model and embedding model should come from the same selected provider/API service, but they are usually different models.

Example:

```env
COMPANY_AI_BASE_URL=https://your-hosted-ai.example.com/v1
COMPANY_AI_API_KEY=...
COMPANY_AI_MODEL=qwen3-vl-32b
COMPANY_AI_EMBEDDING_MODEL=bge-m3
```

For local/self-hosted:

```env
SELF_HOSTED_AI_BASE_URL=http://localhost:8000/v1
SELF_HOSTED_AI_API_KEY=...
SELF_HOSTED_AI_MODEL=qwen3-vl-4b
SELF_HOSTED_AI_EMBEDDING_MODEL=nomic-embed-text
```

## Planned Stack Fit

Possible chat models:

- Hosted: Qwen3-VL-32B or Gemma 4 31B
- Local: Gemma 4 E4B or Qwen3-VL-4B

Document parser:

- Docling

Embedding model:

- A separate embedding model exposed by the same selected provider/API service

## Notes

All embedding models used with the same `ai_document_chunks.embedding` column must output the configured vector dimension.

Current schema uses:

```env
AI_EMBEDDING_DIM=1536
```

If different providers use different embedding dimensions, the schema will need to change, for example by using separate embedding tables per provider/model or storing embedding model metadata and enforcing one dimension per deployment.

