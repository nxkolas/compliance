-- Run after `npm.cmd run db:push`. Safe to run repeatedly.
do $block$
declare
  table_name text;
  definition_tables constant text[] := array[
    'content_items', 'content_revisions', 'content_translations',
    'legal_instruments', 'legal_instrument_versions', 'legal_provisions',
    'compliance_frameworks', 'compliance_framework_versions', 'compliance_modules',
    'questionnaires', 'questionnaire_versions', 'questions', 'question_options', 'question_fact_mappings',
    'organization_fact_definitions', 'organization_fact_definition_versions', 'fact_options',
    'scope_models', 'scope_model_versions', 'scope_sectors', 'scope_sector_versions',
    'scope_entity_types', 'scope_entity_type_versions', 'scope_entity_type_legal_provisions',
    'scope_threshold_sets', 'scope_threshold_set_legal_provisions',
    'jurisdiction_profiles', 'jurisdiction_profile_versions',
    'jurisdiction_entity_types', 'jurisdiction_entity_type_versions',
    'jurisdiction_entity_type_legal_provisions', 'jurisdiction_entity_type_mappings',
    'jurisdiction_profile_legal_provisions', 'jurisdiction_profile_designations',
    'jurisdiction_profile_threshold_policies', 'jurisdiction_profile_jurisdiction_rules',
    'jurisdiction_profile_effective_states', 'rule_sets', 'compliance_check_releases',
    'compliance_check_release_profiles', 'compliance_check_release_fact_versions',
    'compliance_check_release_content_revisions', 'active_compliance_check_releases',
    'compliance_check_release_activations'
  ];
begin
  foreach table_name in array definition_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required definition table public.% is missing; run db:push first', table_name;
    end if;
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
  end loop;
end
$block$;
