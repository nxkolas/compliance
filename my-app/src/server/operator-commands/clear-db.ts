import "dotenv/config";

import { getTableUniqueName, isTable } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/src/db/schema";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to clear production DB");
}

if (process.env.DB_CLEAR_CONFIRM !== "clear-app-tables") {
  throw new Error(
    "Refusing to clear DB without DB_CLEAR_CONFIRM=clear-app-tables",
  );
}

const client = postgres(databaseUrl, {
  prepare: false,
});

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replaceAll('"', '""')}"`;

async function main() {
  try {
    const managedTableNames = new Set<string>();
    for (const value of Object.values(schema)) {
      if (isTable(value)) {
        managedTableNames.add(getTableUniqueName(value));
      }
    }
    const existingTables = await client<
      { table_schema: string; table_name: string }[]
    >`
      select table_schema, table_name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema = 'public'
      order by table_name
    `;
    const tablesToClear = existingTables.filter(({ table_schema, table_name }) =>
      managedTableNames.has(`${table_schema}.${table_name}`),
    );

    if (tablesToClear.length > 0) {
      const qualifiedTables = tablesToClear
        .map(
          ({ table_schema, table_name }) =>
            `${quoteIdentifier(table_schema)}.${quoteIdentifier(table_name)}`,
        )
        .join(",");

      await client.unsafe(`truncate ${qualifiedTables} cascade`);
    }

    console.log("Cleared Drizzle-managed app tables.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
