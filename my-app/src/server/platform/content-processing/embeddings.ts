export function validateEmbeddings(
  embeddings: number[][],
  expectedCount: number,
  expectedDimensions: number,
) {
  if (embeddings.length !== expectedCount) {
    throw new Error("Embedding result count does not match the requested chunks");
  }
  for (const embedding of embeddings) {
    const magnitude = Math.hypot(...embedding);
    if (
      embedding.length !== expectedDimensions ||
      embedding.some((value) => !Number.isFinite(value)) ||
      !Number.isFinite(magnitude) ||
      magnitude === 0
    ) {
      throw new Error("Embedding dimensions do not match the configured space");
    }
  }
}
