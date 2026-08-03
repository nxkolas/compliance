import "dotenv/config";

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import postgres from "postgres";

const STAGES = {
  "pre-push": ["infra/config/supabase/db-init/00-vector.sql"],
  "post-push": ["scripts/sql/audit-events-append-only.sql"],
} as const;

type Stage = keyof typeof STAGES;

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

const requestedStage = process.argv[2];
if (requestedStage !== "pre-push" && requestedStage !== "post-push") {
  throw new Error("Pass exactly one database bootstrap stage: pre-push or post-push");
}
const databaseBootstrapStage = requestedStage as Stage;

async function main() {
  const client = postgres(databaseUrl!, { prepare: false, max: 1 });
  try {
    for (const repositoryPath of STAGES[databaseBootstrapStage]) {
      const absolutePath = resolve(process.cwd(), repositoryPath);
      const resolvedPath = relative(process.cwd(), absolutePath).replaceAll("\\", "/");
      if (resolvedPath !== repositoryPath) {
        throw new Error(`Database bootstrap path escaped the repository: ${repositoryPath}`);
      }
      await client.unsafe(await readFile(absolutePath, "utf8"));
      console.log(`Applied ${databaseBootstrapStage} database bootstrap: ${repositoryPath}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Database bootstrap failed");
  process.exitCode = 1;
});
