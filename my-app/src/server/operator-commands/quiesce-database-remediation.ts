import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to quiesce a production database");
}
if (process.env.DB_REMEDIATION_QUIESCE_CONFIRM !== "quiesce-app-writers") {
  throw new Error(
    "Set DB_REMEDIATION_QUIESCE_CONFIRM=quiesce-app-writers to continue",
  );
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function main() {
  const jobs = await sql<{ jobId: string }[]>`
    select jobid as "jobId"
    from cron.job
    where active
      and command ilike '%cleanup_expired_guest_applicability_checks%'
  `;
  for (const job of jobs) {
    await sql`select cron.unschedule(${Number(job.jobId)}::bigint)`;
  }
  console.log(`Quiesced ${jobs.length} scheduled application writer(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
