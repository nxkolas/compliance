-- Run after 001. Authorization remains in server APIs; no browser policies are created.
do $block$
declare
  table_name text;
  application_tables constant text[] := array[
    'organizations', 'organization_memberships', 'organization_invitations',
    'organization_fact_values', 'organization_fact_value_options',
    'assessments', 'assessment_revisions', 'assessment_answers', 'assessment_answer_options',
    'generated_artifacts', 'generated_artifact_revisions', 'artifact_revision_sources',
    'nis2_result_projections', 'guest_applicability_checks',
    'documents', 'document_versions', 'document_extractions', 'document_chunks',
    'document_embedding_generations', 'document_chunk_embeddings',
    'ai_processing_runs', 'ai_processing_run_inputs',
    'gap_findings', 'gap_finding_evidence', 'gap_finding_review_resolutions',
    'action_plans', 'action_plan_items', 'audit_events'
  ];
begin
  foreach table_name in array application_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required application table public.% is missing; run db:push first', table_name;
    end if;
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
  end loop;
end
$block$;
