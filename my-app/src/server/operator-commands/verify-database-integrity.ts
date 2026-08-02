import "dotenv/config";
import postgres from "postgres";

const databaseUrl =
  process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

const expectedConstraints = [
  "assessments_current_revision_identity_fk",
  "assessment_revisions_assessment_tenant_fk",
  "analysis_outputs_current_revision_identity_fk",
  "analysis_output_revisions_output_tenant_fk",
  "analysis_output_revisions_assessment_tenant_fk",
  "gap_analysis_cycles_stage_lineage_check",
  "ai_processing_runs_lifecycle_check",
  "ai_processing_run_context_source_check",
  "ai_processing_run_context_channel_check",
  "gap_findings_resolution_check",
  "action_plans_gap_revision_tenant_fk",
  "reports_pdf_locator_check",
] as const;

const expectedIndexes = [
  "assessments_organization_kind_unique",
  "analysis_outputs_organization_kind_unique",
  "gap_analysis_cycles_unfinished_unique",
  "ai_processing_runs_operation_idempotency_unique",
  "gap_findings_revision_requirement_unique",
  "gap_items_finding_stable_key_unique",
  "action_plans_organization_unique",
  "action_plan_items_plan_position_unique",
] as const;

async function main() {
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  try {
    const constraints = await sql<{ conname: string }[]>`
      select conname
      from pg_constraint
      where connamespace = 'public'::regnamespace
        and conname in ${sql(expectedConstraints)}
    `;
    const indexes = await sql<{ indexname: string }[]>`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in ${sql(expectedIndexes)}
    `;
    const constraintNames = new Set(constraints.map((row) => row.conname));
    const indexNames = new Set(indexes.map((row) => row.indexname));
    const missing = [
      ...expectedConstraints.flatMap((name) =>
        constraintNames.has(name) ? [] : [`constraint ${name}`],
      ),
      ...expectedIndexes.flatMap((name) =>
        indexNames.has(name) ? [] : [`index ${name}`],
      ),
    ];
    if (missing.length) {
      throw new Error(`Current-schema integrity objects are missing: ${missing.join(", ")}`);
    }

    const [state] = await sql<{
      invalidAssessmentPointers: number;
      invalidOutputPointers: number;
      duplicateUnfinishedCycles: number;
      duplicateActionPlans: number;
      incompleteActionPlans: number;
      terminalProcessingRuns: number;
    }[]>`
      select
        (select count(*)::int
          from assessments assessment
          join assessment_revisions revision
            on revision.id = assessment.current_revision_id
          where revision.assessment_id <> assessment.id
             or revision.organization_id <> assessment.organization_id
        ) as "invalidAssessmentPointers",
        (select count(*)::int
          from analysis_outputs output
          join analysis_output_revisions revision
            on revision.id = output.current_revision_id
          where revision.output_id <> output.id
             or revision.organization_id <> output.organization_id
        ) as "invalidOutputPointers",
        (select count(*)::int from (
          select organization_id
          from gap_analysis_cycles
          where stage <> 'generated'
          group by organization_id
          having count(*) > 1
        ) duplicate) as "duplicateUnfinishedCycles",
        (select count(*)::int from (
          select organization_id
          from action_plans
          group by organization_id
          having count(*) > 1
        ) duplicate) as "duplicateActionPlans",
        (select count(*)::int
          from action_plans plan
          where exists (
            select 1
            from gap_items gap
            where gap.output_revision_id = plan.source_gap_revision_id
              and not exists (
                select 1
                from action_plan_item_gaps link
                where link.action_plan_id = plan.id
                  and link.gap_item_id = gap.id
              )
          ) or exists (
            select 1
            from action_plan_items item
            where item.action_plan_id = plan.id
              and not exists (
                select 1
                from action_plan_item_gaps link
                where link.action_plan_id = plan.id
                  and link.action_plan_item_id = item.id
              )
          )
        ) as "incompleteActionPlans",
        (select count(*)::int
          from ai_processing_runs run
          join background_jobs job on job.id = run.job_id
          where run.status = 'processing'
            and job.state in ('failed', 'cancelled', 'succeeded')
        ) as "terminalProcessingRuns"
    `;
    if (!state) throw new Error("Current-schema integrity state is unavailable");
    const failures = Object.entries(state).filter(([, count]) => count > 0);
    if (failures.length) {
      throw new Error(
        `Current-schema persisted integrity checks failed: ${failures
          .map(([name, count]) => `${name}=${count}`)
          .join(", ")}`,
      );
    }
    console.log(
      `Verified ${expectedConstraints.length} constraints, ${expectedIndexes.length} indexes, current pointers, cycle/plan uniqueness, Action Plan coverage, and terminal AI-run lifecycle.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
