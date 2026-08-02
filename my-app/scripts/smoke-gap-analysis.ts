import "dotenv/config";
import postgres from "postgres";
import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "../src/server/definitions";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const expectedReference = readArgument("--release") ?? "nis2-gap/reliability-v8";
  const release = getCurrentGapDefinition("en");
  if (expectedReference !== `${release.releaseCode}/${release.versionLabel}`) {
    throw new Error(
      `--release must equal the deployed code-owned definition ${release.releaseCode}/${release.versionLabel}`,
    );
  }
  if (
    release.id !== currentGapDefinitionHash ||
    release.prompt.responseSchemaVersion !== "12" ||
    release.actionPlanPrompt.responseSchemaVersion !== "6" ||
    release.requirements.length !== 10 ||
    release.questions.length !== 31 ||
    release.questions.some((question) => question.legalProvisions.length === 0)
  ) {
    throw new Error("The deployed code-owned Gap definition is incomplete");
  }

  const sql = postgres(databaseUrl, { prepare: false });
  try {
    const [vector] = await sql<{ installed: boolean }[]>`
      select exists(select 1 from pg_extension where extname = 'vector') as installed
    `;
    if (!vector?.installed) throw new Error("pgvector is not installed");
    const [bucket] = await sql<{ public: boolean }[]>`
      select public from storage.buckets where id = 'organization-evidence'
    `;
    if (!bucket || bucket.public) {
      throw new Error("Private evidence bucket is unavailable");
    }

    const protectedTables = [
      "analysis_outputs",
      "analysis_output_revisions",
      "assessment_answers",
      "assessment_revisions",
      "gap_analysis_cycles",
      "gap_analysis_cycle_documents",
      "documents",
      "document_versions",
      "document_chunks",
      "ai_processing_runs",
      "ai_processing_run_context",
      "gap_findings",
      "gap_items",
      "gap_finding_context_links",
      "gap_item_context_links",
      "action_plans",
      "action_plan_items",
      "action_plan_item_gaps",
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
      throw new Error(`Server-only RLS is incomplete for: ${missingRls.join(", ")}`);
    }

    const [consistency] = await sql<{
      invalid_output_pointers: number;
      duplicate_unfinished_cycles: number;
      duplicate_action_plans: number;
    }[]>`
      select
        (select count(*)::int
          from analysis_outputs output
          join analysis_output_revisions revision on revision.id = output.current_revision_id
          where revision.output_id <> output.id
            or revision.organization_id <> output.organization_id) as invalid_output_pointers,
        (select count(*)::int from (
          select organization_id from gap_analysis_cycles
          where stage <> 'generated'
          group by organization_id having count(*) > 1
        ) duplicate) as duplicate_unfinished_cycles,
        (select count(*)::int from (
          select organization_id from action_plans
          group by organization_id having count(*) > 1
        ) duplicate) as duplicate_action_plans
    `;
    if (!consistency || Object.values(consistency).some((count) => count > 0)) {
      throw new Error("Gap and Action Plan workflow consistency checks failed");
    }
    const [legacy] = await sql<{ misleadingAiRuns: number }[]>`
      select count(*)::int as "misleadingAiRuns"
      from ai_processing_runs
      where status = 'succeeded'
        and model like 'deterministic-%'
    `;
    if ((legacy?.misleadingAiRuns ?? 0) > 0) {
      console.warn(
        `Retained ${(legacy?.misleadingAiRuns ?? 0)} pre-recovery deterministic AI runs as invalid development history; no data was deleted.`,
      );
    }
    console.log(
      `Gap smoke test passed for ${release.releaseCode}/${release.versionLabel} (${currentGapDefinitionHash}).`,
    );
  } finally {
    await sql.end();
  }
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
