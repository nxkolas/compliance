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

    const query = execute.mock.calls[0][0];
    expect(containsDate(query)).toBe(false);
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

function containsDate(value: unknown, seen = new Set<object>()): boolean {
  if (value instanceof Date) return true;
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return false;
  }

  seen.add(value);
  return Object.values(value).some((nested) => containsDate(nested, seen));
}
