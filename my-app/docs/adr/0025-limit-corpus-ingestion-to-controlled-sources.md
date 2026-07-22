# Limit corpus ingestion to controlled sources

A Platform Administrator may ingest a direct upload or an exact source URL. The trusted worker records URL retrieval metadata, hashes the response, and stores an immutable private copy, but neither the AI model nor the ingestion system may perform autonomous web discovery or crawling; all source selection remains an administrator decision.
