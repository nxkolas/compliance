import "dotenv/config";

import postgres from "postgres";
import {
  getRepositoryRelease,
} from "@/src/server/compliance";
import {
  getRepositoryGapRelease,
} from "@/src/server/gap-analysis";

const applicationUrl = process.env.DATABASE_URL;
const drizzleUrl = process.env.DRIZZLE_DATABASE_URL;
if (!applicationUrl || !drizzleUrl) {
  throw new Error("DATABASE_URL and DRIZZLE_DATABASE_URL are both required");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing a remediation rollout in production");
}

const applicationTarget = new URL(applicationUrl);
const drizzleTarget = new URL(drizzleUrl);
if (
  applicationTarget.hostname !== drizzleTarget.hostname ||
  applicationTarget.pathname !== drizzleTarget.pathname
) {
  throw new Error("DATABASE_URL and DRIZZLE_DATABASE_URL identify different targets");
}
if (
  applicationTarget.pathname !== "/postgres" ||
  !applicationTarget.hostname.endsWith(".supabase.co")
) {
  throw new Error("The configured database is not the approved disposable target shape");
}

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
]) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

getRepositoryRelease("nis2/2026-v1");
getRepositoryGapRelease("nis2-gap/guided-v3");

const sql = postgres(drizzleUrl, { max: 1, prepare: false });

async function main() {
  const [identity] = await sql<{
    database: string;
    role: string;
    production: boolean;
  }[]>`
    select
      current_database() as database,
      current_user as role,
      current_setting('app.environment', true) = 'production' as production
  `;
  if (identity.database !== "postgres" || identity.production) {
    throw new Error("The live identity is not the approved disposable target");
  }

  const administrators = await sql<{ userId: string }[]>`
    select user_id as "userId"
    from platform_administrators
    where revoked_at is null
    order by created_at
  `;
  if (administrators.length === 0) {
    throw new Error("No active Platform Administrator UUID is available");
  }
  const connections = await sql<{
    applicationName: string;
    state: string | null;
    connections: number;
  }[]>`
    select
      application_name as "applicationName",
      state,
      count(1)::int as connections
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
    group by application_name, state
    order by application_name, state
  `;
  const scheduledApplicationWriters = await sql<{
    active: boolean;
    command: string;
    jobId: number;
  }[]>`
    select jobid as "jobId", command, active
    from cron.job
    where command ilike '%cleanup_expired_guest_applicability_checks%'
  `;

  console.log(JSON.stringify({
    activePlatformAdministratorIds: administrators.map((row) => row.userId),
    connections,
    database: identity.database,
    host: applicationTarget.hostname,
    registeredReleases: ["nis2/2026-v1", "nis2-gap/guided-v3"],
    role: identity.role,
    scheduledApplicationWriters,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
