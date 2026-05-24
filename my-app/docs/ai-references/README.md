# AI Reference Corpus

Place curated NIS2, BSIG, BSI, or other official/legal reference excerpts here as
Markdown or plain text files. Each file must include YAML-style front matter:

```md
---
title: "Reference title"
sourceUrl: "https://official-source.example/document"
jurisdiction: "DE"
publishedAt: "2026-01-01"
version: "optional version label"
---

Reference text to embed and cite.
```

Run:

```bash
npm run ai:ingest-references
```

The script replaces an existing reference document with the same `sourceUrl` and
indexes the current file contents into `ai_document_chunks`.
