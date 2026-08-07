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

  /**
   * `lib/ai/providers` reads `OPENAI_API_KEY`, and `lib/ai/models` builds on it.
   * Neither would leak the key if bundled -- a variable without the
   * `NEXT_PUBLIC_` prefix resolves to undefined in the browser -- but the
   * failure would be a confusing runtime error in a credential path, and a
   * later rename could turn it into a real leak. `lib/ai/types` carries no
   * secrets and is deliberately still importable by client code.
   */
  it("keeps AI credential modules out of client-side code", () => {
    const offenders = sourceFiles("app", "components", "src/client")
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return (
          (file.includes("src\\client") || file.includes("src/client") ||
            source.startsWith('"use client"')) &&
          /@\/lib\/ai\/(?:models|providers)(?:\/|["'])/.test(source)
        );
      });
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
