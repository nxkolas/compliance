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
      requirement_count: number;
      rule_count: number;
    }[]>`
      select r.release_code, r.version_label,
        (select count(*)::int from gap_requirement_set_members m
          where m.requirement_set_version_id = r.requirement_set_version_id) as requirement_count,
        (select count(*)::int from gap_analysis_release_applicability_rules ar
          where ar.gap_analysis_release_id = r.id) as rule_count
      from active_gap_analysis_releases a
      join gap_analysis_releases r on r.id = a.gap_analysis_release_id
      where a.release_code = 'nis2-gap'
    `;
    if (!release) throw new Error("No active nis2-gap release");
    if (release.requirement_count !== 4 || release.rule_count !== 4) {
      throw new Error("The active demo release is incomplete");
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
      "gap_requirements",
      "gap_requirement_versions",
      "documents",
      "document_versions",
      "ai_processing_runs",
      "gap_findings",
      "gap_reassessment_drafts",
      "gap_reassessment_draft_documents",
      "action_plans",
      "action_plan_reconciliations",
      "action_plan_item_reconciliations",
      "audit_events",
    ];
    const rlsRows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relname = any(${protectedTables})
    `;
    if (
      rlsRows.length !== protectedTables.length ||
      rlsRows.some((row) => !row.relrowsecurity)
    ) {
      throw new Error("Server-only RLS is incomplete for gap-analysis tables");
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
      throw new Error("Reassessment or reconciliation consistency checks failed");
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
