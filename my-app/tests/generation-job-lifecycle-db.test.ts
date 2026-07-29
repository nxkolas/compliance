import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.runIf(Boolean(databaseUrl))(
  "generation job lifecycle database integration",
  () => {
    const sql = postgres(databaseUrl!, { prepare: false, max: 1 });
    const jobIds: string[] = [];
    let actorUserId: string;
    const organizationId = null;

    beforeAll(async () => {
      actorUserId = randomUUID();
    });

    afterEach(async () => {
      if (jobIds.length === 0) return;
      await sql`delete from ai_processing_runs where job_id in ${sql(jobIds)}`;
      await sql`delete from background_jobs where id in ${sql(jobIds)}`;
      jobIds.length = 0;
    });

    afterAll(() => sql.end());

    it("inserts a child only beneath a live leased parent", async () => {
      const jobId = await insertRunningJob("gap-generation-v9");
      const { createAiProcessingRunWithLiveJobGate } =
        await import("@/src/server/ai/generation/job-run-lifecycle");
      const run = await createAiProcessingRunWithLiveJobGate(runValues(jobId));
      expect(run.jobId).toBe(jobId);

      await sql`
        update background_jobs
        set state = 'failed',
            safe_error_code = 'TEST_TERMINAL',
            safe_error_message = 'Test terminal state.',
            lease_owner = null,
            lease_expires_at = null,
            finished_at = now(),
            updated_at = now()
        where id = ${jobId}
      `;
      await expect(
        createAiProcessingRunWithLiveJobGate({
          ...runValues(jobId),
          idempotencyKey: `db-test-${randomUUID()}`,
        }),
      ).rejects.toMatchObject({ safeCode: "PARENT_JOB_TERMINATED" });
    });

    it("atomically fails the job, every processing child, and its audit event", async () => {
      const jobId = await insertRunningJob("action-plan-generation-v3");
      await insertRawProcessingRun(jobId);
      await insertRawProcessingRun(jobId);
      const { finalizeGenerationJobFailure } =
        await import("@/src/server/jobs");
      const failed = await finalizeGenerationJobFailure({
        jobId,
        workerId: "db-test-worker",
        errorCode: "GENERATION_CATEGORY_REPAIR_EXHAUSTED",
        safeMessage: "The background operation failed.",
        retryable: false,
      });
      expect(failed.state).toBe("failed");

      const [state] = await sql<
        {
          processing: number;
          failed: number;
          audits: number;
        }[]
      >`
        select
          count(*) filter (where run.status = 'processing')::int as processing,
          count(*) filter (where run.status = 'failed')::int as failed,
          (
            select count(*)::int
            from audit_events audit
            where audit.entity_id = ${jobId}
              and audit.event_type = 'action_plan.generation_failed'
          ) as audits
        from ai_processing_runs run
        where run.job_id = ${jobId}
      `;
      expect(state).toEqual({ processing: 0, failed: 2, audits: 0 });
    });

    it("reconciles only its selected terminal-parent fixture and is idempotent", async () => {
      const jobId = await insertFailedJob();
      await insertRawProcessingRun(jobId);
      const { reconcileTerminalParentProcessingRuns } =
        await import("@/src/server/jobs");
      const first = await reconcileTerminalParentProcessingRuns({
        parentJobIds: [jobId],
      });
      const second = await reconcileTerminalParentProcessingRuns({
        parentJobIds: [jobId],
      });
      expect(first).toMatchObject({ selected: 1, changed: 1, skipped: 0 });
      expect(second).toMatchObject({ selected: 0, changed: 0, skipped: 0 });

      const [run] = await sql<{ status: string; errorCode: string }[]>`
        select status, error_code as "errorCode"
        from ai_processing_runs
        where job_id = ${jobId}
      `;
      expect(run).toEqual({
        status: "failed",
        errorCode: "PARENT_JOB_TERMINATED",
      });
    });

    it("rechecks the exact dry-run run IDs during apply", async () => {
      const selectedJobId = await insertFailedJob();
      const unselectedJobId = await insertFailedJob();
      const selectedRunId = await insertRawProcessingRun(selectedJobId);
      await insertRawProcessingRun(unselectedJobId);
      const { reconcileTerminalParentProcessingRuns } =
        await import("@/src/server/jobs");

      const applied = await reconcileTerminalParentProcessingRuns({
        runIds: [selectedRunId],
      });
      expect(applied).toMatchObject({ selected: 1, changed: 1, skipped: 0 });

      const rows = await sql<{ jobId: string; status: string }[]>`
        select job_id as "jobId", status
        from ai_processing_runs
        where job_id in (${selectedJobId}, ${unselectedJobId})
        order by job_id
      `;
      expect(rows).toEqual(
        expect.arrayContaining([
          { jobId: selectedJobId, status: "failed" },
          { jobId: unselectedJobId, status: "processing" },
        ]),
      );
    });

    async function insertRunningJob(kind: string) {
      const [job] = await sql<{ id: string }[]>`
        insert into background_jobs (
          organization_id,
          requested_by_user_id,
          kind,
          state,
          cancellable,
          lease_owner,
          lease_expires_at,
          heartbeat_at,
          started_at
        ) values (
          ${organizationId},
          ${actorUserId},
          ${kind},
          'running',
          false,
          'db-test-worker',
          now() + interval '5 minutes',
          now(),
          now()
        )
        returning id
      `;
      if (!job) throw new Error("Could not create running fixture job");
      jobIds.push(job.id);
      return job.id;
    }

    async function insertFailedJob() {
      const [job] = await sql<{ id: string }[]>`
        insert into background_jobs (
          organization_id,
          requested_by_user_id,
          kind,
          state,
          cancellable,
          safe_error_code,
          safe_error_message,
          finished_at
        ) values (
          ${organizationId},
          ${actorUserId},
          'gap-generation-v9',
          'failed',
          false,
          'TEST_TERMINAL',
          'Test terminal state.',
          now()
        )
        returning id
      `;
      if (!job) throw new Error("Could not create failed fixture job");
      jobIds.push(job.id);
      return job.id;
    }

    async function insertRawProcessingRun(jobId: string) {
      const values = runValues(jobId);
      const [run] = await sql<{ id: string }[]>`
        insert into ai_processing_runs (
          organization_id,
          operation_kind,
          status,
          output_locale,
          attempt_count,
          language_validation,
          input_hash,
          idempotency_key,
          prompt_name,
          prompt_version,
          prompt_template_hash,
          rendered_input_hash,
          response_schema_version,
          provenance_status,
          job_id,
          created_by,
          started_at
        ) values (
          ${values.organizationId},
          ${values.operationKind},
          'processing',
          ${values.outputLocale},
          0,
          ${sql.json(values.languageValidation)},
          ${values.inputHash},
          ${values.idempotencyKey},
          ${values.promptName},
          ${values.promptVersion},
          ${values.promptTemplateHash},
          ${values.renderedInputHash},
          ${values.responseSchemaVersion},
          'complete',
          ${jobId},
          ${actorUserId},
          now()
        )
        returning id
      `;
      if (!run) throw new Error("Could not create processing-run fixture");
      return run.id;
    }

    function runValues(jobId: string) {
      return {
        organizationId,
        operationKind: "gap_analysis" as const,
        status: "processing" as const,
        outputLocale: "en",
        attemptCount: 0,
        languageValidation: {
          version: 1,
          detector: { implementation: "db-test", version: "1" },
          expectedLocale: "en",
          attempts: [],
        },
        inputHash: "db-test-input",
        idempotencyKey: `db-test-${randomUUID()}`,
        promptName: "db-test",
        promptVersion: "9",
        promptTemplateHash: "db-test-template",
        renderedInputHash: "db-test-rendered",
        responseSchemaVersion: "9",
        providerPolicyVersion: 1,
        corpusReleaseSetHash: "db-test-corpus",
        provenanceStatus: "complete",
        jobId,
        createdBy: actorUserId,
        startedAt: new Date(),
      };
    }
  },
);
