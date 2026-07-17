import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to drop tables in production");
}

if (process.env.DB_CLEAR_CONFIRM !== "clear-app-tables") {
  throw new Error(
    "Refusing to drop legacy app tables without DB_CLEAR_CONFIRM=clear-app-tables",
  );
}

const legacyTables = [
  "audit_events",
  "action_plan_items",
  "action_plans",
  "gap_finding_review_resolutions",
  "gap_finding_evidence",
  "gap_findings",
  "ai_processing_run_inputs",
  "ai_processing_runs",
  "document_chunk_embeddings",
  "document_embedding_generations",
  "document_chunks",
  "document_extractions",
  "document_versions",
  "documents",
  "active_gap_analysis_releases",
  "gap_analysis_release_activations",
  "gap_analysis_release_applicability_rules",
  "gap_analysis_releases",
  "gap_requirement_set_members",
  "gap_requirement_set_versions",
  "gap_requirement_versions",
  "gap_requirement_sets",
  "artifact_revision_sources",
  "assessment_answers",
  "assessment_revisions",
  "assessments",
  "ai_chat_summaries",
  "ai_document_chunks",
  "ai_documents",
  "ai_messages",
  "ai_prompt_versions",
  "ai_chats",
  "assessment_lex_specialis_matches",
  "compliance_framework_versions",
  "compliance_frameworks",
  "compliance_modules",
  "document_requirement_types",
  "document_review_findings",
  "document_review_runs",
  "generated_artifact_revisions",
  "generated_artifacts",
  "guest_assessment_sessions",
  "guest_creation_rate_limits",
  "guest_applicability_checks",
  "incident_reports",
  "lex_specialis_rules",
  "management_trainings",
  "nis2_critical_services",
  "nis2_sectors",
  "organization_critical_services",
  "organization_fact_definition_translations",
  "organization_fact_definitions",
  "organization_fact_values",
  "organization_invitations",
  "organization_members",
  "organization_memberships",
  "organization_requirements",
  "organization_sectors",
  "organization_settings",
  "organizations",
  "question_fact_mappings",
  "question_option_translations",
  "question_options",
  "question_translations",
  "questionnaire_answers",
  "questionnaire_questions",
  "questionnaire_runs",
  "questionnaire_sections",
  "questionnaire_templates",
  "questionnaire_versions",
  "questionnaires",
  "questions",
  "registration_tasks",
  "report_exports",
  "requirement_evidence",
  "rule_sets",
  "security_incidents",
  "self_check_assessments",
  "supplier_assessments",
  "suppliers",
  "tom_areas",
  "user_preferences",
];

const legacyTypes = [
  "ai_assistant_mode",
  "ai_document_scope",
  "ai_document_status",
  "ai_message_role",
  "document_finding_status",
  "document_review_status",
  "guest_assessment_status",
  "incident_report_stage",
  "nis2_entity_category",
  "nis2_sector_criticality",
  "organization_size",
  "questionnaire_question_type",
  "questionnaire_result",
  "questionnaire_type",
  "report_audience",
  "report_export_status",
  "report_export_type",
  "requirement_status",
  "risk_level",
  "task_status",
];

const client = postgres(databaseUrl, {
  prepare: false,
});

async function main() {
  try {
    for (const table of legacyTables) {
      await client.unsafe(`drop table if exists "${table}" cascade`);
    }

    for (const type of legacyTypes) {
      await client.unsafe(`drop type if exists "${type}" cascade`);
    }

    console.log("Dropped legacy app tables and enum types.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
