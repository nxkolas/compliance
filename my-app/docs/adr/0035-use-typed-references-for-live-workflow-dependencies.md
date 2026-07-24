# Use typed references for live workflow dependencies

Live lineage, report sources, and operational results will use use-case-owned
tables with typed foreign keys instead of `type + UUID` references, so target
existence, identity, and tenant ownership can be enforced by PostgreSQL.
Append-only audit events retain polymorphic entity identifiers because they
are historical statements that must remain readable independently of target
lifetime.

