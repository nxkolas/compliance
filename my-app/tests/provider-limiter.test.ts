import { describe, expect, it } from "vitest";
import { ProviderLimiter } from "@/src/server/ai/grounding/provider-limiter";
import {
  configuredCategoryConcurrency,
  configuredProviderMaxConcurrency,
} from "@/src/server/ai/generation/concurrency";

describe("AI concurrency configuration", () => {
  it.each([3, 4, 5])("preserves category concurrency %s", (value) => {
    expect(
      configuredCategoryConcurrency({
        AI_CATEGORY_CONCURRENCY: String(value),
      }),
    ).toBe(value);
  });

  it("defaults both limits to 3 and rejects out-of-range values", () => {
    expect(configuredCategoryConcurrency({})).toBe(3);
    expect(configuredProviderMaxConcurrency({})).toBe(3);
    expect(() =>
      configuredCategoryConcurrency({ AI_CATEGORY_CONCURRENCY: "6" }),
    ).toThrow("AI_CATEGORY_CONCURRENCY must be an integer between 1 and 5");
    expect(() =>
      configuredProviderMaxConcurrency({
        AI_PROVIDER_MAX_CONCURRENCY: "101",
      }),
    ).toThrow(
      "AI_PROVIDER_MAX_CONCURRENCY must be an integer between 1 and 100",
    );
  });
});

describe("ProviderLimiter", () => {
  it("shares the configured permits and releases them after work settles", async () => {
    const limiter = new ProviderLimiter(2);
    const releaseFirst = await limiter.acquire();
    const releaseSecond = await limiter.acquire();
    let thirdAcquired = false;
    const third = limiter.acquire().then((release) => {
      thirdAcquired = true;
      return release;
    });
    await Promise.resolve();
    expect(thirdAcquired).toBe(false);
    releaseFirst();
    const releaseThird = await third;
    expect(thirdAcquired).toBe(true);
    releaseSecond();
    releaseThird();
  });

  it("removes an aborted waiter without consuming a permit", async () => {
    const limiter = new ProviderLimiter(1);
    const release = await limiter.acquire();
    const controller = new AbortController();
    const waiting = limiter.acquire(controller.signal);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    release();
    const nextRelease = await limiter.acquire();
    nextRelease();
  });
});
