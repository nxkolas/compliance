-- Run before `db:push` to make the vector type available, then run again after
-- `db:push` to install indexes, search-vector maintenance, and the private bucket.
create extension if not exists vector with schema extensions;

do $block$
begin
  if to_regclass('public.document_chunks') is null then
    raise notice 'document_chunks is not present yet; run db:push and rerun this file';
    return;
  end if;

  create or replace function public.set_document_chunk_search_vector()
  returns trigger
  language plpgsql
  set search_path = public, pg_catalog
  as $function$
  begin
    new.search_vector := to_tsvector('simple', coalesce(new.content, ''));
    return new;
  end
  $function$;

  drop trigger if exists document_chunks_search_vector_trigger
    on public.document_chunks;
  create trigger document_chunks_search_vector_trigger
    before insert or update of content on public.document_chunks
    for each row execute function public.set_document_chunk_search_vector();

  update public.document_chunks
  set search_vector = to_tsvector('simple', coalesce(content, ''))
  where search_vector is null;

  insert into storage.buckets (id, name, public)
  values ('organization-evidence', 'organization-evidence', false)
  on conflict (id) do update set public = false;

  create or replace function public.reject_audit_event_mutation()
  returns trigger
  language plpgsql
  set search_path = public, pg_catalog
  as $function$
  begin
    raise exception 'audit_events is append-only';
  end
  $function$;

  drop trigger if exists audit_events_append_only_trigger
    on public.audit_events;
  create trigger audit_events_append_only_trigger
    before update or delete on public.audit_events
    for each row execute function public.reject_audit_event_mutation();
end
$block$;
