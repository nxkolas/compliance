-- Permanent audited integrity functions and triggers outside Drizzle ownership.
begin;

create or replace function public.enforce_assessment_revision_questionnaire()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.assessments a
    join public.questionnaire_versions qv
      on qv.id = new.questionnaire_version_id
    where a.id = new.assessment_id
      and a.questionnaire_id = qv.questionnaire_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'assessment revision questionnaire does not match its assessment';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_revisions_questionnaire_identity_trigger
  on public.assessment_revisions;
create constraint trigger assessment_revisions_questionnaire_identity_trigger
after insert or update of assessment_id, questionnaire_version_id
on public.assessment_revisions
deferrable initially deferred
for each row execute function public.enforce_assessment_revision_questionnaire();

create or replace function public.enforce_gap_assessment_applicability_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.applicability_artifact_revision_id is not null and not exists (
    select 1
    from public.generated_artifact_revisions revision
    join public.generated_artifacts artifact
      on artifact.id = revision.artifact_id
    where revision.id = new.applicability_artifact_revision_id
      and artifact.organization_id = new.organization_id
      and artifact.artifact_type = 'affectedness_result'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Gap assessment applicability revision has the wrong owner or type';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_applicability_owner_trigger
  on public.assessments;
create constraint trigger assessments_applicability_owner_trigger
after insert or update of organization_id, applicability_artifact_revision_id
on public.assessments
deferrable initially deferred
for each row execute function public.enforce_gap_assessment_applicability_owner();

create or replace function public.enforce_action_plan_gap_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.generated_artifact_revisions revision
    join public.generated_artifacts artifact
      on artifact.id = revision.artifact_id
    where revision.id = new.source_gap_artifact_revision_id
      and artifact.organization_id = new.organization_id
      and artifact.artifact_type = 'gap_analysis_result'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Action Plan source revision has the wrong owner or type';
  end if;
  return new;
end;
$$;

drop trigger if exists action_plans_gap_owner_trigger on public.action_plans;
create constraint trigger action_plans_gap_owner_trigger
after insert or update of organization_id, source_gap_artifact_revision_id
on public.action_plans
deferrable initially deferred
for each row execute function public.enforce_action_plan_gap_owner();

create or replace function public.enforce_action_plan_item_finding_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.action_plans plan
    join public.gap_findings finding
      on finding.id = new.source_finding_id
    where plan.id = new.action_plan_id
      and finding.artifact_revision_id = plan.source_gap_artifact_revision_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Action Plan Item source Finding does not belong to its source revision';
  end if;
  return new;
end;
$$;

drop trigger if exists action_plan_items_finding_owner_trigger
  on public.action_plan_items;
create constraint trigger action_plan_items_finding_owner_trigger
after insert or update of action_plan_id, source_finding_id
on public.action_plan_items
deferrable initially deferred
for each row execute function public.enforce_action_plan_item_finding_owner();

create or replace function public.validate_assessment_answer_value(
  target_answer_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  answer_row record;
  option_count integer;
  scalar_count integer;
  minimum_options integer;
  maximum_options integer;
begin
  select
    answer.id,
    answer.question_id,
    answer.text_value,
    answer.number_value,
    answer.boolean_value,
    answer.date_value,
    answer.structured_value,
    question.answer_type,
    question.config,
    question.questionnaire_version_id,
    revision.questionnaire_version_id as revision_questionnaire_version_id
  into answer_row
  from public.assessment_answers answer
  join public.questions question on question.id = answer.question_id
  join public.assessment_revisions revision
    on revision.id = answer.assessment_revision_id
  where answer.id = target_answer_id;

  if not found then
    return;
  end if;

  if answer_row.questionnaire_version_id
      <> answer_row.revision_questionnaire_version_id then
    raise exception using
      errcode = '23514',
      message = 'Assessment Answer Question is outside the revision questionnaire';
  end if;

  select count(*)::integer
  into option_count
  from public.assessment_answer_options
  where assessment_answer_id = target_answer_id;

  scalar_count := num_nonnulls(
    answer_row.text_value,
    answer_row.number_value,
    answer_row.boolean_value,
    answer_row.date_value,
    answer_row.structured_value
  );

  if answer_row.answer_type = 'single_choice' then
    if scalar_count <> 0 or option_count <> 1 then
      raise exception using errcode = '23514',
        message = 'single-choice Answer requires exactly one option';
    end if;
  elsif answer_row.answer_type = 'multi_choice' then
    minimum_options := coalesce(
      (answer_row.config->>'minSelections')::integer,
      1
    );
    maximum_options := coalesce(
      (answer_row.config->>'maxSelections')::integer,
      2147483647
    );
    if scalar_count <> 0
       or option_count < minimum_options
       or option_count > maximum_options then
      raise exception using errcode = '23514',
        message = 'multi-choice Answer has an invalid option count';
    end if;
  elsif answer_row.answer_type in ('text', 'long_text') then
    if answer_row.text_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'text Answer requires only text_value';
    end if;
  elsif answer_row.answer_type = 'number' then
    if answer_row.number_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'number Answer requires only number_value';
    end if;
  elsif answer_row.answer_type = 'boolean' then
    if answer_row.boolean_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'boolean Answer requires only boolean_value';
    end if;
  elsif answer_row.answer_type = 'date' then
    if answer_row.date_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'date Answer requires only date_value';
    end if;
  elsif answer_row.answer_type in ('file', 'json') then
    if answer_row.structured_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'structured Answer requires only structured_value';
    end if;
  else
    raise exception using errcode = '23514',
      message = 'unsupported Answer datatype';
  end if;
end;
$$;

create or replace function public.enforce_assessment_answer_datatype()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_assessment_answer_value(new.id);
  return new;
end;
$$;

create or replace function public.enforce_assessment_answer_option_datatype()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_assessment_answer_value(
    coalesce(new.assessment_answer_id, old.assessment_answer_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_answers_datatype_trigger
  on public.assessment_answers;
create constraint trigger assessment_answers_datatype_trigger
after insert or update
on public.assessment_answers
deferrable initially deferred
for each row execute function public.enforce_assessment_answer_datatype();

drop trigger if exists assessment_answer_options_datatype_trigger
  on public.assessment_answer_options;
create constraint trigger assessment_answer_options_datatype_trigger
after insert or update or delete
on public.assessment_answer_options
deferrable initially deferred
for each row execute function public.enforce_assessment_answer_option_datatype();

create or replace function public.validate_organization_fact_value(
  target_fact_value_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  fact_row record;
  option_count integer;
  scalar_count integer;
begin
  select
    value.id,
    value.text_value,
    value.number_value,
    value.boolean_value,
    value.structured_value,
    definition.data_type
  into fact_row
  from public.organization_fact_values value
  join public.organization_fact_definitions definition
    on definition.key = value.fact_key
  where value.id = target_fact_value_id;

  if not found then
    return;
  end if;

  select count(*)::integer
  into option_count
  from public.organization_fact_value_options
  where organization_fact_value_id = target_fact_value_id;

  scalar_count := num_nonnulls(
    fact_row.text_value,
    fact_row.number_value,
    fact_row.boolean_value,
    fact_row.structured_value
  );

  if fact_row.data_type = 'enum' then
    if scalar_count <> 0 or option_count <> 1 then
      raise exception using errcode = '23514',
        message = 'enum Fact requires exactly one option';
    end if;
  elsif fact_row.data_type = 'multi_enum' then
    if scalar_count <> 0 or option_count < 1 then
      raise exception using errcode = '23514',
        message = 'multi-enum Fact requires at least one option';
    end if;
  elsif fact_row.data_type = 'text' then
    if fact_row.text_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'text Fact requires only text_value';
    end if;
  elsif fact_row.data_type = 'number' then
    if fact_row.number_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'number Fact requires only number_value';
    end if;
  elsif fact_row.data_type = 'boolean' then
    if fact_row.boolean_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'boolean Fact requires only boolean_value';
    end if;
  elsif fact_row.data_type = 'structured' then
    if fact_row.structured_value is null
       or scalar_count <> 1
       or option_count <> 0 then
      raise exception using errcode = '23514',
        message = 'structured Fact requires only structured_value';
    end if;
  else
    raise exception using errcode = '23514',
      message = 'unsupported Fact datatype';
  end if;
end;
$$;

create or replace function public.enforce_organization_fact_datatype()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_organization_fact_value(new.id);
  return new;
end;
$$;

create or replace function public.enforce_organization_fact_option_datatype()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_organization_fact_value(
    coalesce(new.organization_fact_value_id, old.organization_fact_value_id)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_fact_values_datatype_trigger
  on public.organization_fact_values;
create constraint trigger organization_fact_values_datatype_trigger
after insert or update
on public.organization_fact_values
deferrable initially deferred
for each row execute function public.enforce_organization_fact_datatype();

drop trigger if exists organization_fact_value_options_datatype_trigger
  on public.organization_fact_value_options;
create constraint trigger organization_fact_value_options_datatype_trigger
after insert or update or delete
on public.organization_fact_value_options
deferrable initially deferred
for each row execute function public.enforce_organization_fact_option_datatype();

create or replace function public.validate_artifact_revision_sources(
  target_revision_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  owner_row record;
  assessment_count integer;
  artifact_count integer;
  document_count integer;
begin
  select revision.id, artifact.organization_id, artifact.artifact_type
  into owner_row
  from public.generated_artifact_revisions revision
  join public.generated_artifacts artifact on artifact.id = revision.artifact_id
  where revision.id = target_revision_id;

  if not found then
    return;
  end if;

  select count(*)::integer into assessment_count
  from public.artifact_revision_assessment_sources
  where artifact_revision_id = target_revision_id;
  select count(*)::integer into artifact_count
  from public.artifact_revision_artifact_sources
  where artifact_revision_id = target_revision_id;
  select count(*)::integer into document_count
  from public.artifact_revision_document_sources
  where artifact_revision_id = target_revision_id;

  if exists (
    select 1
    from public.artifact_revision_assessment_sources source
    join public.assessment_revisions revision
      on revision.id = source.assessment_revision_id
    join public.assessments assessment on assessment.id = revision.assessment_id
    where source.artifact_revision_id = target_revision_id
      and assessment.organization_id <> owner_row.organization_id
  ) or exists (
    select 1
    from public.artifact_revision_artifact_sources source
    join public.generated_artifact_revisions revision
      on revision.id = source.source_artifact_revision_id
    join public.generated_artifacts artifact on artifact.id = revision.artifact_id
    where source.artifact_revision_id = target_revision_id
      and artifact.organization_id <> owner_row.organization_id
  ) or exists (
    select 1
    from public.artifact_revision_document_sources source
    join public.document_versions version on version.id = source.document_version_id
    join public.documents document on document.id = version.document_id
    where source.artifact_revision_id = target_revision_id
      and document.organization_id <> owner_row.organization_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Artifact Revision source has the wrong tenant';
  end if;

  if owner_row.artifact_type = 'affectedness_result'
     and (assessment_count <> 1 or artifact_count <> 0 or document_count <> 0) then
    raise exception using
      errcode = '23514',
      message = 'Applicability revision requires exactly one Assessment source';
  end if;

  if owner_row.artifact_type = 'gap_analysis_result' then
    if assessment_count <> 1 or artifact_count <> 1 then
      raise exception using
        errcode = '23514',
        message = 'Gap revision requires one Assessment and one applicability Artifact source';
    end if;
    if not exists (
      select 1
      from public.artifact_revision_artifact_sources source
      join public.generated_artifact_revisions revision
        on revision.id = source.source_artifact_revision_id
      join public.generated_artifacts artifact on artifact.id = revision.artifact_id
      where source.artifact_revision_id = target_revision_id
        and artifact.artifact_type = 'affectedness_result'
    ) then
      raise exception using
        errcode = '23514',
        message = 'Gap revision Artifact source is not an applicability revision';
    end if;
  end if;
end;
$$;

create or replace function public.enforce_artifact_revision_sources()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_revision_id uuid;
begin
  target_revision_id := case when tg_op = 'DELETE'
    then old.artifact_revision_id else new.artifact_revision_id end;
  perform public.validate_artifact_revision_sources(target_revision_id);
  if tg_op = 'UPDATE' and old.artifact_revision_id <> new.artifact_revision_id then
    perform public.validate_artifact_revision_sources(old.artifact_revision_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists artifact_revision_assessment_sources_integrity_trigger
  on public.artifact_revision_assessment_sources;
create constraint trigger artifact_revision_assessment_sources_integrity_trigger
after insert or update or delete on public.artifact_revision_assessment_sources
deferrable initially deferred
for each row execute function public.enforce_artifact_revision_sources();

drop trigger if exists artifact_revision_artifact_sources_integrity_trigger
  on public.artifact_revision_artifact_sources;
create constraint trigger artifact_revision_artifact_sources_integrity_trigger
after insert or update or delete on public.artifact_revision_artifact_sources
deferrable initially deferred
for each row execute function public.enforce_artifact_revision_sources();

drop trigger if exists artifact_revision_document_sources_integrity_trigger
  on public.artifact_revision_document_sources;
create constraint trigger artifact_revision_document_sources_integrity_trigger
after insert or update or delete on public.artifact_revision_document_sources
deferrable initially deferred
for each row execute function public.enforce_artifact_revision_sources();

create or replace function public.enforce_ai_assessment_input_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.ai_processing_runs run
    join public.assessment_revisions revision
      on revision.id = new.assessment_revision_id
    join public.assessments assessment on assessment.id = revision.assessment_id
    where run.id = new.run_id
      and run.organization_id = assessment.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'AI Assessment input has the wrong tenant';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_ai_artifact_input_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.ai_processing_runs run
    join public.generated_artifact_revisions revision
      on revision.id = new.artifact_revision_id
    join public.generated_artifacts artifact on artifact.id = revision.artifact_id
    where run.id = new.run_id
      and run.organization_id = artifact.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'AI Artifact input has the wrong tenant';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_ai_document_input_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.ai_processing_runs run
    join public.document_versions version on version.id = new.document_version_id
    join public.documents document on document.id = version.document_id
    where run.id = new.run_id
      and run.organization_id = document.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'AI Document input has the wrong tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists ai_processing_run_assessment_inputs_owner_trigger
  on public.ai_processing_run_assessment_inputs;
create constraint trigger ai_processing_run_assessment_inputs_owner_trigger
after insert or update on public.ai_processing_run_assessment_inputs
deferrable initially deferred
for each row execute function public.enforce_ai_assessment_input_owner();

drop trigger if exists ai_processing_run_artifact_inputs_owner_trigger
  on public.ai_processing_run_artifact_inputs;
create constraint trigger ai_processing_run_artifact_inputs_owner_trigger
after insert or update on public.ai_processing_run_artifact_inputs
deferrable initially deferred
for each row execute function public.enforce_ai_artifact_input_owner();

drop trigger if exists ai_processing_run_document_inputs_owner_trigger
  on public.ai_processing_run_document_inputs;
create constraint trigger ai_processing_run_document_inputs_owner_trigger
after insert or update on public.ai_processing_run_document_inputs
deferrable initially deferred
for each row execute function public.enforce_ai_document_input_owner();

create or replace function public.enforce_report_source_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  valid boolean;
begin
  if tg_table_name = 'report_artifact_sources' then
    select exists (
      select 1
      from public.reports report
      join public.generated_artifact_revisions revision
        on revision.id = new.artifact_revision_id
      join public.generated_artifacts artifact on artifact.id = revision.artifact_id
      where report.id = new.report_id
        and report.organization_id = artifact.organization_id
    ) into valid;
  elsif tg_table_name = 'report_action_plan_sources' then
    select exists (
      select 1
      from public.reports report
      join public.action_plans plan on plan.id = new.action_plan_id
      where report.id = new.report_id
        and report.organization_id = plan.organization_id
    ) into valid;
  else
    select exists (
      select 1
      from public.reports report
      join public.document_versions version on version.id = new.document_version_id
      join public.documents document on document.id = version.document_id
      where report.id = new.report_id
        and report.organization_id = document.organization_id
    ) into valid;
  end if;
  if not valid then
    raise exception using errcode = '23514',
      message = 'Report source has the wrong tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists report_artifact_sources_owner_trigger
  on public.report_artifact_sources;
create constraint trigger report_artifact_sources_owner_trigger
after insert or update on public.report_artifact_sources
deferrable initially deferred
for each row execute function public.enforce_report_source_owner();

drop trigger if exists report_action_plan_sources_owner_trigger
  on public.report_action_plan_sources;
create constraint trigger report_action_plan_sources_owner_trigger
after insert or update on public.report_action_plan_sources
deferrable initially deferred
for each row execute function public.enforce_report_source_owner();

drop trigger if exists report_document_sources_owner_trigger
  on public.report_document_sources;
create constraint trigger report_document_sources_owner_trigger
after insert or update on public.report_document_sources
deferrable initially deferred
for each row execute function public.enforce_report_source_owner();

create or replace function public.validate_background_job_result(
  target_job_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  job_row record;
  result_row record;
  result_count integer;
begin
  select * into job_row from public.background_jobs where id = target_job_id;
  if not found then return; end if;
  select count(*)::integer into result_count
  from public.background_job_results where job_id = target_job_id;
  select * into result_row
  from public.background_job_results where job_id = target_job_id;

  if job_row.state = 'succeeded'
     and job_row.kind <> 'cleanup'
     and result_count <> 1 then
    raise exception using errcode = '23514',
      message = 'Succeeded job requires one typed result';
  end if;
  if job_row.state <> 'succeeded' and result_count <> 0 then
    raise exception using errcode = '23514',
      message = 'Incomplete job cannot have a result';
  end if;
  if result_count = 0 then return; end if;

  if result_row.generated_artifact_revision_id is not null and not exists (
    select 1
    from public.generated_artifact_revisions revision
    join public.generated_artifacts artifact on artifact.id = revision.artifact_id
    where revision.id = result_row.generated_artifact_revision_id
      and artifact.organization_id = job_row.organization_id
      and job_row.kind in ('gap-generation', 'gap-generation-v8', 'gap-generation-v9', 'gap-generation-v10', 'gap-generation-v11', 'gap-generation-v12')
  ) then
    raise exception using errcode = '23514',
      message = 'Job Artifact result has the wrong tenant or kind';
  end if;
  if result_row.report_id is not null and not exists (
    select 1 from public.reports report
    where report.id = result_row.report_id
      and report.organization_id = job_row.organization_id
      and job_row.kind = 'report-render'
  ) then
    raise exception using errcode = '23514',
      message = 'Job Report result has the wrong tenant or kind';
  end if;
  if result_row.action_plan_id is not null and not exists (
    select 1 from public.action_plans plan
    where plan.id = result_row.action_plan_id
      and plan.organization_id = job_row.organization_id
      and plan.generation_job_id = job_row.id
      and job_row.kind in (
        'action-plan-generation',
        'action-plan-generation-v2',
        'action-plan-generation-v3',
        'action-plan-generation-v4',
        'action-plan-generation-v5',
        'action-plan-generation-v6'
      )
  ) then
    raise exception using errcode = '23514',
      message = 'Job Action Plan result has the wrong tenant, job, or kind';
  end if;
  if (
    result_row.legal_source_rendition_id is not null
    or result_row.legal_processing_generation_id is not null
    or result_row.legal_source_monitor_id is not null
    or result_row.legal_corpus_evaluation_id is not null
  ) and job_row.organization_id is not null then
    raise exception using errcode = '23514',
      message = 'Platform corpus job result cannot belong to an Organization job';
  end if;
end;
$$;

alter table public.background_job_results
  drop constraint if exists background_job_results_exactly_one_check;
alter table public.background_job_results
  add constraint background_job_results_exactly_one_check
  check (
    num_nonnulls(
      generated_artifact_revision_id,
      report_id,
      legal_source_rendition_id,
      legal_processing_generation_id,
      legal_source_monitor_id,
      legal_corpus_evaluation_id,
      action_plan_id
    ) = 1
  );

drop index if exists public.background_jobs_action_plan_generation_active_unique;
create unique index background_jobs_action_plan_generation_active_unique
  on public.background_jobs (organization_id)
  where kind in (
    'action-plan-generation',
    'action-plan-generation-v2',
    'action-plan-generation-v3',
    'action-plan-generation-v4',
    'action-plan-generation-v5',
    'action-plan-generation-v6'
  )
  and state in ('queued', 'running', 'cancellation_requested');

create or replace function public.enforce_background_job_result()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  owner_id uuid;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old);
  else row_data := to_jsonb(new);
  end if;
  if tg_table_name = 'background_jobs' then
    owner_id := (row_data->>'id')::uuid;
  else
    owner_id := (row_data->>'job_id')::uuid;
  end if;
  perform public.validate_background_job_result(owner_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists background_jobs_result_integrity_trigger
  on public.background_jobs;
create constraint trigger background_jobs_result_integrity_trigger
after insert or update of state on public.background_jobs
deferrable initially deferred
for each row execute function public.enforce_background_job_result();

drop trigger if exists background_job_results_integrity_trigger
  on public.background_job_results;
create constraint trigger background_job_results_integrity_trigger
after insert or update or delete on public.background_job_results
deferrable initially deferred
for each row execute function public.enforce_background_job_result();

create or replace function public.validate_upload_session_result(
  target_session_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  session_row record;
  result_row record;
  result_count integer;
begin
  select * into session_row from public.upload_sessions where id = target_session_id;
  if not found then return; end if;
  select count(*)::integer into result_count
  from public.upload_session_results where session_id = target_session_id;
  select * into result_row
  from public.upload_session_results where session_id = target_session_id;

  if session_row.state = 'completed' and result_count <> 1 then
    raise exception using errcode = '23514',
      message = 'Completed Upload Session requires one typed result';
  end if;
  if session_row.state <> 'completed' and result_count <> 0 then
    raise exception using errcode = '23514',
      message = 'Incomplete Upload Session cannot have a result';
  end if;
  if result_count = 0 then return; end if;

  if result_row.document_version_id is not null and not exists (
    select 1
    from public.document_versions version
    join public.documents document on document.id = version.document_id
    where version.id = result_row.document_version_id
      and document.organization_id = session_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Upload Document result has the wrong tenant';
  end if;
  if result_row.legal_source_rendition_id is not null
     and session_row.organization_id is not null then
    raise exception using errcode = '23514',
      message = 'Legal Upload result cannot belong to an Organization session';
  end if;
end;
$$;

create or replace function public.enforce_upload_session_result()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  owner_id uuid;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old);
  else row_data := to_jsonb(new);
  end if;
  if tg_table_name = 'upload_sessions' then
    owner_id := (row_data->>'id')::uuid;
  else
    owner_id := (row_data->>'session_id')::uuid;
  end if;
  perform public.validate_upload_session_result(owner_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists upload_sessions_result_integrity_trigger
  on public.upload_sessions;
create constraint trigger upload_sessions_result_integrity_trigger
after insert or update of state on public.upload_sessions
deferrable initially deferred
for each row execute function public.enforce_upload_session_result();

drop trigger if exists upload_session_results_integrity_trigger
  on public.upload_session_results;
create constraint trigger upload_session_results_integrity_trigger
after insert or update or delete on public.upload_session_results
deferrable initially deferred
for each row execute function public.enforce_upload_session_result();

create or replace function public.validate_idempotency_record_result(
  target_record_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  record_row record;
  result_row record;
  result_count integer;
begin
  select * into record_row
  from public.idempotency_records where id = target_record_id;
  if not found then return; end if;
  select count(*)::integer into result_count
  from public.idempotency_record_results where record_id = target_record_id;
  select * into result_row
  from public.idempotency_record_results where record_id = target_record_id;

  if record_row.state = 'succeeded' and result_count <> 1 then
    raise exception using errcode = '23514',
      message = 'Succeeded idempotency record requires one typed result';
  end if;
  if record_row.state <> 'succeeded' and result_count <> 0 then
    raise exception using errcode = '23514',
      message = 'Incomplete idempotency record cannot have a result';
  end if;
  if result_count = 0 or record_row.organization_id is null then return; end if;

  if result_row.generated_artifact_revision_id is not null and not exists (
    select 1
    from public.generated_artifact_revisions revision
    join public.generated_artifacts artifact on artifact.id = revision.artifact_id
    where revision.id = result_row.generated_artifact_revision_id
      and artifact.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Artifact result has the wrong tenant';
  end if;
  if result_row.assessment_id is not null and not exists (
    select 1 from public.assessments assessment
    where assessment.id = result_row.assessment_id
      and assessment.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Assessment result has the wrong tenant';
  end if;
  if result_row.assessment_revision_id is not null and not exists (
    select 1
    from public.assessment_revisions revision
    join public.assessments assessment on assessment.id = revision.assessment_id
    where revision.id = result_row.assessment_revision_id
      and assessment.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Assessment Revision result has the wrong tenant';
  end if;
  if result_row.gap_reassessment_draft_id is not null and not exists (
    select 1 from public.gap_reassessment_drafts draft
    where draft.id = result_row.gap_reassessment_draft_id
      and draft.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency reassessment result has the wrong tenant';
  end if;
  if result_row.organization_invitation_id is not null and not exists (
    select 1 from public.organization_invitations invitation
    where invitation.id = result_row.organization_invitation_id
      and invitation.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Invitation result has the wrong tenant';
  end if;
  if result_row.organization_id is not null
     and result_row.organization_id <> record_row.organization_id then
    raise exception using errcode = '23514',
      message = 'Idempotency Organization result has the wrong tenant';
  end if;
  if result_row.action_plan_id is not null and not exists (
    select 1 from public.action_plans plan
    where plan.id = result_row.action_plan_id
      and plan.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Action Plan result has the wrong tenant';
  end if;
  if result_row.report_id is not null and not exists (
    select 1 from public.reports report
    where report.id = result_row.report_id
      and report.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Report result has the wrong tenant';
  end if;
  if result_row.document_version_id is not null and not exists (
    select 1
    from public.document_versions version
    join public.documents document on document.id = version.document_id
    where version.id = result_row.document_version_id
      and document.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Document result has the wrong tenant';
  end if;
  if result_row.background_job_id is not null and not exists (
    select 1 from public.background_jobs job
    where job.id = result_row.background_job_id
      and job.organization_id = record_row.organization_id
  ) then
    raise exception using errcode = '23514',
      message = 'Idempotency Job result has the wrong tenant';
  end if;
end;
$$;

create or replace function public.enforce_idempotency_record_result()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  owner_id uuid;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old);
  else row_data := to_jsonb(new);
  end if;
  if tg_table_name = 'idempotency_records' then
    owner_id := (row_data->>'id')::uuid;
  else
    owner_id := (row_data->>'record_id')::uuid;
  end if;
  perform public.validate_idempotency_record_result(owner_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists idempotency_records_result_integrity_trigger
  on public.idempotency_records;
create constraint trigger idempotency_records_result_integrity_trigger
after insert or update of state on public.idempotency_records
deferrable initially deferred
for each row execute function public.enforce_idempotency_record_result();

drop trigger if exists idempotency_record_results_integrity_trigger
  on public.idempotency_record_results;
create constraint trigger idempotency_record_results_integrity_trigger
after insert or update or delete on public.idempotency_record_results
deferrable initially deferred
for each row execute function public.enforce_idempotency_record_result();

create or replace function public.validate_gap_revision_finding_coverage(
  target_revision_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  release_id uuid;
  target_requirement_set_version_id uuid;
begin
  select gap_analysis_release_id into release_id
  from public.generated_artifact_revisions
  where id = target_revision_id;
  if not found or release_id is null then return; end if;

  select release.requirement_set_version_id
  into target_requirement_set_version_id
  from public.gap_analysis_releases release
  where release.id = release_id;

  if exists (
    select 1
    from public.gap_requirement_set_members member
    where member.requirement_set_version_id = target_requirement_set_version_id
      and not exists (
        select 1 from public.gap_findings finding
        where finding.artifact_revision_id = target_revision_id
          and finding.requirement_version_id = member.requirement_version_id
      )
  ) or exists (
    select 1
    from public.gap_findings finding
    where finding.artifact_revision_id = target_revision_id
      and not exists (
        select 1 from public.gap_requirement_set_members member
        where member.requirement_set_version_id = target_requirement_set_version_id
          and member.requirement_version_id = finding.requirement_version_id
      )
  ) then
    raise exception using errcode = '23514',
      message = 'Normalized Gap Findings do not exactly cover the pinned Requirement Set';
  end if;

  if exists (
    select 1
    from public.gap_findings finding
    join public.gap_requirement_versions requirement
      on requirement.id = finding.requirement_version_id
    where finding.artifact_revision_id = target_revision_id
      and finding.severity::text <> (
        case
          when finding.status = 'fulfilled' then 'low'
          when finding.status = 'insufficient_evidence'
            and requirement.criticality = 'critical' then 'high'
          when finding.status = 'insufficient_evidence'
            then requirement.criticality::text
          when finding.status = 'partially_fulfilled'
            and requirement.criticality = 'critical' then 'high'
          when finding.status = 'partially_fulfilled'
            and requirement.criticality = 'high' then 'medium'
          else requirement.criticality::text
        end
      )
  ) then
    raise exception using errcode = '23514',
      message = 'Gap Finding severity does not match status and Requirement criticality';
  end if;
end;
$$;

create or replace function public.enforce_gap_revision_finding_coverage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
  target_revision_id uuid;
begin
  changed_row := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;
  target_revision_id := (
    changed_row ->> case
      when tg_table_name = 'generated_artifact_revisions' then 'id'
      else 'artifact_revision_id'
    end
  )::uuid;
  perform public.validate_gap_revision_finding_coverage(target_revision_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists generated_artifact_revisions_finding_coverage_trigger
  on public.generated_artifact_revisions;
create constraint trigger generated_artifact_revisions_finding_coverage_trigger
after insert or update of gap_analysis_release_id
on public.generated_artifact_revisions
deferrable initially deferred
for each row execute function public.enforce_gap_revision_finding_coverage();

drop trigger if exists gap_findings_coverage_trigger on public.gap_findings;
create constraint trigger gap_findings_coverage_trigger
after insert or update or delete on public.gap_findings
deferrable initially deferred
for each row execute function public.enforce_gap_revision_finding_coverage();

create or replace function public.enforce_gap_requirement_question_mapping_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.gap_analysis_releases release
    join public.gap_requirement_set_members member
      on member.requirement_set_version_id = release.requirement_set_version_id
     and member.requirement_version_id = new.requirement_version_id
    join public.questions question on question.id = new.question_id
    where release.id = new.gap_analysis_release_id
      and question.questionnaire_version_id = release.questionnaire_version_id
  ) then
    raise exception using errcode = '23514',
      message = 'Gap requirement/question mapping crosses release ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists gap_requirement_question_mappings_owner_trigger
  on public.gap_requirement_question_mappings;
create constraint trigger gap_requirement_question_mappings_owner_trigger
after insert or update
on public.gap_requirement_question_mappings
deferrable initially deferred
for each row execute function public.enforce_gap_requirement_question_mapping_owner();

create or replace function public.enforce_open_gap_questionnaire_draft_answer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_draft_id uuid;
begin
  target_draft_id := case when tg_op = 'DELETE'
    then old.draft_id else new.draft_id end;
  if not exists (
    select 1 from public.gap_questionnaire_drafts draft
    where draft.id = target_draft_id and draft.status = 'open'
  ) then
    raise exception using errcode = '23514',
      message = 'Only open Gap questionnaire drafts are mutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists gap_questionnaire_draft_answers_open_trigger
  on public.gap_questionnaire_draft_answers;
create trigger gap_questionnaire_draft_answers_open_trigger
before insert or update or delete
on public.gap_questionnaire_draft_answers
for each row execute function public.enforce_open_gap_questionnaire_draft_answer();

create or replace function public.prevent_closed_gap_questionnaire_draft_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'open' and new is distinct from old then
    raise exception using errcode = '23514',
      message = 'Closed Gap questionnaire drafts are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists gap_questionnaire_drafts_closed_immutable_trigger
  on public.gap_questionnaire_drafts;
create trigger gap_questionnaire_drafts_closed_immutable_trigger
before update on public.gap_questionnaire_drafts
for each row execute function public.prevent_closed_gap_questionnaire_draft_mutation();

create or replace function public.prevent_assessment_requirement_evaluation_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = '23514',
    message = 'Assessment requirement evaluations are immutable';
end;
$$;

drop trigger if exists assessment_requirement_evaluations_immutable_trigger
  on public.assessment_requirement_evaluations;
create trigger assessment_requirement_evaluations_immutable_trigger
before update or delete on public.assessment_requirement_evaluations
for each row execute function public.prevent_assessment_requirement_evaluation_mutation();

drop trigger if exists assessment_revisions_guided_v4_evaluations_trigger
  on public.assessment_revisions;
drop trigger if exists assessment_revisions_guided_v6_evaluations_trigger
  on public.assessment_revisions;
drop trigger if exists assessment_requirement_evaluations_coverage_trigger
  on public.assessment_requirement_evaluations;
drop function if exists public.enforce_guided_v4_assessment_evaluations();
drop function if exists public.validate_guided_v4_assessment_evaluations(uuid);

create or replace function public.validate_guided_v6_assessment_evaluations(
  target_revision_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_release record;
  expected_count integer;
  actual_count integer;
begin
  select release.*
  into target_release
  from public.assessment_revisions revision
  join public.assessments assessment on assessment.id = revision.assessment_id
  join public.gap_analysis_releases release
    on release.id = assessment.gap_analysis_release_id
  where revision.id = target_revision_id
    and revision.status in ('submitted', 'superseded')
    and release.release_code = 'nis2-gap'
    and release.version_label = 'guided-v6';
  if not found then return; end if;

  select count(*)::integer into expected_count
  from public.gap_requirement_set_members member
  where member.requirement_set_version_id =
    target_release.requirement_set_version_id;
  select count(*)::integer into actual_count
  from public.assessment_requirement_evaluations evaluation
  where evaluation.assessment_revision_id = target_revision_id
    and evaluation.evaluator_kind = target_release.evaluator_kind
    and evaluation.evaluator_version = target_release.evaluator_version;

  if expected_count <> 10 or actual_count <> expected_count then
    raise exception using errcode = '23514',
      message = 'guided assessment requires exactly ten pinned evaluations';
  end if;
end;
$$;

create or replace function public.enforce_guided_v6_assessment_evaluations()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_revision_id uuid;
begin
  target_revision_id := case
    when tg_table_name = 'assessment_revisions'
      then (to_jsonb(new) ->> 'id')::uuid
    else (to_jsonb(new) ->> 'assessment_revision_id')::uuid
  end;
  perform public.validate_guided_v6_assessment_evaluations(target_revision_id);
  return new;
end;
$$;

create constraint trigger assessment_revisions_guided_v6_evaluations_trigger
after insert or update of status on public.assessment_revisions
deferrable initially deferred
for each row execute function public.enforce_guided_v6_assessment_evaluations();

create constraint trigger assessment_requirement_evaluations_coverage_trigger
after insert on public.assessment_requirement_evaluations
deferrable initially deferred
for each row execute function public.enforce_guided_v6_assessment_evaluations();

commit;
