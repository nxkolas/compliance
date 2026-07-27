import { describe, expect, it } from "vitest";
import {
  adaptEmbeddings,
  normalizeEmbedding,
  validateEmbeddings,
} from "@/src/server/documents/embeddings";

describe("embedding adapter", () => {
  it("normalizes, truncates, and normalizes Matryoshka vectors again", () => {
    const native = Array.from({ length: 2_560 }, (_, index) => index + 1);
    const [adapted] = adaptEmbeddings([native], 1_536);

    expect(adapted).toHaveLength(1_536);
    expect(Math.hypot(...adapted)).toBeCloseTo(1, 12);
    expect(adapted.every(Number.isFinite)).toBe(true);
  });

  it("rejects short, non-finite, and zero-norm vectors", () => {
    expect(() => adaptEmbeddings([[1, 2]], 3)).toThrow(
      "Embedding dimensions do not match",
    );
    expect(() => normalizeEmbedding([0, 0])).toThrow("zero or invalid norm");
    expect(() => normalizeEmbedding([1, Number.NaN])).toThrow(
      "invalid values",
    );
    expect(() => validateEmbeddings([[0, 0]], 1, 2)).toThrow(
      "Embedding dimensions do not match",
    );
  });
});
