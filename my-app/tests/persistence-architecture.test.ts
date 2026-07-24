import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Rule =
  | "cross-module-private-import"
  | "full-row-relational-read"
  | "layer-database-import"
  | "live-polymorphic-reference"
  | "unprojected-select";

type Violation = {
  file: string;
  line: number;
  rule: Rule;
};

const repositoryRoot = resolve(import.meta.dirname, "..");
const productionRoots = [
  "app",
  "scripts",
  "src/client",
  "src/db",
  "src/server",
  "src/worker",
];
const persistenceModules = new Set([
  "action-plans",
  "applicability-check",
  "compliance",
  "corpus",
  "documents",
  "gap-analysis",
  "idempotency",
  "jobs",
  "reports",
  "uploads",
]);

// Phase 0 keeps known violations visible while making every new violation fail.
// Entries are removed as each module is migrated behind its public boundary.
const transitionalBaseline: Record<string, number> = {
  "cross-module-private-import": 0,
  "full-row-relational-read": 0,
  "layer-database-import": 0,
  "live-polymorphic-reference": 0,
  "unprojected-select": 0,
};

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return entry === "node_modules" || entry === ".next"
        ? []
        : listTypeScriptFiles(path);
    }

    return /\.(?:ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts") ? [path] : [];
  });
}

function sourceLine(sourceFile: ts.SourceFile, node: ts.Node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function serverModuleFor(path: string) {
  return path.match(/^src\/server\/([^/]+)\//)?.[1] ?? null;
}

function importedRepositoryPath(relativePath: string, moduleSpecifier: string) {
  if (moduleSpecifier.startsWith("@/")) return moduleSpecifier.slice(2);
  if (!moduleSpecifier.startsWith(".")) return null;
  return relative(
    repositoryRoot,
    resolve(dirname(resolve(repositoryRoot, relativePath)), moduleSpecifier),
  ).replaceAll("\\", "/");
}

function importedServerModule(relativePath: string, moduleSpecifier: string) {
  return importedRepositoryPath(relativePath, moduleSpecifier)?.match(
    /^src\/server\/([^/]+)(?:\/(.*))?$/,
  );
}

function isLayerPath(path: string) {
  return (
    path.startsWith("app/") ||
    path.startsWith("scripts/") ||
    path.startsWith("src/client/") ||
    path.startsWith("src/worker/")
  );
}

function propertyName(property: ts.ObjectLiteralElementLike) {
  return property.name && ts.isIdentifier(property.name)
    ? property.name.text
    : property.name && ts.isStringLiteral(property.name)
      ? property.name.text
      : null;
}

function scanFile(path: string): Violation[] {
  const relativePath = relative(repositoryRoot, path).replaceAll("\\", "/");
  const sourceText = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: Violation[] = [];

  function add(rule: Rule, node: ts.Node) {
    violations.push({
      file: relativePath,
      line: sourceLine(sourceFile, node),
      rule,
    });
  }

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const moduleSpecifier = node.moduleSpecifier.text;

      const importedPath = importedRepositoryPath(relativePath, moduleSpecifier);
      if (isLayerPath(relativePath) && /^src\/db(?:\/|$)/.test(importedPath ?? "")) {
        add("layer-database-import", node);
      }

      const imported = importedServerModule(relativePath, moduleSpecifier);
      if (
        imported?.[2] &&
        imported[2] !== "domain" &&
        persistenceModules.has(imported[1])
      ) {
        const ownerModule = serverModuleFor(relativePath);
        const targetModule = imported[1];
        const crossesServerModule =
          ownerModule !== null && ownerModule !== targetModule;

        if (isLayerPath(relativePath) || crossesServerModule) {
          add("cross-module-private-import", node);
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;

      if (
        (relativePath.startsWith("src/server/") ||
          relativePath.startsWith("src/worker/")) &&
        method === "select" &&
        node.arguments.length === 0
      ) {
        add("unprojected-select", node);
      }

      if (
        (relativePath.startsWith("src/server/") ||
          relativePath.startsWith("src/worker/")) &&
        (method === "findFirst" || method === "findMany") &&
        node.expression.expression.getText(sourceFile).includes(".query.")
      ) {
        const options = node.arguments[0];
        const hasProjection =
          options &&
          ts.isObjectLiteralExpression(options) &&
          options.properties.some((property) => propertyName(property) === "columns");

        if (!hasProjection) {
          add("full-row-relational-read", node);
        }
      }
    }

    if (
      relativePath === "src/db/schema.ts" &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "pgTable"
    ) {
      const tableName = node.arguments[0];
      const columns = node.arguments[1];

      if (
        tableName &&
        ts.isStringLiteral(tableName) &&
        !["audit_events", "platform_audit_events"].includes(tableName.text) &&
        columns &&
        ts.isObjectLiteralExpression(columns)
      ) {
        const names = new Set(columns.properties.map(propertyName).filter(Boolean));
        const hasLivePair =
          (names.has("sourceType") && names.has("sourceId")) ||
          (names.has("resultType") && names.has("resultId"));

        if (hasLivePair) {
          add("live-polymorphic-reference", node);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function groupViolations(violations: Violation[]) {
  return violations.reduce<Record<string, number>>((groups, violation) => {
    const key = violation.rule;
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});
}

describe("persistence architecture", () => {
  it("introduces no violations beyond the transitional baseline", () => {
    const violations = productionRoots.flatMap((root) =>
      listTypeScriptFiles(resolve(repositoryRoot, root)).flatMap(scanFile),
    );
    const grouped = groupViolations(violations);
    const unexpected = Object.entries(grouped)
      .filter(([key, count]) => count > (transitionalBaseline[key] ?? 0))
      .map(([key, count]) => ({
        allowed: transitionalBaseline[key] ?? 0,
        count,
        key,
        locations: violations
          .filter((violation) => violation.rule === key)
          .map((violation) => `${violation.file}:${violation.line}`),
      }))
      .sort((left, right) => left.key.localeCompare(right.key));

    expect(unexpected).toEqual([]);
  });
});
