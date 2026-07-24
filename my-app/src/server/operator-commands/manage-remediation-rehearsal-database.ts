import "dotenv/config";

import postgres from "postgres";

const rehearsalDatabase = "compliance_remediation_rehearsal";
const action = process.argv[2];
const adminUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!adminUrl) throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to manage a rehearsal database in production");
}
if (process.env.REMEDIATION_REHEARSAL_CONFIRM !== rehearsalDatabase) {
  throw new Error(
    `Set REMEDIATION_REHEARSAL_CONFIRM=${rehearsalDatabase} to continue`,
  );
}
if (action !== "create" && action !== "drop") {
  throw new Error("Pass exactly one action: create or drop");
}

const parsedAdminUrl = new URL(adminUrl);
if (parsedAdminUrl.pathname !== "/postgres") {
  throw new Error("The rehearsal manager must connect through the postgres database");
}

const sql = postgres(parsedAdminUrl.toString(), { max: 1, prepare: false });

async function main() {
  const [identity] = await sql<{
    database: string;
    isProduction: boolean;
  }[]>`
    select
      current_database() as database,
      current_setting('app.environment', true) = 'production' as "isProduction"
  `;
  if (identity.database !== "postgres" || identity.isProduction) {
    throw new Error("The configured target is not the approved disposable database");
  }

  const [existing] = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from pg_database where datname = ${rehearsalDatabase}
    ) as exists
  `;

  if (action === "create") {
    if (existing.exists) {
      throw new Error(`${rehearsalDatabase} already exists; drop it before recreating`);
    }
    await sql.unsafe(`create database "${rehearsalDatabase}"`);
    console.log(`Created fresh database ${rehearsalDatabase}.`);
    return;
  }

  if (!existing.exists) {
    console.log(`Database ${rehearsalDatabase} is already absent.`);
    return;
  }
  await sql`
    select pg_terminate_backend(pid)
    from pg_stat_activity
    where datname = ${rehearsalDatabase}
      and pid <> pg_backend_pid()
  `;
  await sql.unsafe(`drop database "${rehearsalDatabase}"`);
  console.log(`Dropped database ${rehearsalDatabase}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
