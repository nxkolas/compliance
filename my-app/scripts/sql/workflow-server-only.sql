-- Explicit defense-in-depth for workflow tables added after the original
-- application-data RLS list. Authorization remains in server services.
alter table public.gap_requirements enable row level security;
alter table public.gap_reassessment_drafts enable row level security;
alter table public.gap_reassessment_draft_documents enable row level security;

revoke all privileges on table
  public.gap_requirements,
  public.gap_reassessment_drafts,
  public.gap_reassessment_draft_documents
from anon, authenticated;

grant all privileges on table
  public.gap_requirements,
  public.gap_reassessment_drafts,
  public.gap_reassessment_draft_documents
to service_role;
