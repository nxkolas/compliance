import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: {
    query: { userProfiles: { findFirst: mocks.findFirst } },
    insert: mocks.insert,
  },
}));

import { synchronizeAuthenticatedActor } from "@/src/server/users";

describe("authenticated user directory synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.onConflictDoUpdate });
    mocks.onConflictDoUpdate.mockReturnValue({ returning: mocks.returning });
  });

  it("does not write when the projected identity is unchanged", async () => {
    const current = {
      userId: "00000000-0000-4000-8000-000000000001",
      email: "user@example.com",
      displayName: "User Name",
    };
    mocks.findFirst.mockResolvedValue(current);

    await expect(
      synchronizeAuthenticatedActor({
        id: current.userId,
        email: current.email,
        displayName: current.displayName,
      }),
    ).resolves.toBe(current);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("upserts a first or changed identity", async () => {
    const updated = {
      userId: "00000000-0000-4000-8000-000000000001",
      email: "new@example.com",
      displayName: "New Name",
    };
    mocks.findFirst.mockResolvedValue({
      ...updated,
      email: "old@example.com",
      displayName: "Old Name",
    });
    mocks.returning.mockResolvedValue([updated]);

    await expect(
      synchronizeAuthenticatedActor({
        id: updated.userId,
        email: updated.email,
        displayName: updated.displayName,
      }),
    ).resolves.toEqual(updated);
    expect(mocks.values).toHaveBeenCalledWith(updated);
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledOnce();
  });
});
