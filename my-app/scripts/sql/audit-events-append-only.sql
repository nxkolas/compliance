-- Audit events are append-only for every database role, including service_role.
create or replace function public.reject_audit_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit events are append-only' using errcode = '55000';
end;
$$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.reject_audit_event_mutation();

drop trigger if exists platform_audit_events_append_only on public.platform_audit_events;
create trigger platform_audit_events_append_only
before update or delete on public.platform_audit_events
for each row execute function public.reject_audit_event_mutation();

revoke all on function public.reject_audit_event_mutation() from public, anon, authenticated;
