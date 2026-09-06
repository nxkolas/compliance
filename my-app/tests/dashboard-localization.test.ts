import { describe, expect, it } from "vitest";
import { getDictionaryForLocale } from "@/src/i18n";
import { buildDashboardPresentation } from "@/src/i18n/dashboard";

const dashboard = {
  applicability: { outcome: "important_entity" },
  gap: { findingCount: 3, criticalCount: 1 },
  evidence: { currentVersionCount: 2 },
  plan: { openItems: 4, totalItems: 5 },
  report: { state: "ready" },
  nextSteps: ["upload_evidence", "work_action_plan"],
};

describe("dashboard localization", () => {
  it("presents dashboard values entirely in English", () => {
    const labels = getDictionaryForLocale("en").modules.dashboard;
    const presentation = buildDashboardPresentation(dashboard, labels);

    expect(presentation.metrics).toEqual([
      { label: "Applicability status", value: "Important entity" },
      { label: "Open actions", value: "4" },
      { label: "Critical findings", value: "1" },
    ]);
    expect(presentation.cards[1].items).toEqual([
      "Upload evidence",
      "Work through the action plan",
    ]);
    expect(presentation.cards[0].items).toContain("Report: Ready");
  });

  it("presents dashboard values entirely in German", () => {
    const labels = getDictionaryForLocale("de").modules.dashboard;
    const presentation = buildDashboardPresentation(dashboard, labels);

    expect(presentation.metrics[0]).toEqual({
      label: "Betroffenheitsstatus",
      value: "Wichtige Einrichtung",
    });
    expect(presentation.cards[1].items).toEqual([
      "Nachweise hochladen",
      "Maßnahmenplan bearbeiten",
    ]);
    expect(presentation.cards[0].items).toContain("Bericht: Bereit");
  });
});
