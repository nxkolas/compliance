import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "components"];
const explicitFiles = ["src/server/reports/renderer.tsx"];
const userFacingAttributes = new Set([
  "alt",
  "aria-label",
  "description",
  "label",
  "placeholder",
  "title",
]);
const userFacingObjectKeys = new Set([
  "description",
  "label",
  "message",
  "placeholder",
  "title",
]);
const allowedLiterals = new Set([
  // Language-neutral visual placeholders and approved product names.
  "complyX",
  "NIS2",
]);

const files = [
  ...roots.flatMap((root) => collectTsxFiles(path.resolve(root))),
  ...explicitFiles.map((file) => path.resolve(file)),
];
const violations: string[] = [];

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  visit(source);

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      record(node, node.text, "JSX text");
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source);
      if (userFacingAttributes.has(name)) {
        if (ts.isStringLiteral(node.initializer)) {
          record(node.initializer, node.initializer.text, `${name} attribute`);
        } else if (
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          isStringLiteralLike(node.initializer.expression)
        ) {
          record(
            node.initializer.expression,
            node.initializer.expression.text,
            `${name} prop`,
          );
        }
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      userFacingObjectKeys.has(propertyName(node.name)) &&
      isStringLiteralLike(node.initializer)
    ) {
      record(
        node.initializer,
        node.initializer.text,
        `${propertyName(node.name)} property`,
      );
    }

    if (
      ts.isCallExpression(node) &&
      isConfirmationCall(node.expression) &&
      node.arguments[0] &&
      isStringLiteralLike(node.arguments[0])
    ) {
      record(node.arguments[0], node.arguments[0].text, "confirmation copy");
    }

    ts.forEachChild(node, visit);
  }

  function record(node: ts.Node, raw: string, kind: string) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!containsNaturalLanguage(value) || allowedLiterals.has(value)) return;
    const { line, character } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    violations.push(
      `${path.relative(process.cwd(), file)}:${line + 1}:${character + 1} ${kind}: ${JSON.stringify(value)}`,
    );
  }
}

if (violations.length) {
  console.error(
    [
      "Hardcoded user-facing copy found. Move it into a typed feature message module:",
      ...violations.map((violation) => `- ${violation}`),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`i18n guard passed (${files.length} TSX files checked).`);
}

function collectTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(target);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [target] : [];
  });
}

function containsNaturalLanguage(value: string) {
  return /[\p{Letter}]{2}/u.test(value);
}

function isStringLiteralLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function propertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? name.text
    : name.getText();
}

function isConfirmationCall(expression: ts.Expression) {
  if (ts.isIdentifier(expression)) return expression.text === "confirm";
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "confirm"
  );
}
