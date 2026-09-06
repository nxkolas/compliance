import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.runIf(Boolean(databaseUrl))(
  "portable job execution database leases",
  () => {
    const sql = postgres(databaseUrl!, { prepare: false, max: 2 });
    const jobIds: string[] = [];

    afterEach(async () => {
      if (jobIds.length === 0) return;
      await sql`delete from background_jobs where id in ${sql(jobIds)}`;
      jobIds.length = 0;
    });

    afterAll(async () => {
      await sql.end();
      const { closeDbConnection } = await import("@/src/db");
      await closeDbConnection();
    });

    it("allows only one concurrent invocation to own a live lease", async () => {
      const job = await insertJob("queued");
      const { leaseNextJob } = await import("@/src/server/platform/jobs");

      const leases = await Promise.all([
        leaseNextJob({
          workerId: `concurrent-a-${randomUUID()}`,
          kinds: [job.kind],
          leaseSeconds: 60,
        }),
        leaseNextJob({
          workerId: `concurrent-b-${randomUUID()}`,
          kinds: [job.kind],
          leaseSeconds: 60,
        }),
      ]);

      expect(leases.filter((lease) => lease?.id === job.id)).toHaveLength(1);
      expect(leases.filter(Boolean)).toHaveLength(1);
    });

    it("reclaims an expired lease and increments its attempt", async () => {
      const job = await insertJob("running");
      const { leaseNextJob } = await import("@/src/server/platform/jobs");

      const lease = await leaseNextJob({
        workerId: `recovery-${randomUUID()}`,
        kinds: [job.kind],
        leaseSeconds: 60,
      });

      expect(lease).toMatchObject({ id: job.id, state: "running", attemptCount: 2 });
      expect(lease?.leaseExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    });

    async function insertJob(state: "queued" | "running") {
      const kind = `lease-test-${randomUUID()}`;
      const [job] = await sql<{ id: string }[]>`
        insert into background_jobs (
          kind,
          state,
          cancellable,
          attempt_count,
          lease_owner,
          lease_expires_at,
          heartbeat_at,
          started_at
        ) values (
          ${kind},
          ${state},
          false,
          ${state === "running" ? 1 : 0},
          ${state === "running" ? "expired-test-worker" : null},
          ${state === "running" ? sql`now() - interval '1 minute'` : null},
          ${state === "running" ? sql`now() - interval '2 minutes'` : null},
          ${state === "running" ? sql`now() - interval '2 minutes'` : null}
        )
        returning id
      `;
      if (!job) throw new Error("Could not create job lease fixture");
      jobIds.push(job.id);
      return { id: job.id, kind };
    }
  },
);
