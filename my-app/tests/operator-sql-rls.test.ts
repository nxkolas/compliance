import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sqlRoots = ["scripts/sql", "supabase/sql-editor"];

describe("operator SQL RLS ownership", () => {
  it("retains only the two approved database bootstrap resources", () => {
    const operatorFiles = sqlRoots.flatMap(sqlFiles).map((file) =>
      relative(process.cwd(), file).replaceAll("\\", "/"),
    );
    expect(operatorFiles).toEqual(["scripts/sql/audit-events-append-only.sql"]);
    expect(readFileSync("infra/config/supabase/db-init/00-vector.sql", "utf8"))
      .toMatch(/create extension if not exists vector/i);
  });

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

  it("does not reference retired schema from operator SQL", () => {
    const sql = sqlRoots.flatMap(sqlFiles)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(sql).not.toMatch(
      /questionnaire_versions|generated_artifacts|gap_analysis_releases|provider_policies|guest_session/i,
    );
  });

  it("keeps pre-push and post-push explicit around the Drizzle stage", () => {
    const runner = readFileSync("scripts/apply-operator-sql.ts", "utf8");
    expect(runner).not.toContain('requestedStage !== "all"');
    const bootstrap = readFileSync("scripts/bootstrap-disposable-schema.ts", "utf8");
    expect(bootstrap.indexOf('"pre-push"')).toBeLessThan(
      bootstrap.indexOf('"node_modules/drizzle-kit/bin.cjs"'),
    );
    expect(bootstrap.indexOf('"node_modules/drizzle-kit/bin.cjs"')).toBeLessThan(
      bootstrap.indexOf('"post-push"'),
    );
  });
});

function sqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sqlFiles(path);
    return extname(entry.name) === ".sql" ? [path] : [];
  });
}
