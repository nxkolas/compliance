-- Additive organization-management identity projection.
-- Safe to rerun; no organization or membership rows are modified.
create table if not exists public.user_directory (
  user_id uuid primary key,
  email varchar(255) not null,
  display_name varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_directory_email_idx
  on public.user_directory (lower(email));
