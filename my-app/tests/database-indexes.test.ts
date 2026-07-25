import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const schema = readFileSync(resolve(root, "src/db/schema.ts"), "utf8");
const benchmark = readFileSync(
  resolve(root, "scripts/benchmark-database-indexes.ts"),
  "utf8",
);

const removedCandidates = [
  "questionnaire_versions_questionnaire_idx",
  "rule_sets_module_idx",
  "idx_answers_revision",
  "generated_artifacts_organization_idx",
  "documents_organization_idx",
  "document_chunks_extraction_idx",
  "document_versions_document_idx",
  "compliance_framework_versions_framework_idx",
  "compliance_modules_framework_version_idx",
  "gap_reassessment_drafts_organization_idx",
  "gap_requirement_versions_requirement_idx",
  "generated_artifact_revisions_artifact_idx",
  "assessment_revisions_assessment_idx",
  "artifact_revision_sources_revision_idx",
  "question_fact_mappings_question_idx",
  "questionnaires_module_idx",
  "questions_questionnaire_version_idx",
  "question_options_question_idx",
  "organization_memberships_org_idx",
];

describe("database indexes", () => {
  it.each(removedCandidates)("does not retain redundant index %s", (name) => {
    expect(schema).not.toContain(`"${name}"`);
  });

  it.each([
    "document_chunk_embeddings_chunk_idx",
    "legal_chunk_embeddings_chunk_idx",
    "gap_finding_evidence_answer_idx",
    "gap_finding_evidence_document_chunk_idx",
    "gap_finding_evidence_legal_chunk_idx",
    "legal_release_members_generation_idx",
    "ai_run_legal_inputs_generation_idx",
    "ai_run_context_document_chunk_idx",
    "ai_claim_context_context_idx",
    "idempotency_record_results_document_idx",
  ])("retains measured prioritized index %s", (name) => {
    expect(schema).toContain(`"${name}"`);
  });

  it("keeps a production-scale, buffer-aware reproduction benchmark", () => {
    expect(benchmark).toContain("250000");
    expect(benchmark).toContain("explain (analyze, buffers, format json)");
    expect(benchmark).toContain("drop index prefix_fixture_narrow_idx");
    expect(benchmark).toContain("withoutIndex");
    expect(benchmark).toContain("withIndex");
  });
});
