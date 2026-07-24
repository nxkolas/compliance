-- Minimal Supabase-owned infrastructure needed to rehearse application DDL in
-- a fresh PostgreSQL database on the approved disposable cluster.
create schema if not exists extensions;
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
