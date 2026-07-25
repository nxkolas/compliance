# Database index evidence

Date: 2026-07-24  
Target: approved disposable PostgreSQL 17.6 development database  
Command: `npm.cmd run db:benchmark:indexes`

## Method

The benchmark uses session-local temporary tables, so it leaves no permanent
objects or rows. The fixture contains 250,000 rows and 5,000 distinct leading
or referenced keys (50 matching rows per representative key). Write cost is
measured with 100,000 inserts. Every query uses
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

The prefix experiment compares a narrow B-tree with a unique B-tree whose
first column is identical, then drops the narrow index and repeats the same
read, update, and delete. The foreign-key experiment compares the same child
lookup and parent-delete support shape without and with a target-column
B-tree.

## Strict left-prefix candidates

One audit candidate, `artifact_revision_sources_revision_idx`, disappeared
with the obsolete polymorphic table. The other 18 narrow indexes were removed:

| Removed narrow index | Retained wider index |
| --- | --- |
| `questionnaire_versions_questionnaire_idx` | `questionnaire_versions_questionnaire_label_unique` |
| `rule_sets_module_idx` | `rule_sets_module_code_version_unique` |
| `idx_answers_revision` | `assessment_answers_revision_question_unique` |
| `generated_artifacts_organization_idx` | `generated_artifacts_org_module_type_unique` |
| `documents_organization_idx` | `documents_organization_created_idx` |
| `document_chunks_extraction_idx` | `document_chunks_extraction_index_unique` |
| `document_versions_document_idx` | `document_versions_document_number_unique` |
| `compliance_framework_versions_framework_idx` | `compliance_framework_versions_framework_label_unique` |
| `compliance_modules_framework_version_idx` | `compliance_modules_framework_version_code_unique` |
| `gap_reassessment_drafts_organization_idx` | `gap_reassessment_drafts_organization_assessment_created_idx` |
| `gap_requirement_versions_requirement_idx` | `gap_requirement_versions_requirement_version_unique` |
| `generated_artifact_revisions_artifact_idx` | `generated_artifact_revisions_artifact_number_unique` |
| `assessment_revisions_assessment_idx` | `assessment_revisions_assessment_number_unique` |
| `question_fact_mappings_question_idx` | `question_fact_mappings_question_fact_unique` |
| `questionnaires_module_idx` | `questionnaires_module_code_unique` |
| `questions_questionnaire_version_idx` | `questions_version_stable_key_unique` |
| `question_options_question_idx` | `question_options_question_value_unique` |
| `organization_memberships_org_idx` | `organization_memberships_org_user_unique` |

Measured plans:

| Operation | Both indexes | Wider only | Decision |
| --- | ---: | ---: | --- |
| Read | 0.073 ms, Index Scan, 52 local hits | 0.107 ms, Index Scan, 102 local hits | Retain wider only; 0.034 ms absolute difference is not material |
| Update | 1.784 ms, 506 hits/5 reads | 0.862 ms, 463 hits/1 read | Retain wider only |
| Delete | 0.261 ms, 104 hits | 0.356 ms, 153 hits | Retain wider only; 0.095 ms absolute difference is not material |
| Insert 100,000 rows | 466.709 ms, 520,982 hits | 324.372 ms, 321,142 hits | Retain wider only; removes about 30% elapsed write cost in this fixture |

The wider B-tree remained the selected access path for equality reads and
write targeting. The small read/delete deltas are outweighed by eliminating
18 redundant structures and their write amplification.

## Prioritized unsupported foreign keys

The benchmark showed the representative target lookup changing from a
sequential scan (37.197 ms and 3,087 local reads) to an index scan (0.066 ms
and 52 local hits). Representative update targeting changed from 32.820 ms to
0.934 ms, and delete targeting from 32.401 ms to 0.310 ms.

Indexes were therefore added only to the audit's prioritized groups:

- reverse lookups for Document and Legal Source chunk embeddings;
- the three nullable Gap Finding Evidence source foreign keys;
- Legal Corpus Release member version, rendition, and processing-generation
  foreign keys;
- AI legal-input and grounded-context target foreign keys;
- the reverse side of AI claim/context links;
- typed Artifact lineage, AI input, Report source, Background Job result, and
  Upload result targets; and
- partial target indexes for every typed Idempotency result. Each idempotency
  row contains exactly one target, so the partial indexes avoid indexing null
  entries.

No blanket migration of the audit's unsupported foreign keys was performed.
Low-volume catalogue and governance relationships remain unindexed unless
covered by a primary, unique, or measured workload index.

## Reproduction and rollout gate

The benchmark is deterministic in shape and can be rerun with:

```powershell
npm.cmd run db:benchmark:indexes
```

After schema rollout, the Compliance, Gap, Corpus, and Document module
benchmarks must also pass against the governed fixture. This evidence covers
the structural index decision; the module benchmarks cover end-to-end query
count and latency regressions.

## Shared-target module results

The governed acceptance fixture passed all assertion-mode read benchmarks after
rollout:

| Module operation | Warm result | SQL budget/result |
| --- | ---: | ---: |
| Compliance complete reads | 0-255.2 ms p95 by operation | Passed |
| Complete Gap workflow | 267.3 ms median | 17 / 17 calls |
| Document library | 96.3 ms p95 | 2 / 4 calls |
| Legal source list | 94.2 ms p95 | 2 / 2 calls |
| Legal source detail | 136.8 ms p95 | 3 / 3 calls |
| Corpus release list | 100.5 ms p95 | 2 / 2 calls |

The empty document-library path originally issued an avoidable second detail
query with `WHERE false`; the module benchmark exposed it. The service now
returns the empty detail/usage sets without querying them, restoring the
complete Gap workflow to its 17-call ceiling.

Reproduce the focused Corpus/Document gate with:

```powershell
npx.cmd tsx scripts/benchmark-corpus-document-runtime.ts --organization-id <uuid> --user-id <uuid> --samples 3 --assert
```
