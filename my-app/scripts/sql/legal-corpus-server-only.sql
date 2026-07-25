-- Apply after pushing the legal-corpus schema. Corpus and grounding provenance
-- are available only through authorized server services.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'active_legal_corpus_releases',
    'ai_processing_run_claim_context',
    'ai_processing_run_claims',
    'ai_processing_run_context',
    'ai_processing_run_legal_inputs',
    'compliance_check_release_corpus_releases',
    'gap_analysis_release_corpus_releases',
    'legal_corpus_families',
    'legal_corpus_evaluations',
    'legal_corpus_release_activations',
    'legal_corpus_release_members',
    'legal_corpus_releases',
    'legal_source_change_alerts',
    'legal_source_chunk_embeddings',
    'legal_source_chunks',
    'legal_source_monitor_checks',
    'legal_source_monitors',
    'legal_source_processing_generations',
    'legal_source_renditions',
    'legal_source_versions',
    'legal_sources',
    'organization_ai_provider_policies'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;
