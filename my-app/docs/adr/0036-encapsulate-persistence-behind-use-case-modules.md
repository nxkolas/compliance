# Encapsulate persistence behind use-case modules

Server persistence will be organized behind complete business commands and
read models for release catalogues, assessment submission, artifact
revisions, Gap generation/review, evidence, Action Plans, and Legal Corpus
publication. Module internals may use explicit Drizzle projections directly,
but callers cannot depend on physical table layouts and generic repositories
will not be added merely to wrap individual database calls.

