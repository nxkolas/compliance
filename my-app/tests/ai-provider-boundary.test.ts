import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

describe("production model-call boundary", () => {
  it("allows model generation only in the Grounding Gateway adapter", () => {
    const root = join(process.cwd(), "src", "server");
    const matches = walk(root).filter((file) => /\bgenerate(Object|Text)\s*\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"));
    expect(matches).toEqual([
      "src/server/modules/grounding/providers/ai-sdk.ts",
    ]);
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}
