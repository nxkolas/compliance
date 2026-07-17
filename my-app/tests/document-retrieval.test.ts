import { describe, expect, it, vi } from "vitest";
import {
  assertSelectedDocumentVersionScope,
  hybridScore,
} from "@/src/server/documents/retrieval";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("document evidence retrieval", () => {
  it("fails closed for cross-organization or unknown selected versions", () => {
    expect(() =>
      assertSelectedDocumentVersionScope("org-1", ["v1", "v2"], [
        { id: "v1", organizationId: "org-1" },
        { id: "v2", organizationId: "org-2" },
      ]),
    ).toThrow(/not found/i);
  });

  it("deduplicates an explicitly selected organization corpus", () => {
    expect(
      assertSelectedDocumentVersionScope("org-1", ["v1", "v1"], [
        { id: "v1", organizationId: "org-1" },
      ]),
    ).toEqual(["v1"]);
  });

  it("weights semantic and full-text evidence deterministically", () => {
    expect(hybridScore({ fullTextRank: 1, cosineSimilarity: 0 })).toBe(0.35);
    expect(hybridScore({ fullTextRank: 0, cosineSimilarity: 1 })).toBe(0.65);
  });
});
