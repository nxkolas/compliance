# Supabase upstream provenance

These files are copied without semantic changes from the official
`supabase/supabase` repository at commit
`712387bbac26f521783658aada8d9b26d27c56b3` (2026-06-12).

The deployment derives its lean Auth, PostgREST, Storage, Kong, PostgreSQL,
Studio, and postgres-meta configuration from that one coordinated bundle.
Realtime, Edge Functions, Analytics, imgproxy, and Supavisor are intentionally
not deployed. The source license is retained in this directory.

When updating, replace this directory from one reviewed upstream commit,
update `infra/versions.env`, validate every Compose combination, rebuild from
empty storage twice, and run the complete acceptance suite.
