-- Run after pgvector is installed and the legal corpus tables exist.
create index if not exists legal_source_chunk_embeddings_hnsw_idx
  on public.legal_source_chunk_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists document_chunk_embeddings_hnsw_idx
  on public.document_chunk_embeddings
  using hnsw (embedding vector_cosine_ops);

analyze public.legal_source_chunks;
analyze public.legal_source_chunk_embeddings;
