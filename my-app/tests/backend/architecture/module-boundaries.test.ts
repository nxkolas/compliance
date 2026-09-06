import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const businessModules = [
  "action-plans",
  "applicability-check",
  "audit",
  "compliance",
  "documents",
  "gap-analysis",
  "grounding",
  "legal-corpus",
  "organizations",
  "reports",
];

describe("backend module boundaries", () => {
  it("keeps platform code independent from business modules", () => {
    const violations = sourceFiles("src/server/platform").filter((file) =>
      imports(file).some((specifier) => specifier.includes("/server/modules/")),
    );
    expect(violations.map(display)).toEqual([]);
  });

  it("routes, server pages, scripts, bootstrap, and operations use module interfaces", () => {
    const callers = [
      ...sourceFiles("app"),
      ...sourceFiles("scripts"),
      ...sourceFiles("src/server/bootstrap"),
      ...sourceFiles("src/server/operations"),
    ];
    const violations = callers.flatMap((file) =>
      imports(file)
        .filter((specifier) => /^@\/src\/server\/modules\/[^/]+\//.test(specifier))
        .map((specifier) => `${display(file)} -> ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it("does not reference deleted backend paths", () => {
    const deleted = [
      "/server/definitions",
      "/server/questionnaires",
      "/server/action-plans",
      "/server/applicability-check",
      "/server/corpus",
      "/server/documents",
      "/server/gap-analysis",
      "/server/organizations",
      "/server/reports",
      "/server/api",
      "/server/ai",
      "/server/jobs",
      "/server/job-execution",
      "/server/uploads",
    ];
    const violations = [
      ...sourceFiles("app"),
      ...sourceFiles("components"),
      ...sourceFiles("scripts"),
      ...sourceFiles("src"),
    ].flatMap((file) =>
      imports(file)
        .filter((specifier) => deleted.some((path) => specifier.includes(path)))
        .map((specifier) => `${display(file)} -> ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it("gives every business module one public index", () => {
    expect(
      businessModules.filter(
        (moduleName) =>
          !existsSync(resolve(root, "src/server/modules", moduleName, "index.ts")),
      ),
    ).toEqual([]);
  });

  it("keeps the Drizzle schema behind ownership files", () => {
    const facade = readFileSync(resolve(root, "src/db/schema.ts"), "utf8");
    for (const owner of [
      "organizations",
      "assessments",
      "documents",
      "jobs",
      "ai",
      "legal-corpus",
      "gap-analysis",
      "action-plans",
      "reports",
      "operations",
    ]) {
      expect(facade).toContain(`./schema/${owner}`);
      expect(existsSync(resolve(root, "src/db/schema", `${owner}.ts`))).toBe(true);
    }
    expect(facade.split("\n").filter(Boolean)).toHaveLength(10);
  });
});

function sourceFiles(directory: string): string[] {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    const path = resolve(absolute, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(relative(root, path))
      : /\.[cm]?[jt]sx?$/.test(entry)
        ? [path]
        : [];
  });
}

function imports(file: string) {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g)].map(
    (match) => match[2],
  );
}

function display(file: string) {
  return relative(root, file).replaceAll("\\", "/");
}
