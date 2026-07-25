import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sqlRoots = ["scripts/sql", "supabase/sql-editor"];

describe("operator SQL RLS ownership", () => {
  it("leaves RLS and policies to the Drizzle schema", () => {
    for (const root of sqlRoots) {
      for (const file of sqlFiles(root)) {
        const sql = readFileSync(file, "utf8");
        const repositoryPath = relative(process.cwd(), file);

        expect(sql, `${repositoryPath} must not enable RLS`).not.toMatch(
          /\benable\s+row\s+level\s+security\b/i,
        );
        expect(sql, `${repositoryPath} must not create an RLS policy`).not.toMatch(
          /\bcreate\s+policy\b/i,
        );
        expect(
          sql,
          `${repositoryPath} must not manage browser table privileges`,
        ).not.toMatch(
          /\b(?:grant|revoke)\b[^;]*\bon\s+table\b[^;]*\b(?:anon|authenticated|service_role)\b/i,
        );
      }
    }
  });
});

function sqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sqlFiles(path);
    return extname(entry.name) === ".sql" ? [path] : [];
  });
}
