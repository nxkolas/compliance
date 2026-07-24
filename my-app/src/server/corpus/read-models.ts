export function toLegalSourceVersionReadModel<
  T extends { upstreamPublishedAt: Date | null },
>(version: T) {
  return {
    ...version,
    upstreamPublication: version.upstreamPublishedAt
      ? {
          state: "known" as const,
          publishedAt: version.upstreamPublishedAt,
        }
      : {
          state: "unknown" as const,
          publishedAt: null,
        },
  };
}
