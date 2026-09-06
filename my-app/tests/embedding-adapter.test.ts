import { describe, expect, it } from "vitest";
import {
  adaptEmbeddings,
  normalizeEmbedding,
  validateEmbeddings,
} from "@/src/server/modules/documents/embeddings";

describe("embedding adapter", () => {
  it("normalizes a vector of the declared width to unit length", () => {
    const native = Array.from({ length: 2_560 }, (_, index) => index + 1);
    const [adapted] = adaptEmbeddings([native], 2_560);

    expect(adapted).toHaveLength(2_560);
    expect(Math.hypot(...adapted)).toBeCloseTo(1, 12);
    expect(adapted.every(Number.isFinite)).toBe(true);
  });

  /**
   * Truncation was dropped when the embedding model became an organization's
   * own choice. Cutting a vector to a shorter width is only sound for a
   * Matryoshka-trained model, and nothing here can tell whether the model the
   * user picked is one -- so a width disagreement has to fail loudly instead.
   */
  it("rejects a vector wider than the declared width rather than truncating", () => {
    const native = Array.from({ length: 2_560 }, (_, index) => index + 1);

    expect(() => adaptEmbeddings([native], 1_536)).toThrow(
      "returned 2560 dimensions, but the configuration declares 1536",
    );
  });

  it("rejects short, non-finite, and zero-norm vectors", () => {
    expect(() => adaptEmbeddings([[1, 2]], 3)).toThrow(
      "returned 2 dimensions, but the configuration declares 3",
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
