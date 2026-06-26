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
  "ai_chat_summaries",
  "ai_document_chunks",
  "ai_documents",
  "ai_messages",
  "ai_prompt_versions",
  "ai_chats",
  "assessment_lex_specialis_matches",
  "action_plan_items",
  "document_requirement_types",
  "document_review_findings",
  "document_review_runs",
  "guest_assessment_sessions",
  "guest_creation_rate_limits",
  "incident_reports",
  "lex_specialis_rules",
  "management_trainings",
  "nis2_critical_services",
  "nis2_sectors",
  "organization_critical_services",
  "organization_members",
  "organization_requirements",
  "organization_sectors",
  "organization_settings",
  "questionnaire_answers",
  "questionnaire_questions",
  "questionnaire_runs",
  "questionnaire_sections",
  "questionnaire_templates",
  "registration_tasks",
  "report_exports",
  "requirement_evidence",
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
  "assessment_status",
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
