import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  loadGapAnalysisRelease: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache:
    <TArgs extends unknown[], TResult>(
      loader: (...args: TArgs) => Promise<TResult>,
      keyParts: string[],
    ) =>
    async (...args: TArgs) => {
      const key = [...keyParts, ...args.map(String)].join(":");
      if (mocks.cache.has(key)) return mocks.cache.get(key) as TResult;
      const value = await loader(...args);
      mocks.cache.set(key, value);
      return value;
    },
}));

vi.mock("@/src/server/gap-analysis/release-loader", () => ({
    createGapReleaseReader: (input: {
      loadPublished: (value: {
        releaseId: string;
        locale: "de" | "en";
      }) => Promise<unknown>;
    }) => ({
      getPublished: input.loadPublished,
    }),
    loadActiveGapAnalysisReleasePointer: vi.fn(),
    loadGapAnalysisRelease: mocks.loadGapAnalysisRelease,
}));

import { nextCachedGapReleaseReader } from "@/src/server/gap-analysis/next-cached-release-loader";

describe("published Gap release cache contract", () => {
  beforeEach(() => {
    mocks.cache.clear();
    mocks.loadGapAnalysisRelease.mockReset();
  });

  it("does not reuse pre-icon release payloads", async () => {
    mocks.cache.set("published-gap-analysis-release:release:en", {
      id: "release",
      requirements: [{ id: "requirement", title: "Access and personnel" }],
    });
    mocks.loadGapAnalysisRelease.mockResolvedValue({
      id: "release",
      requirements: [
        {
          id: "requirement",
          title: "Access and personnel",
          icon: "KeyRound",
        },
      ],
    });

    const release = await nextCachedGapReleaseReader.getPublished({
      releaseId: "release",
      locale: "en",
    });

    expect(release?.requirements[0]?.icon).toBe("KeyRound");
    expect(mocks.loadGapAnalysisRelease).toHaveBeenCalledOnce();
  });
});
