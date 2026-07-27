import "dotenv/config";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { prepare: false });
  try {
    const [release] = await sql<{
      release_code: string;
      version_label: string;
      prompt_version: string;
      response_schema_version: string;
      action_plan_prompt_version: string;
      action_plan_response_schema_version: string;
      requirement_count: number;
      question_count: number;
      requirement_question_mapping_count: number;
      legal_mapping_count: number;
      rule_count: number;
    }[]>`
      select r.release_code, r.version_label,
        r.prompt_version,
        r.response_schema_version,
        r.action_plan_prompt_version,
        r.action_plan_response_schema_version,
        (select count(*)::int from gap_requirement_set_members m
          where m.requirement_set_version_id = r.requirement_set_version_id) as requirement_count,
        (select count(*)::int from questions q
          where q.questionnaire_version_id = r.questionnaire_version_id) as question_count,
        (select count(*)::int from gap_requirement_question_mappings m
          where m.gap_analysis_release_id = r.id) as requirement_question_mapping_count,
        (select count(*)::int
          from gap_question_legal_provisions l
          join questions q on q.id = l.question_id
          where q.questionnaire_version_id = r.questionnaire_version_id) as legal_mapping_count,
        (select count(*)::int from gap_analysis_release_applicability_rules ar
          where ar.gap_analysis_release_id = r.id) as rule_count
      from active_gap_analysis_releases a
      join gap_analysis_releases r on r.id = a.gap_analysis_release_id
      where a.release_code = 'nis2-gap'
    `;
    if (!release) throw new Error("No active nis2-gap release");
    if (
      release.version_label !== "reliability-v1" ||
      release.prompt_version !== "8" ||
      release.response_schema_version !== "8" ||
      release.action_plan_prompt_version !== "2" ||
      release.action_plan_response_schema_version !== "2" ||
      release.requirement_count !== 10 ||
      release.question_count !== 31 ||
      release.requirement_question_mapping_count !== 31 ||
      release.legal_mapping_count < 31 ||
      release.rule_count !== 10
    ) {
      throw new Error("The active reliability-v1 release is incomplete");
    }
    const [vector] = await sql<{ installed: boolean }[]>`
      select exists(select 1 from pg_extension where extname = 'vector') as installed
    `;
    if (!vector?.installed) throw new Error("pgvector is not installed");
    const [bucket] = await sql<{ public: boolean }[]>`
      select public from storage.buckets where id = 'organization-evidence'
    `;
    if (!bucket || bucket.public) throw new Error("Private evidence bucket is unavailable");
    const protectedTables = [
      "gap_analysis_releases",
      "gap_requirement_question_mappings",
      "gap_question_legal_provisions",
      "gap_questionnaire_drafts",
      "gap_questionnaire_draft_answers",
      "assessment_requirement_evaluations",
      "gap_requirements",
      "gap_requirement_versions",
      "documents",
      "document_versions",
      "ai_processing_runs",
      "gap_findings",
      "gap_reassessment_drafts",
      "gap_reassessment_draft_documents",
      "action_plans",
      "audit_events",
    ];
    const rlsRows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relname = any(${protectedTables})
    `;
    const rlsByTable = new Map(
      rlsRows.map((row) => [row.relname, row.relrowsecurity]),
    );
    const missingRls = protectedTables.filter(
      (table) => rlsByTable.get(table) !== true,
    );
    if (missingRls.length) {
      throw new Error(
        `Server-only RLS is incomplete for: ${missingRls.join(", ")}`,
      );
    }
    const triggerRows = await sql<{ tgname: string }[]>`
      select tgname from pg_trigger
      where not tgisinternal
        and tgname in (
          'document_chunks_search_vector_trigger',
          'audit_events_append_only_trigger'
        )
    `;
    if (triggerRows.length !== 2) {
      throw new Error("Gap-analysis database triggers are incomplete");
    }
    const [consistency] = await sql<{
      missing_stable_requirements: number;
      invalid_accepted_revisions: number;
      duplicate_open_drafts: number;
      duplicate_active_plans: number;
    }[]>`
      select
        (select count(*)::int from gap_requirement_versions
          where requirement_id is null) as missing_stable_requirements,
        (select count(*)::int
          from generated_artifacts artifact
          join generated_artifact_revisions revision
            on revision.id = artifact.accepted_revision_id
          where revision.artifact_id <> artifact.id
            or revision.status <> 'approved') as invalid_accepted_revisions,
        (select count(*)::int from (
          select assessment_id from gap_reassessment_drafts
          where status = 'open'
          group by assessment_id having count(*) > 1
        ) duplicate) as duplicate_open_drafts,
        (select count(*)::int from (
          select organization_id from action_plans
          where status = 'active'
          group by organization_id having count(*) > 1
        ) duplicate) as duplicate_active_plans
    `;
    if (!consistency || Object.values(consistency).some((count) => count > 0)) {
      throw new Error("Gap and action-plan workflow consistency checks failed");
    }
    console.log(`Gap smoke test passed for ${release.release_code}/${release.version_label}.`);
  } finally {
    await sql.end();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
