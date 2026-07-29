import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateActionPlanItem: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/action-plans", () => ({
  updateActionPlanItem: mocks.updateActionPlanItem,
}));

import { PATCH } from "@/app/api/organizations/[organizationId]/action-plan/items/[itemId]/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const itemId = "00000000-0000-4000-8000-000000000003";

function request(body: unknown) {
  return new Request(
    `http://localhost/api/organizations/${organizationId}/action-plan/items/${itemId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": '"4"',
      },
      body: JSON.stringify(body),
    },
  );
}

const context = {
  params: Promise.resolve({ organizationId, itemId }),
};

describe("action-plan status update route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.updateActionPlanItem.mockResolvedValue({
      id: itemId,
      status: "done",
      version: 5,
    });
  });

  it("updates only the status with optimistic concurrency", async () => {
    const response = await PATCH(request({ status: "done" }), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"5"');
    expect(mocks.updateActionPlanItem).toHaveBeenCalledWith({
      userId,
      organizationId,
      itemId,
      status: "done",
      expectedVersion: 4,
    });
  });

  it.each([
    { status: "open", ownerUserId: userId },
    { status: "open", dueDate: "2026-08-31" },
    { status: "open", executionNotes: "Not editable" },
    {},
  ])("rejects non-status or missing-status input %#", async (body) => {
    const response = await PATCH(request(body), context);

    expect(response.status).toBe(400);
    expect(mocks.updateActionPlanItem).not.toHaveBeenCalled();
  });
});
