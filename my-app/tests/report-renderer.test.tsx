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

  it("renders the pinned historical compliance content", async () => {
    const pdf = await renderComplianceReport({
      reportId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      locale: "en",
      inputHash: "b".repeat(64),
      snapshot: {
        capturedAt: "2026-08-02T12:00:00.000Z",
        applicabilityRevisionId: "00000000-0000-4000-8000-000000000003",
        gapRevisionId: "00000000-0000-4000-8000-000000000004",
        actionPlanId: "00000000-0000-4000-8000-000000000005",
        documentVersionIds: ["00000000-0000-4000-8000-000000000006"],
        content: {
          applicability: {
            outcome: "Covered by NIS2",
            jurisdiction: "DE",
            answers: [
              { question: "Does the organization provide digital services?", answer: "Yes" },
            ],
          },
          findings: [
            {
              title: "Governance",
              status: "Not fulfilled",
              summary: "Governance evidence is incomplete.",
              gaps: ["Security owner is not assigned."],
              sources: ["Security policy.pdf — page 2"],
            },
          ],
          actions: [
            {
              title: "Assign security owner",
              description: "A named owner is approved and documented.",
              status: "Open",
            },
          ],
        },
      },
    });
    const text = await extractText(pdf);
    for (const expected of [
      "Covered by NIS2",
      "Does the organization provide digital services?",
      "Security owner is not assigned.",
      "Security policy.pdf",
      "Assign security owner",
    ]) {
      expect(text).toContain(expected);
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
