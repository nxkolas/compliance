import { describe, expect, it } from "vitest";
import { renderComplianceReport } from "@/src/server/reports/renderer";
import { PDFParse } from "pdf-parse";

describe("compliance report renderer", () => {
  it.each([
    {
      locale: "de" as const,
      expected: [
        "Compliance-Bericht",
        "Unveränderlicher Datenstand",
        "Quellen",
        "Betroffenheit",
        "Gap-Analyse",
        "Maßnahmenplan",
        "Dokumente",
        "Nachweis",
        "Organisation",
        "Bericht",
      ],
    },
    {
      locale: "en" as const,
      expected: [
        "Compliance report",
        "Immutable source snapshot",
        "Sources",
        "Applicability",
        "Gap analysis",
        "Action plan",
        "Documents",
        "Provenance",
        "Organization",
        "Report",
      ],
    },
  ])("renders localized pinned provenance text in $locale", async ({
    locale,
    expected,
  }) => {
    const pdf = await renderComplianceReport({
      reportId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      locale,
      inputHash: "a".repeat(64),
      snapshot: {
        capturedAt: "2026-07-22T12:00:00.000Z",
        applicabilityRevisionId: null,
        gapRevisionId: null,
        actionPlanId: null,
        documentVersionIds: [],
      },
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");

    const text = await extractText(pdf);
    for (const label of expected) {
      expect(text).toContain(label);
    }
  });
});

async function extractText(pdf: Buffer) {
  const parser = new PDFParse({ data: pdf });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
