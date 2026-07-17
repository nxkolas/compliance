-- Run after 002. The function physically removes only expired, unclaimed guest sessions.
create or replace function public.cleanup_expired_guest_applicability_checks()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  delete from public.guest_applicability_checks
  where
    (status = 'started' and expires_at <= now())
    or
    (status = 'submitted' and coalesce(claim_expires_at, expires_at) <= now());

  get diagnostics deleted_count = row_count;
  return deleted_count;
end
$function$;

revoke all on function public.cleanup_expired_guest_applicability_checks() from public;
revoke all on function public.cleanup_expired_guest_applicability_checks() from anon, authenticated;

do $block$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into existing_job_id
    from cron.job
    where jobname = 'compliance-guest-retention-daily';

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
      'compliance-guest-retention-daily',
      '17 3 * * *',
      'select public.cleanup_expired_guest_applicability_checks();'
    );
  else
    raise notice 'pg_cron is unavailable; invoke public.cleanup_expired_guest_applicability_checks() daily using the documented fallback';
  end if;
end
$block$;
