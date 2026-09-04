import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicabilityOverviewForUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/src/supabase/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/src/server/modules/applicability-check", () => ({
  getApplicabilityOverviewForUser: mocks.getApplicabilityOverviewForUser,
}));

describe("applicability check entry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects directly to the saved result", async () => {
    mocks.getApplicabilityOverviewForUser.mockResolvedValue({
      assessmentRevisionNumber: 1,
      result: {
        result: {
          outcome: "important_entity",
        },
      },
    });

    const { default: ApplicabilityCheckPage } = await import(
      "@/app/tool/organizations/[organizationId]/applicability-check/page"
    );
    await ApplicabilityCheckPage({
      params: Promise.resolve({ organizationId: "organization-1" }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/tool/organizations/organization-1/applicability-check/result",
    );
  });

  it("redirects to the questionnaire when no result exists", async () => {
    mocks.getApplicabilityOverviewForUser.mockResolvedValue(null);

    const { default: ApplicabilityCheckPage } = await import(
      "@/app/tool/organizations/[organizationId]/applicability-check/page"
    );
    await ApplicabilityCheckPage({
      params: Promise.resolve({ organizationId: "organization-1" }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/tool/organizations/organization-1/applicability-check/new",
    );
  });
});
