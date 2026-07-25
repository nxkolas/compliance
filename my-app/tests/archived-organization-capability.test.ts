import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), organization: vi.fn() }));
vi.mock("@/src/db", () => ({ db: { query: { organizationMemberships: { findFirst: mocks.membership }, organizations: { findFirst: mocks.organization } } } }));
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";

describe("archived organization capability boundary", () => {
  beforeEach(() => {
    mocks.membership.mockResolvedValue({ role: "owner", status: "active" });
    mocks.organization.mockResolvedValue({ archivedAt: new Date() });
  });
  it("preserves history reads", async () => {
    await expect(requireOrganizationCapability("user", "organization", "reports:read")).resolves.toBeTruthy();
  });
  it("blocks writes and new AI work", async () => {
    await expect(requireOrganizationCapability("user", "organization", "gap:contribute")).rejects.toMatchObject({ code: "ORGANIZATION_ARCHIVED" });
    await expect(requireOrganizationCapability("user", "organization", "reports:create")).rejects.toMatchObject({ code: "ORGANIZATION_ARCHIVED" });
  });
});
