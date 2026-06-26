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

Reference ingestion is disabled in the org-only v1 schema because the AI
document and chunk tables have been removed. Reintroduce ingestion when the new
document/artifact schema is added.
