import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  let count = 1;
  const returning = vi.fn(async () => [{ count }]);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return {
    insert,
    values,
    returning,
    setCount(value: number) {
      count = value;
    },
  };
});

vi.mock("@/src/db", () => ({ db: { insert: database.insert } }));

import { enforceApiRequestRateLimit } from "@/src/server/platform/http/rate-limit";

describe("shared API request rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.setCount(1);
  });

  it("uses the original forwarded client address for one global API bucket", async () => {
    await enforceApiRequestRateLimit(
      new Request("http://localhost/api/organizations", {
        headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
      }),
    );

    expect(database.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "api:all:203.0.113.10" }),
    );
  });

  it("rejects requests above the shared limit", async () => {
    database.setCount(301);

    await expect(
      enforceApiRequestRateLimit(
        new Request("http://localhost/api/organizations"),
      ),
    ).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
});
