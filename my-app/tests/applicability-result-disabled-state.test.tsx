import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCompletedApplicabilityRecalculationLock: vi.fn(),
  getCompletedApplicabilityResult: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useSelectedLayoutSegment: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/supabase/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/lib/i18n", () => ({
  getDictionary: vi.fn().mockResolvedValue({
    modules: {
      applicabilityCheck: {
        recalculationLocked: "Locked",
        result: {
          answers: "Answers",
          overview: "Overview",
        },
      },
    },
  }),
  getLocale: vi.fn().mockResolvedValue("de"),
}));

vi.mock(
  "@/app/tool/organizations/[organizationId]/applicability-check/(completed)/data",
  () => ({
    getCompletedApplicabilityRecalculationLock:
      mocks.getCompletedApplicabilityRecalculationLock,
    getCompletedApplicabilityResult: mocks.getCompletedApplicabilityResult,
  }),
);

describe("completed applicability result actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompletedApplicabilityResult.mockResolvedValue({
      result: {
        label: "Wichtige Einrichtung",
        labelEn: "Important entity",
      },
    });
    mocks.getCompletedApplicabilityRecalculationLock.mockResolvedValue({
      locked: true,
    });
  });

  it("visually distinguishes the locked recalculation button", async () => {
    const { default: CompletedApplicabilityCheckLayout } = await import(
      "@/app/tool/organizations/[organizationId]/applicability-check/(completed)/layout"
    );
    const element = await CompletedApplicabilityCheckLayout({
      children: <div>Result</div>,
      params: Promise.resolve({ organizationId: "organization-1" }),
    });
    const html = renderToStaticMarkup(element);
    const labelIndex = html.indexOf("Betroffenheitscheck neu berechnen");
    const buttonStart = html.lastIndexOf("<button", labelIndex);
    const buttonEnd = html.indexOf(">", buttonStart);
    const buttonTag = html.slice(buttonStart, buttonEnd + 1);

    expect(buttonTag).toContain("disabled");
    expect(buttonTag).toContain("disabled:bg-muted");
    expect(buttonTag).toContain("disabled:text-muted-foreground");
    expect(buttonTag).toContain("disabled:outline-border-strong");
    expect(buttonTag).toContain("disabled:opacity-100");
  });
});
