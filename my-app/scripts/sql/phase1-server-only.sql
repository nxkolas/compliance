-- Apply after the Phase 1 Drizzle schema update. These operational tables are
-- intentionally unavailable through Supabase's browser roles.
alter table public.platform_administrators enable row level security;
alter table public.platform_audit_events enable row level security;
alter table public.background_jobs enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.api_rate_limit_windows enable row level security;
alter table public.reports enable row level security;
alter table public.report_sources enable row level security;

revoke all on table public.platform_administrators from anon, authenticated;
revoke all on table public.platform_audit_events from anon, authenticated;
revoke all on table public.background_jobs from anon, authenticated;
revoke all on table public.idempotency_records from anon, authenticated;
revoke all on table public.upload_sessions from anon, authenticated;
revoke all on table public.api_rate_limit_windows from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.report_sources from anon, authenticated;

grant all on table public.platform_administrators to service_role;
grant all on table public.platform_audit_events to service_role;
grant all on table public.background_jobs to service_role;
grant all on table public.idempotency_records to service_role;
grant all on table public.upload_sessions to service_role;
grant all on table public.api_rate_limit_windows to service_role;
grant all on table public.reports to service_role;
grant all on table public.report_sources to service_role;
