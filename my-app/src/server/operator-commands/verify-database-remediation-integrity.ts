import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function expectRejectedTransaction(
  name: string,
  statement: string,
) {
  await sql.unsafe("begin");
  let committing = false;
  try {
    await sql.unsafe(statement);
    committing = true;
    await sql.unsafe("commit");
  } catch {
    if (!committing) await sql.unsafe("rollback");
    return;
  }
  throw new Error(`${name} unexpectedly committed`);
}

async function main() {
  const expectedTriggers = [
    "assessment_answers_datatype_trigger",
    "organization_fact_values_datatype_trigger",
    "artifact_revision_assessment_sources_integrity_trigger",
    "ai_processing_run_artifact_inputs_owner_trigger",
    "report_artifact_sources_owner_trigger",
    "background_jobs_result_integrity_trigger",
    "upload_sessions_result_integrity_trigger",
    "idempotency_records_result_integrity_trigger",
    "generated_artifact_revisions_finding_coverage_trigger",
  ];
  const triggers = await sql<{ tgname: string }[]>`
    select tgname
    from pg_trigger
    where not tgisinternal
      and tgname in ${sql(expectedTriggers)}
  `;
  const actualTriggers = new Set(triggers.map((row) => row.tgname));
  for (const trigger of expectedTriggers) {
    if (!actualTriggers.has(trigger)) throw new Error(`Missing trigger ${trigger}`);
  }
  const [coverageTriggerFunction] = await sql<{ definition: string }[]>`
    select pg_get_functiondef(
      'public.enforce_gap_revision_finding_coverage()'::regprocedure
    ) as definition
  `;
  if (
    !coverageTriggerFunction?.definition.includes("to_jsonb(old)") ||
    !coverageTriggerFunction.definition.includes("to_jsonb(new)")
  ) {
    throw new Error(
      "Gap coverage trigger must extract table-specific keys through JSON records",
    );
  }

  const expectedConstraints = [
    "generated_artifacts_current_revision_owner_fk",
    "assessments_current_revision_owner_fk",
    "documents_current_version_owner_fk",
    "assessment_answer_options_answer_question_fk",
    "organization_fact_value_options_value_fact_fk",
    "gap_finding_review_resolutions_finding_revision_fk",
    "generated_artifact_revisions_gap_metadata_check",
    "background_job_results_exactly_one_check",
    "upload_session_results_exactly_one_check",
    "idempotency_record_results_exactly_one_check",
  ];
  const constraints = await sql<{ conname: string }[]>`
    select conname
    from pg_constraint
    where conname in ${sql(expectedConstraints)}
  `;
  const actualConstraints = new Set(constraints.map((row) => row.conname));
  for (const constraint of expectedConstraints) {
    if (!actualConstraints.has(constraint)) {
      throw new Error(`Missing constraint ${constraint}`);
    }
  }

  await expectRejectedTransaction(
    "succeeded job without typed result",
    `
      insert into background_jobs (
        kind, state, progress, finished_at, cancellable
      ) values (
        'gap-generation', 'succeeded', 100, now(), false
      )
    `,
  );
  await expectRejectedTransaction(
    "completed upload without typed result",
    `
      insert into upload_sessions (
        created_by_user_id, scope, bucket, object_path, file_name,
        expected_mime_type, expected_size, state, expires_at, completed_at
      ) values (
        gen_random_uuid(), 'document', 'organization-evidence',
        'rehearsal/missing-result', 'evidence.pdf', 'application/pdf',
        1, 'completed', now() + interval '1 hour', now()
      )
    `,
  );
  await expectRejectedTransaction(
    "successful idempotency record without typed result",
    `
      insert into idempotency_records (
        actor_key, scope, operation, key, request_fingerprint,
        state, response_status, expires_at
      ) values (
        'rehearsal', 'rehearsal', 'gap-generation', gen_random_uuid()::text,
        'fingerprint', 'succeeded', 202, now() + interval '1 hour'
      )
    `,
  );
  await expectRejectedTransaction(
    "empty job result",
    `
      with job as (
        insert into background_jobs (kind, cancellable)
        values ('cleanup', false)
        returning id
      )
      insert into background_job_results (job_id)
      select id from job
    `,
  );

  await sql.unsafe("begin");
  try {
    const [job] = await sql<{ id: string }[]>`
      insert into background_jobs (kind, cancellable)
      values ('rehearsal-valid-queued', false)
      returning id
    `;
    await sql`delete from background_jobs where id = ${job.id}`;
    await sql.unsafe("commit");
  } catch (error) {
    await sql.unsafe("rollback");
    throw error;
  }

  console.log(
    `Verified ${expectedConstraints.length} remediation constraints, ` +
      `${expectedTriggers.length} deferred triggers, four rejected invalid ` +
      "transactions, and one valid transaction.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
