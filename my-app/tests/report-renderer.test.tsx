import { describe, expect, it } from "vitest";
import { renderComplianceReport } from "@/src/server/reports/renderer";
import type { ReportRenderSnapshot } from "@/src/server/reports/render-snapshot";
import { PDFParse } from "pdf-parse";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SHA256_PATTERN = /\b[0-9a-f]{64}\b/i;

describe("compliance report renderer", () => {
  it.each([
    {
      locale: "de" as const,
      expected: [
        "Compliance-Bericht",
        "Muster Energie",
        "Muster Energieversorgung GmbH",
        "Wichtige Einrichtung",
        "Unveränderlicher Datenstand",
        "Betroffenheitsprüfung",
        "Feststellungen und Lücken",
        "Maßnahmenplan",
        "Anhang",
        "Quellenregister",
      ],
    },
    {
      locale: "en" as const,
      expected: [
        "Compliance report",
        "Muster Energie",
        "Important entity",
        "Applicability assessment",
        "Findings and gaps",
        "Action plan",
        "Appendix",
        "Source register",
      ],
    },
  ])("renders the localized report structure in $locale", async ({
    locale,
    expected,
  }) => {
    const pdf = await renderComplianceReport({
      locale,
      snapshot: snapshot({ locale }),
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");

    const text = await extractText(pdf);
    for (const label of expected) {
      expect(text).toContain(label);
    }
  });

  it("uses the frontend status wording instead of raw enum values", async () => {
    const pdf = await renderComplianceReport({ locale: "de", snapshot: snapshot({}) });
    const text = await extractText(pdf);

    expect(text).toContain("Nicht erfüllt");
    expect(text).toContain("Teilweise erfüllt");
    expect(text).toContain("Offen");
    expect(text).not.toContain("not_fulfilled");
    expect(text).not.toContain("partially_fulfilled");
    expect(text).not.toContain("in_progress");
  });

  it("prints the legal basis instead of verbatim source excerpts", async () => {
    const pdf = await renderComplianceReport({ locale: "de", snapshot: snapshot({}) });
    const text = await extractText(pdf);

    expect(text).toContain("Rechtsgrundlage");
    expect(text).toContain("BSI-Gesetz: § 30 Absatz 2 Nummer 1, § 30 Absatz 1");
    expect(text).not.toContain("VERBATIM_EXCERPT_SENTINEL");
  });

  it("never leaks identifiers or hashes into the rendered document", async () => {
    const pdf = await renderComplianceReport({ locale: "de", snapshot: snapshot({}) });
    const text = await extractText(pdf);

    expect(text).not.toMatch(UUID_PATTERN);
    expect(text).not.toMatch(SHA256_PATTERN);
    expect(text).not.toContain("Eingabe-SHA-256");
    expect(text).not.toContain("Nachweis:");
  });

  it("leads with the classification and never states applicability as a verdict", async () => {
    const de = await extractText(
      await renderComplianceReport({ locale: "de", snapshot: snapshot({}) }),
    );
    const en = await extractText(
      await renderComplianceReport({ locale: "en", snapshot: snapshot({ locale: "en" }) }),
    );

    expect(de).toContain("Wichtige Einrichtung");
    expect(de).not.toMatch(/anwendbar/i);
    expect(en).toContain("Important entity");
    // "Applicability assessment" is a section title; the verdict word is not.
    expect(en).not.toMatch(/\bapplicable\b/i);
  });

  it("prints a running footer with page numbers on every content page", async () => {
    const pdf = await renderComplianceReport({ locale: "de", snapshot: snapshot({}) });
    const text = await extractText(pdf);

    // @react-pdf silently drops a fixed footer whose dynamic `render` Text
    // carries a lineHeight, so assert the counter really made it into the PDF.
    expect(text).toContain("Muster Energieversorgung GmbH · Vertraulich");
    expect(text).toMatch(/Seite 2 von \d+/);
    expect(text).toMatch(/Seite 3 von \d+/);
  });

  it("reports the open gap count and the per-status tallies", async () => {
    const pdf = await renderComplianceReport({ locale: "de", snapshot: snapshot({}) });
    const text = await extractText(pdf);

    expect(text).toContain("Offene Lücken");
    // Three gap items sit under the two findings that are not fulfilled.
    expect(text).toMatch(/3\s*Offene Lücken/);
  });

  it("renders an empty plan without throwing", async () => {
    const base = snapshot({});
    const pdf = await renderComplianceReport({
      locale: "de",
      snapshot: {
        ...base,
        content: {
          ...base.content,
          gap: { openGapItemCount: 0, statusCounts: zeroGapCounts(), findings: [] },
          actions: {
            statusCounts: { open: 0, in_progress: 0, done: 0, cancelled: 0 },
            groups: [],
          },
          sourceRegister: [],
        },
      },
    });
    const text = await extractText(pdf);

    expect(text).toContain("Die Gap-Analyse enthält keine Feststellungen.");
    expect(text).toContain("Es wurde kein Maßnahmenplan erstellt.");
    expect(text).toContain("Für diesen Bericht sind keine Quellen verknüpft.");
  });
});

function zeroGapCounts() {
  return {
    not_fulfilled: 0,
    partially_fulfilled: 0,
    insufficient_evidence: 0,
    fulfilled: 0,
  };
}

function snapshot(overrides: { locale?: "de" | "en" }): ReportRenderSnapshot {
  const locale = overrides.locale ?? "de";
  return {
    capturedAt: "2026-08-04T14:59:00.000Z",
    locale,
    applicabilityRevisionId: "00000000-0000-4000-8000-000000000003",
    gapRevisionId: "00000000-0000-4000-8000-000000000004",
    actionPlanId: "00000000-0000-4000-8000-000000000005",
    documentVersionIds: ["00000000-0000-4000-8000-000000000006"],
    content: {
      organization: {
        name: "Muster Energie",
        legalName: "Muster Energieversorgung GmbH",
      },
      applicability: {
        outcome: locale === "de" ? "Wichtige Einrichtung" : "Important entity",
        outcomeCode: "important_entity",
        jurisdiction: "DE",
        answers: [
          {
            question: "Erbringt Ihre Organisation Dienste innerhalb der EU?",
            answer: "Ja",
          },
        ],
      },
      gap: {
        openGapItemCount: 3,
        statusCounts: {
          not_fulfilled: 1,
          partially_fulfilled: 1,
          insufficient_evidence: 0,
          fulfilled: 1,
        },
        findings: [
          {
            title: "Verantwortung und Organisation",
            status: "not_fulfilled",
            hasOrganizationDocument: false,
            reviewNotice: null,
            gaps: [
              "Eine klar benannte Person für IT-Sicherheit ist nicht festgelegt.",
              "Die Geschäftsleitung überwacht IT-Sicherheitsmaßnahmen nicht.",
            ],
            legalReferences: [{ instrument: "BSI-Gesetz", provision: "§ 38 Absatz 1" }],
          },
          {
            title: "Risiken und Überblick",
            status: "partially_fulfilled",
            hasOrganizationDocument: true,
            reviewNotice: "Die Angaben widersprechen dem hinterlegten Dokument.",
            gaps: ["Die Risikoanalyse wird nicht regelmäßig aktualisiert."],
            legalReferences: [
              { instrument: "BSI-Gesetz", provision: "§ 30 Absatz 2 Nummer 1" },
              { instrument: "BSI-Gesetz", provision: "§ 30 Absatz 1" },
            ],
          },
          {
            title: "Backups und Notfallvorsorge",
            status: "fulfilled",
            hasOrganizationDocument: true,
            reviewNotice: null,
            gaps: [],
            legalReferences: [{ instrument: "BSI-Gesetz", provision: "§ 30 Absatz 2 Nummer 3" }],
          },
        ],
      },
      actions: {
        statusCounts: { open: 1, in_progress: 1, done: 0, cancelled: 0 },
        groups: [
          {
            findingTitle: "Verantwortung und Organisation",
            items: [
              {
                title: "Verantwortliche Stelle für IT-Sicherheit benennen",
                result: "Eine verantwortliche Person oder ein Team ist benannt.",
                suggestedEvidence: ["Benennungsbeschluss", "Organigramm"],
                status: "open",
              },
              {
                title: "Geschäftsleitungsaufsicht etablieren",
                result: "Entscheidungen der Geschäftsleitung werden protokolliert.",
                suggestedEvidence: [],
                status: "in_progress",
              },
            ],
          },
        ],
      },
      sourceRegister: [
        {
          title: "Gesetz über das Bundesamt für Sicherheit in der Informationstechnik (BSIG)",
          reference: "BSI-Gesetz, § 30 Absatz 2 Nummer 1",
          location: "S. 24, 25",
        },
        {
          title: "IT-Sicherheitsrichtlinie.pdf",
          reference: null,
          location: "S. 3",
        },
      ],
    },
  };
}

async function extractText(pdf: Buffer) {
  const parser = new PDFParse({ data: pdf });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
