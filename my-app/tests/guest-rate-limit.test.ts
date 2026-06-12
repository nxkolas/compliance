import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: { execute },
}));

import { enforceGuestCreationRateLimit } from "@/src/server/guest-assessments/rate-limit";

describe("guest creation rate limit", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("allows the fifth request in a window", async () => {
    execute.mockResolvedValue([{ requestCount: 5 }]);

    await expect(
      enforceGuestCreationRateLimit("203.0.113.10"),
    ).resolves.toBeUndefined();
  });

  it("rejects requests over the shared window limit", async () => {
    execute.mockResolvedValue([{ requestCount: 6 }]);

    await expect(
      enforceGuestCreationRateLimit("203.0.113.10"),
    ).rejects.toMatchObject({
      status: 429,
      message: "Too many guest assessments. Please try again later.",
    });
  });

  it("fails closed when the counter query returns no row", async () => {
    execute.mockResolvedValue([]);

    await expect(
      enforceGuestCreationRateLimit("203.0.113.10"),
    ).rejects.toMatchObject({ status: 429 });
  });
});
