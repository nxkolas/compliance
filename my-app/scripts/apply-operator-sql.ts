import "dotenv/config";

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import postgres from "postgres";

const approvedFiles = new Set([
  "scripts/sql/api-corpus-integrity-additions.sql",
  "scripts/sql/audit-events-append-only.sql",
  "scripts/sql/database-remediation-integrity.sql",
  "scripts/sql/legal-corpus-indexes.sql",
  "scripts/sql/organization-management-user-directory.sql",
  "scripts/sql/remediation-rehearsal-bootstrap.sql",
  "supabase/sql-editor/003_guest_retention_cleanup.sql",
  "supabase/sql-editor/004_gap_evidence_infrastructure.sql",
]);

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");

const requestedFiles = process.argv.slice(2);
if (requestedFiles.length === 0) {
  throw new Error("Pass at least one approved repository SQL file");
}

const repositoryRoot = resolve(process.cwd());
const files = requestedFiles.map((file) => {
  const absolutePath = resolve(repositoryRoot, file);
  const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
  if (!approvedFiles.has(repositoryPath)) {
    throw new Error(`Refusing to execute unapproved SQL file: ${repositoryPath}`);
  }
  return { absolutePath, repositoryPath };
});

async function main() {
  const client = postgres(databaseUrl!, { prepare: false, max: 1 });
  try {
    for (const file of files) {
      if (file.repositoryPath === "scripts/sql/api-corpus-integrity-additions.sql") {
        const [state] = await client<{ schemaReady: boolean }[]>`
          select to_regclass('public.background_jobs') is not null as "schemaReady"
        `;
        if (!state.schemaReady) {
          console.log(
            `Deferred ${file.repositoryPath}; application tables are not present yet.`,
          );
          continue;
        }
      }
      const sql = await readFile(file.absolutePath, "utf8");
      await client.unsafe(sql);
      console.log(`Applied ${file.repositoryPath}.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
