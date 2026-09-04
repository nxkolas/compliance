import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaDirectory = resolve(import.meta.dirname, "../src/db/schema");
const schema = readdirSync(schemaDirectory)
  .filter((fileName) => fileName.endsWith(".ts"))
  .map((fileName) => readFileSync(resolve(schemaDirectory, fileName), "utf8"))
  .join("\n");

describe("target database indexes", () => {
  it.each([
    "assessment_revisions_assessment_submitted_idx",
    "analysis_output_revisions_output_created_idx",
    "document_chunks_search_idx",
    "background_jobs_claim_idx",
    "background_jobs_lease_idx",
    "ai_processing_runs_job_idx",
    "ai_processing_runs_generation_reservation_idx",
    "audit_events_organization_time_idx",
    "api_rate_limit_windows_expiry_idx",
  ])("retains the target access-path index %s", (name) => {
    expect(schema).toContain(`"${name}"`);
  });

  it.each([
    "document_chunk_embeddings_chunk_idx",
    "gap_finding_evidence_answer_idx",
    "legal_release_members_generation_idx",
    "ai_run_legal_inputs_generation_idx",
    "idempotency_record_results_document_idx",
  ])("does not retain removed-family index %s", (name) => {
    expect(schema).not.toContain(`"${name}"`);
  });
});
