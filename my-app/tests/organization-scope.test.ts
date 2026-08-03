import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

vi.mock("@/src/server/auth/capability-service", () => ({
  requireOrganizationCapability: mocks.authorize,
}));

import {
  authorizeOrganizationRead,
  withAuthorizedOrganizationCommand,
} from "@/src/server/auth/organization-scope";

describe("organization scope", () => {
  const membership = {
    organizationId: "organization",
    userId: "actor",
    role: "owner" as const,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(membership);
  });

  it("returns immutable read identity and uses the supplied executor", async () => {
    const executor = { query: {} } as never;
    const scope = await authorizeOrganizationRead(
      {
        actorUserId: "actor",
        organizationId: "organization",
        capability: "documents:read",
      },
      executor,
    );

    expect(scope).toMatchObject({
      actorUserId: "actor",
      organizationId: "organization",
      capability: "documents:read",
      executor,
    });
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.membership)).toBe(true);
    expect(mocks.authorize).toHaveBeenCalledWith(
      "actor",
      "organization",
      "documents:read",
      executor,
    );
  });

  it("locks scope, authorizes, and executes the command on one transaction", async () => {
    const lock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([]),
    };
    const tx = { select: vi.fn(() => lock), query: {} };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const command = vi.fn(async (scope) => scope.executor);

    await expect(
      withAuthorizedOrganizationCommand(
        {
          actorUserId: "actor",
          organizationId: "organization",
          capability: "documents:write",
        },
        command,
      ),
    ).resolves.toBe(tx);

    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(lock.for).toHaveBeenCalledTimes(2);
    expect(mocks.authorize).toHaveBeenCalledWith(
      "actor",
      "organization",
      "documents:write",
      tx,
    );
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ executor: tx }),
    );
  });
});
