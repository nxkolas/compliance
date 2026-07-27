import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import postgres from "postgres";
import { getMigrationEnvironment } from "@/src/config/env/migrate";

const migrationRoot = resolve(process.cwd(), "drizzle");
const vectorBootstrapPath = resolve(
  process.cwd(),
  "infra/config/supabase/db-init/00-vector.sql",
);
const operatorSqlFiles = [
  "scripts/sql/organization-management-user-directory.sql",
  "scripts/sql/database-integrity-triggers.sql",
  "scripts/sql/audit-events-append-only.sql",
  "scripts/sql/api-corpus-integrity-additions.sql",
  "scripts/sql/legal-corpus-indexes.sql",
  "supabase/sql-editor/003_guest_retention_cleanup.sql",
  "supabase/sql-editor/004_gap_evidence_infrastructure.sql",
] as const;

type AppliedRecord = {
  filename: string;
  checksum: string;
  kind: "migration" | "operator";
};

async function main() {
  const environment = getMigrationEnvironment();
  const client = postgres(environment.DRIZZLE_DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    await client`select pg_advisory_lock(${environment.MIGRATION_ADVISORY_LOCK_ID})`;
    await verifyDatabaseIdentity(client, environment);
    await prepareMigrationMetadata(client, environment.APP_ENV);
    const applied = await loadAppliedRecords(client);

    await applyVectorBootstrap(client);
    for (const migration of await discoverMigrations()) {
      await applyMigration(client, migration, applied);
    }
    for (const repositoryPath of operatorSqlFiles) {
      await applyOperatorSql(client, repositoryPath, applied);
    }
    await reconcileRuntimeRole(
      client,
      environment.APP_DATABASE_ROLE,
      environment.APP_DATABASE_PASSWORD,
      environment.MIGRATION_DATABASE_NAME,
    );
  } finally {
    await client
      `select pg_advisory_unlock(${environment.MIGRATION_ADVISORY_LOCK_ID})`
      .catch(() => undefined);
    await client.end();
  }
}

async function verifyDatabaseIdentity(
  client: postgres.Sql,
  environment: ReturnType<typeof getMigrationEnvironment>,
) {
  const [identity] = await client<
    Array<{ databaseName: string; serverAddress: string | null }>
  >`
    select
      current_database() as "databaseName",
      inet_server_addr()::text as "serverAddress"
  `;
  if (identity.databaseName !== environment.MIGRATION_DATABASE_NAME) {
    throw new Error("Migration database identity does not match");
  }
  console.info("Migration target verified", {
    appEnvironment: environment.APP_ENV,
    databaseName: identity.databaseName,
    serverAddress: identity.serverAddress ?? "local-socket",
  });
}

async function prepareMigrationMetadata(
  client: postgres.Sql,
  appEnvironment: string,
) {
  await client.unsafe(`
    create schema if not exists app_private;
    revoke all on schema app_private from public;
    create table if not exists app_private.deployment_identity (
      singleton boolean primary key default true check (singleton),
      app_environment text not null,
      created_at timestamptz not null default now()
    );
    create table if not exists app_private.deployment_sql_history (
      filename text primary key,
      checksum_sha256 text not null,
      kind text not null check (kind in ('migration', 'operator')),
      applied_at timestamptz not null default now()
    );
  `);

  const identities = await client<Array<{ appEnvironment: string }>>`
    select app_environment as "appEnvironment"
    from app_private.deployment_identity
  `;
  if (identities.length === 0) {
    await client`
      insert into app_private.deployment_identity (app_environment)
      values (${appEnvironment})
    `;
  } else if (
    identities.length !== 1 ||
    identities[0].appEnvironment !== appEnvironment
  ) {
    throw new Error("APP_ENV does not match the recorded deployment identity");
  }
}

async function loadAppliedRecords(client: postgres.Sql) {
  const records = await client<AppliedRecord[]>`
    select
      filename,
      checksum_sha256 as checksum,
      kind
    from app_private.deployment_sql_history
    order by filename
  `;
  return new Map(records.map((record) => [record.filename, record]));
}

async function applyVectorBootstrap(client: postgres.Sql) {
  const source = await readFile(vectorBootstrapPath, "utf8");
  await client.unsafe(source);
}

async function reconcileRuntimeRole(
  client: postgres.Sql,
  role: string,
  password: string,
  databaseName: string,
) {
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) {
    throw new Error("APP_DATABASE_ROLE is invalid");
  }
  const identifier = `"${role}"`;
  const databaseIdentifier = `"${databaseName.replaceAll('"', '""')}"`;
  const [existing] = await client<Array<{ exists: boolean }>>`
    select exists(select 1 from pg_roles where rolname = ${role}) as "exists"
  `;
  const action = existing.exists ? "alter" : "create";
  const [roleStatement] =
    action === "create"
      ? await client<Array<{ statement: string }>>`
          select format(
            'create role %I login bypassrls password %L',
            ${role}::text,
            ${password}::text
          ) as statement
        `
      : await client<Array<{ statement: string }>>`
          select format(
            'alter role %I login bypassrls password %L',
            ${role}::text,
            ${password}::text
          ) as statement
        `;
  await client.unsafe(roleStatement.statement);

  await client.unsafe(`
    grant connect on database ${databaseIdentifier} to ${identifier};
    grant usage on schema public, extensions to ${identifier};
    grant select, insert, update, delete on all tables in schema public to ${identifier};
    grant usage, select on all sequences in schema public to ${identifier};
    grant execute on all functions in schema public to ${identifier};
    alter default privileges in schema public
      grant select, insert, update, delete on tables to ${identifier};
    alter default privileges in schema public
      grant usage, select on sequences to ${identifier};
    alter default privileges in schema public
      grant execute on functions to ${identifier};
  `);
}

async function discoverMigrations() {
  const directories = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const migrations: Array<{
    absolutePath: string;
    repositoryPath: string;
    source: string;
    checksum: string;
  }> = [];

  for (const directory of directories) {
    const absolutePath = resolve(migrationRoot, directory.name, "migration.sql");
    let source: string;
    try {
      source = await readFile(absolutePath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
    const repositoryPath = toRepositoryPath(absolutePath);
    migrations.push({
      absolutePath,
      repositoryPath,
      source,
      checksum: sha256(source),
    });
  }
  return migrations;
}

async function applyMigration(
  client: postgres.Sql,
  migration: Awaited<ReturnType<typeof discoverMigrations>>[number],
  applied: Map<string, AppliedRecord>,
) {
  assertChecksum(migration.repositoryPath, migration.checksum, "migration", applied);
  if (applied.has(migration.repositoryPath)) return;

  const statements = migration.source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.begin(async (transaction) => {
    await transaction.unsafe("set local search_path = public, extensions");
    for (const statement of statements) {
      await transaction.unsafe(statement);
    }
    await recordApplied(
      transaction,
      migration.repositoryPath,
      migration.checksum,
      "migration",
    );
  });
  console.info("Applied migration", { filename: migration.repositoryPath });
}

async function applyOperatorSql(
  client: postgres.Sql,
  repositoryPath: string,
  applied: Map<string, AppliedRecord>,
) {
  const absolutePath = resolve(process.cwd(), repositoryPath);
  const resolvedRepositoryPath = toRepositoryPath(absolutePath);
  if (resolvedRepositoryPath !== repositoryPath) {
    throw new Error(`Operator SQL resolved outside the repository: ${repositoryPath}`);
  }

  const source = await readFile(absolutePath, "utf8");
  const checksum = sha256(source);
  assertChecksum(repositoryPath, checksum, "operator", applied);
  if (applied.has(repositoryPath)) return;

  await client.unsafe(source);
  await recordApplied(client, repositoryPath, checksum, "operator");
  console.info("Applied operator SQL", { filename: repositoryPath });
}

function assertChecksum(
  filename: string,
  checksum: string,
  kind: AppliedRecord["kind"],
  applied: Map<string, AppliedRecord>,
) {
  const previous = applied.get(filename);
  if (!previous) return;
  if (previous.kind !== kind || previous.checksum !== checksum) {
    throw new Error(`Previously applied SQL changed: ${filename}`);
  }
}

async function recordApplied(
  client: Pick<postgres.Sql, "unsafe">,
  filename: string,
  checksum: string,
  kind: AppliedRecord["kind"],
) {
  await client.unsafe(
    `
    insert into app_private.deployment_sql_history (
      filename,
      checksum_sha256,
      kind
    )
    values ($1, $2, $3)
    `,
    [filename, checksum, kind],
  );
}

function sha256(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

function toRepositoryPath(absolutePath: string) {
  const repositoryPath = relative(process.cwd(), absolutePath).replaceAll(
    "\\",
    "/",
  );
  if (repositoryPath.startsWith("../") || repositoryPath === "..") {
    throw new Error(`Path is outside the repository: ${absolutePath}`);
  }
  return repositoryPath;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

main().catch((error) => {
  console.error("Migration failed", {
    errorType: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "Unknown migration error",
  });
  process.exitCode = 1;
});
