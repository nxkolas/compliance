# Store platform administration server-side

Platform Administrator authority will be held in a server-only registry keyed by Supabase Auth user ID, independent of editable user metadata and organization membership. The first administrator is bootstrapped through an explicit operator script, and later changes require an existing administrator or controlled operator process with full audit attribution.
