-- Additive integrity changes introduced after the initial API/corpus schema rollout.
alter table if exists public.reports
  add column if not exists output_hash text;

alter table if exists public.reports
  drop constraint if exists reports_output_check;

alter table if exists public.reports
  add constraint reports_output_check
  check (
    state <> 'ready'
    or (
      storage_bucket is not null
      and storage_path is not null
      and output_hash is not null
      and file_size is not null
    )
  ) not valid;

alter table if exists public.reports
  validate constraint reports_output_check;

-- Drizzle can add the legal-source column and enum value without replacing an
-- existing named check constraint. Rebuild it explicitly so corpus citations
-- are accepted while every evidence row still has exactly one source.
alter table if exists public.gap_finding_evidence
  drop constraint if exists gap_finding_evidence_source_check;

alter table if exists public.gap_finding_evidence
  add constraint gap_finding_evidence_source_check
  check (
    (
      source_type = 'assessment_answer'
      and assessment_answer_id is not null
      and document_chunk_id is null
      and legal_source_chunk_id is null
    ) or (
      source_type = 'document_chunk'
      and assessment_answer_id is null
      and document_chunk_id is not null
      and legal_source_chunk_id is null
    ) or (
      source_type = 'legal_source_chunk'
      and assessment_answer_id is null
      and document_chunk_id is null
      and legal_source_chunk_id is not null
    )
  ) not valid;

alter table if exists public.gap_finding_evidence
  validate constraint gap_finding_evidence_source_check;

alter table if exists public.legal_source_change_alerts
  add column if not exists version integer not null default 1;

alter table if exists public.legal_source_processing_generations
  add column if not exists embedding_job_id uuid references public.background_jobs(id) on delete restrict;

alter table if exists public.ai_processing_runs
  add column if not exists provenance_status text;

alter table if exists public.ai_processing_runs
  add column if not exists validated_output jsonb;

create unique index if not exists background_jobs_cleanup_active_unique
  on public.background_jobs (kind)
  where kind = 'cleanup' and state in ('queued', 'running', 'cancellation_requested');

create unique index if not exists background_jobs_legal_monitor_active_unique
  on public.background_jobs ((payload ->> 'monitorId'))
  where kind = 'legal-source-monitor'
    and state in ('queued', 'running', 'cancellation_requested');

-- Organizations created before provider-policy provisioning receive the
-- conservative internal-only default. Organizations without an active owner
-- remain fail-closed and require operator repair.
with policy_candidates as (
  select organization_row.id as organization_id, owner_row.user_id as updated_by
  from public.organizations organization_row
  join lateral (
    select membership_row.user_id
    from public.organization_memberships membership_row
    where membership_row.organization_id = organization_row.id
      and membership_row.role = 'owner'
      and membership_row.status = 'active'
    order by membership_row.created_at, membership_row.id
    limit 1
  ) owner_row on true
  left join public.organization_ai_provider_policies policy_row
    on policy_row.organization_id = organization_row.id
  where policy_row.organization_id is null
), inserted_policies as (
  insert into public.organization_ai_provider_policies (
    organization_id,
    allowed_provider_modes,
    external_disclosure_allowed,
    retention_classification,
    updated_by
  )
  select
    candidate.organization_id,
    '["company_hosted", "self_hosted"]'::jsonb,
    false,
    'internal_no_external_disclosure',
    candidate.updated_by
  from policy_candidates candidate
  on conflict (organization_id) do nothing
  returning organization_id, updated_by
)
insert into public.audit_events (
  organization_id,
  actor_user_id,
  event_type,
  entity_type,
  entity_id,
  metadata
)
select
  inserted.organization_id,
  inserted.updated_by,
  'organization.ai_provider_policy.backfilled',
  'organization',
  inserted.organization_id,
  jsonb_build_object(
    'allowedProviderModes', jsonb_build_array('company_hosted', 'self_hosted'),
    'externalDisclosureAllowed', false,
    'retentionClassification', 'internal_no_external_disclosure'
  )
from inserted_policies inserted;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_processing_runs' and column_name = 'provider_policy_version'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_processing_runs' and column_name = 'corpus_release_set_hash'
  ) then
    execute $sql$
      update public.ai_processing_runs
      set provenance_status = case
        when provider_policy_version is null or corpus_release_set_hash is null then 'historical_unknown'
        else 'complete'
      end
      where provenance_status is null
    $sql$;
  else
    update public.ai_processing_runs
    set provenance_status = 'historical_unknown'
    where provenance_status is null;
  end if;
end $$;

alter table if exists public.ai_processing_runs
  alter column provenance_status set default 'complete',
  alter column provenance_status set not null;

alter table if exists public.ai_processing_runs
  drop constraint if exists ai_processing_runs_provenance_status_check;
alter table if exists public.ai_processing_runs
  add constraint ai_processing_runs_provenance_status_check
  check (provenance_status in ('complete', 'historical_unknown'));

-- A translated rendition must identify an official rendition from the exact
-- same immutable source version. The service validates this too; these
-- constraints protect privileged and future write paths.
alter table if exists public.legal_source_renditions
  drop constraint if exists legal_source_renditions_translation_check;

alter table if exists public.legal_source_renditions
  add constraint legal_source_renditions_translation_check
  check (
    (translation_status = 'official' and authoritative_rendition_id is null)
    or
    (translation_status <> 'official' and authoritative_rendition_id is not null)
  ) not valid;

alter table if exists public.legal_source_renditions
  validate constraint legal_source_renditions_translation_check;

create unique index if not exists legal_source_renditions_id_version_unique
  on public.legal_source_renditions (id, source_version_id);

do $block$
declare old_constraint text;
begin
  for old_constraint in
    select constraint_row.conname
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = any (constraint_row.conkey)
    where constraint_row.conrelid = 'public.legal_source_renditions'::regclass
      and constraint_row.contype = 'f'
      and array_length(constraint_row.conkey, 1) = 1
      and attribute_row.attname = 'authoritative_rendition_id'
  loop
    execute format(
      'alter table public.legal_source_renditions drop constraint %I',
      old_constraint
    );
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.legal_source_renditions'::regclass
      and conname = 'legal_source_renditions_authority_version_fk'
  ) then
    alter table public.legal_source_renditions
      add constraint legal_source_renditions_authority_version_fk
      foreign key (authoritative_rendition_id, source_version_id)
      references public.legal_source_renditions (id, source_version_id)
      on delete restrict;
  end if;
end
$block$;

create or replace function public.enforce_legal_rendition_authority()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare authority_status public.legal_translation_status;
begin
  if new.translation_status = 'official' then
    if new.authoritative_rendition_id is not null then
      raise exception 'Official renditions cannot reference an authoritative rendition';
    end if;
    return new;
  end if;

  select translation_status
    into authority_status
  from public.legal_source_renditions
  where id = new.authoritative_rendition_id
    and source_version_id = new.source_version_id;

  if authority_status is distinct from 'official'::public.legal_translation_status then
    raise exception 'Translated renditions must reference an official rendition from the same source version';
  end if;
  return new;
end
$function$;

drop trigger if exists legal_source_rendition_authority_integrity
  on public.legal_source_renditions;
create trigger legal_source_rendition_authority_integrity
before insert or update of translation_status, authoritative_rendition_id, source_version_id
on public.legal_source_renditions
for each row execute function public.enforce_legal_rendition_authority();

alter table if exists public.legal_source_processing_generations
  drop constraint if exists legal_processing_review_check;

alter table if exists public.legal_source_processing_generations
  add constraint legal_processing_review_check
  check (
    state <> 'reviewed'
    or (
      reviewer_id is not null
      and reviewed_at is not null
      and reliable_anchors
      and extraction_hash is not null
      and normalized_text_hash is not null
      and embedding_job_id is not null
    )
  ) not valid;

alter table if exists public.legal_source_processing_generations
  validate constraint legal_processing_review_check;

create or replace function public.enforce_legal_processing_review_complete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare embedding_state public.background_job_state;
declare chunk_count bigint;
declare embedding_count bigint;
begin
  if new.state <> 'reviewed' then return new; end if;

  select state into embedding_state
  from public.background_jobs
  where id = new.embedding_job_id;

  select count(chunk_row.id), count(embedding_row.chunk_id)
    into chunk_count, embedding_count
  from public.legal_source_chunks chunk_row
  left join public.legal_source_chunk_embeddings embedding_row
    on embedding_row.generation_id = new.id
    and embedding_row.chunk_id = chunk_row.id
  where chunk_row.generation_id = new.id;

  if embedding_state is distinct from 'succeeded'::public.background_job_state
    or chunk_count = 0
    or embedding_count <> chunk_count then
    raise exception 'Reviewed processing generations require a succeeded embedding job and complete chunk coverage';
  end if;
  return new;
end
$function$;

drop trigger if exists legal_processing_review_complete
  on public.legal_source_processing_generations;
create trigger legal_processing_review_complete
before insert or update of state, embedding_job_id
on public.legal_source_processing_generations
for each row execute function public.enforce_legal_processing_review_complete();
