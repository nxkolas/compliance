import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const { relations } = await import("@/src/db/relations");

  return {
    db: drizzle(async () => ({ rows: [] }), { relations }),
  };
});

import { buildDocumentUsageQuery } from "@/src/server/documents/service";

describe("buildDocumentUsageQuery", () => {
  it("builds the union used to load document usage", () => {
    expect(() =>
      buildDocumentUsageQuery("organization-id", [
        "document-version-id",
      ]).toSQL(),
    ).not.toThrow();
  });
});
