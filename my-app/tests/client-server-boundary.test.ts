import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("client/server dependency boundary", () => {
  it("keeps raw fetch out of Client Components", () => {
    const offenders = sourceFiles("app", "components")
      .filter((file) => readFileSync(file, "utf8").startsWith('"use client"'))
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("keeps database and server modules out of typed browser clients", () => {
    const offenders = sourceFiles("src/client").filter((file) => /@\/src\/(?:db|server)(?:\/|["'])/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

function sourceFiles(...directories: string[]) {
  return directories.flatMap((directory) => walk(join(root, directory)));
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
