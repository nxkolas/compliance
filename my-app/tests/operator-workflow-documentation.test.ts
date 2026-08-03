import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runbookPath = "docs/database/drizzle-workflow.md";

describe("disposable workflow documentation inventory", () => {
  it("advertises one guarded apply command with package names matching the runbook", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const runbook = readFileSync(runbookPath, "utf8");
    const overview = readFileSync("docs/architecture/system-overview.md", "utf8");

    expect(packageJson.scripts["db:plan:disposable"]).toBe(
      "tsx scripts/disposable-schema-workflow.ts plan",
    );
    expect(packageJson.scripts["db:apply:disposable"]).toBe(
      "tsx scripts/disposable-schema-workflow.ts apply",
    );
    expect(packageJson.scripts["db:bootstrap:disposable"]).toBeUndefined();
    expect(runbook).toContain("npm run db:plan:disposable");
    expect(runbook).toContain("npm run db:apply:disposable -- --target");
    expect(overview).not.toMatch(/npm (?:run|cmd run) db:/u);
  });

  it("keeps every overview document link resolvable", () => {
    const overviewPath = "docs/architecture/system-overview.md";
    const overview = readFileSync(overviewPath, "utf8");
    const links = [...overview.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/gu)]
      .map((match) => match[1])
      .filter((link) => !link.includes("://"));

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(existsSync(resolve(dirname(overviewPath), link)), link).toBe(true);
    }
  });
});
