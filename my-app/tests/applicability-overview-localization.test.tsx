import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLocale: vi.fn(),
  getApplicabilityOverviewForUser: vi.fn(),
  getApplicabilityRecalculationLockForUser: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

vi.mock("@/lib/supabase/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/lib/i18n", () => ({
  getLocale: mocks.getLocale,
  getDictionary: vi.fn().mockResolvedValue({
    modules: {
      applicabilityCheck: {
        title: "Applicability check",
        description: "Check whether NIS2 applies.",
        recalculationLocked: "Recalculation locked",
        overview: {
          resultMetric: "Result",
          revisionMetric: "Revision",
          statusMetric: "Status",
          pending: "Pending",
          currentTitle: "Current applicability check",
          lastCalculation: "Last calculation",
          noDate: "No date",
          noResult: "No result",
          viewResult: "View result",
          viewAnswers: "View answers",
          recalculate: "Recalculate",
          outcomes: {
            essentialEntity: "Essential entity",
            importantEntity: "Important entity",
            notDirectlyInScope: "Not directly in scope",
            clarificationRequired: "Clarification required",
          },
        },
      },
    },
  }),
}));

vi.mock("@/lib/i18n/format", () => ({
  formatDateTime: vi.fn().mockReturnValue("24 July 2026"),
}));

vi.mock("@/src/server/applicability-check/service", () => ({
  getApplicabilityOverviewForUser: mocks.getApplicabilityOverviewForUser,
  getApplicabilityRecalculationLockForUser:
    mocks.getApplicabilityRecalculationLockForUser,
}));

describe("applicability overview localization", () => {
  beforeEach(() => {
    mocks.getLocale.mockResolvedValue("en");
    mocks.getApplicabilityOverviewForUser.mockResolvedValue({
      assessmentRevisionNumber: 1,
      submittedAt: "2026-07-24T10:00:00.000Z",
      result: {
        result: {
          outcome: "important_entity",
          label: "Wichtige Einrichtung",
          labelEn: "Important entity",
          reasons: [
            "Deutsche Anlage-1-Identität mit mittlerer Unternehmensgröße.",
          ],
          reasonsEn: [
            "German Annex-1 identity with medium enterprise size.",
          ],
        },
      },
    });
    mocks.getApplicabilityRecalculationLockForUser.mockResolvedValue({
      locked: false,
    });
  });

  it("renders the compact current-result card in English", async () => {
    const { default: ApplicabilityCheckPage } = await import(
      "@/app/tool/organizations/[organizationId]/applicability-check/page"
    );
    const page = await ApplicabilityCheckPage({
      params: Promise.resolve({ organizationId: "organization-1" }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      "German Annex-1 identity with medium enterprise size.",
    );
    expect(markup).not.toContain(
      "Deutsche Anlage-1-Identität mit mittlerer Unternehmensgröße.",
    );
  });
});
