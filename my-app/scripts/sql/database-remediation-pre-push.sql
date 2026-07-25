-- Convert pre-existing unique indexes into referenced unique constraints
-- before Drizzle creates typed foreign keys during the coordinated cutover.
drop table if exists public.artifact_revision_sources cascade;
drop table if exists public.ai_processing_run_inputs cascade;
drop table if exists public.report_sources cascade;
drop type if exists public.artifact_revision_source_type;

do $block$
declare
  prerequisite record;
  existing_columns text[];
  expected_columns text[];
begin
  -- Existing databases receive ALTER TABLE statements in dependency order that
  -- differs from a from-empty CREATE. Materialize every new composite identity
  -- before Drizzle adds the foreign keys that reference it.
  for prerequisite in
    select *
    from (
      values
        ('fact_options', 'fact_options_definition_id_unique', 'fact_definition_key, id'),
        ('organization_fact_values', 'organization_fact_values_id_fact_unique', 'id, fact_key'),
        ('questionnaires', 'questionnaires_id_module_unique', 'id, module_id'),
        ('questionnaire_versions', 'questionnaire_versions_id_questionnaire_unique', 'id, questionnaire_id'),
        ('questions', 'questions_id_stable_key_unique', 'id, stable_key'),
        ('question_options', 'question_options_question_id_unique', 'question_id, id'),
        ('assessment_revisions', 'assessment_revisions_owner_identity_unique', 'assessment_id, id'),
        ('assessment_answers', 'assessment_answers_id_question_unique', 'id, question_id'),
        ('compliance_check_releases', 'compliance_check_releases_check_id_unique', 'check_code, id'),
        ('compliance_check_releases', 'compliance_check_releases_id_identity_unique', 'id, module_id, questionnaire_id'),
        ('generated_artifact_revisions', 'generated_artifact_revisions_owner_identity_unique', 'artifact_id, id'),
        ('gap_analysis_releases', 'gap_analysis_releases_code_id_unique', 'release_code, id'),
        ('gap_analysis_releases', 'gap_analysis_releases_id_identity_unique', 'id, module_id, questionnaire_id'),
        ('document_versions', 'document_versions_owner_identity_unique', 'document_id, id'),
        ('gap_findings', 'gap_findings_revision_identity_unique', 'artifact_revision_id, id'),
        ('legal_corpus_releases', 'legal_corpus_releases_family_id_unique', 'family_id, id')
    ) as prerequisites(table_name, constraint_name, column_list)
  loop
    if to_regclass(format('public.%I', prerequisite.table_name)) is not null then
      expected_columns := string_to_array(
        replace(prerequisite.column_list, ' ', ''),
        ','
      );
      select array_agg(attribute.attname order by key_column.ordinality)
      into existing_columns
      from pg_constraint constraint_row
      cross join lateral unnest(constraint_row.conkey)
        with ordinality as key_column(attnum, ordinality)
      join pg_attribute attribute
        on attribute.attrelid = constraint_row.conrelid
       and attribute.attnum = key_column.attnum
      where constraint_row.conrelid =
          to_regclass(format('public.%I', prerequisite.table_name))
        and constraint_row.conname = prerequisite.constraint_name
        and constraint_row.contype = 'u';

      if existing_columns is not null
        and existing_columns <> expected_columns
      then
        execute format(
          'alter table public.%I drop constraint %I',
          prerequisite.table_name,
          prerequisite.constraint_name
        );
        existing_columns := null;
      end if;

      if not exists (
        select 1
        from pg_constraint
        where conrelid = to_regclass(format('public.%I', prerequisite.table_name))
          and conname = prerequisite.constraint_name
          and contype = 'u'
      )
      then
        execute format(
          'drop index if exists public.%I',
          prerequisite.constraint_name
        );
        execute format(
          'alter table public.%I add constraint %I unique (%s)',
          prerequisite.table_name,
          prerequisite.constraint_name,
          prerequisite.column_list
        );
      end if;
    end if;
  end loop;

  if to_regclass('public.platform_administrators') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = to_regclass('public.platform_administrators')
        and conname = 'platform_administrators_user_unique'
        and contype = 'u'
    )
  then
    drop index if exists public.platform_administrators_user_unique;
    alter table public.platform_administrators
      add constraint platform_administrators_user_unique unique (user_id);
  end if;

  if to_regclass('public.legal_source_renditions') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = to_regclass('public.legal_source_renditions')
        and conname = 'legal_source_renditions_id_version_unique'
        and contype = 'u'
    )
  then
    alter table public.legal_source_renditions
      drop constraint if exists legal_source_renditions_authority_version_fk;
    drop index if exists public.legal_source_renditions_id_version_unique;
    alter table public.legal_source_renditions
      add constraint legal_source_renditions_id_version_unique
      unique (id, source_version_id);
    alter table public.legal_source_renditions
      add constraint legal_source_renditions_authority_version_fk
      foreign key (authoritative_rendition_id, source_version_id)
      references public.legal_source_renditions (id, source_version_id)
      on delete restrict;
  end if;
end
$block$;
