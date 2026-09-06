import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReportWorkflow } from "@/components/reports/report-workflow";
import { getDefaultDictionary } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const labels = getDefaultDictionary().reports.workflow;

describe("ReportWorkflow", () => {
  it("renders the designed empty state when no report exists", () => {
    const html = renderToStaticMarkup(
      <ReportWorkflow
        organizationId="00000000-0000-4000-8000-000000000001"
        locale="de"
        reports={[]}
        canCreate
        labels={labels}
      />,
    );

    expect(html).toContain("data-report-empty-state");
    expect(html).toContain("Noch kein Bericht erstellt.");
    expect(html).toContain("Erstellen Sie Ihren ersten Compliance-Bericht");
    expect(html).toContain("Bericht erstellen");
    expect(html).toContain("data-report-create-action");
    expect(html).toContain("data-report-empty-icon");
    expect(html).toContain('viewBox="0 0 87 109"');
    expect(html).toContain('fill="#82848C"');
    expect(html).toContain("xl:min-h-96");
    expect(html).toContain("grid w-full min-w-0 gap-4 sm:gap-6");
    expect(html).not.toContain("max-w-[1202px]");
    expect(html).toContain("outline-[1.5px]");
    expect(html).not.toContain("data-report-list");
  });

  it("renders ready and failed reports with their matching actions", () => {
    const html = renderToStaticMarkup(
      <ReportWorkflow
        organizationId="00000000-0000-4000-8000-000000000001"
        locale="de"
        reports={[
          report({
            id: "00000000-0000-4000-8000-000000000002",
            state: "ready",
            inputHash: "1234567890abcdef",
          }),
          report({
            id: "00000000-0000-4000-8000-000000000003",
            state: "failed",
            inputHash: "failed1234567890",
          }),
        ]}
        canCreate
        labels={labels}
      />,
    );

    expect(html).toContain("data-report-list");
    expect(html).toContain("grid w-full min-w-0 gap-4 sm:gap-6");
    expect(html).not.toContain("xl:gap-16");
    expect(html).toContain("Bereit");
    expect(html).toContain("Fehlgeschlagen");
    expect(html).toContain("Herunterladen");
    expect(html).toContain("Erneut versuchen");
    expect(html).toContain("Verbindung zur Gap-Analyse wurde unterbrochen.");
    expect(html).toContain('data-report-state="ready"');
    expect(html).toContain('data-report-state="failed"');
    expect(html).toContain("min-h-48");
    expect(html).toContain("min-h-40");
    expect(html).toContain("border-emerald-500");
    expect(html).toContain("border-red-400");
    expect(html).toContain("bg-[#1B1E27]");
    expect(html).toContain("Betroffenheitscheck im Bericht");
    expect(html).not.toContain("Gap-Analyse im Bericht");
    expect(html).not.toContain("Maßnahmenplan im Bericht");
    expect(html).toContain("failed123456");
    expect(html).toContain("cursor-pointer");
    expect(html).not.toContain("w-[1202px]");
    expect(html).not.toContain("data-report-empty-state");
  });

  it.each([0, 1, 3])("renders calculated compliance and %i critical gaps", (count) => {
    const html = renderToStaticMarkup(
      <ReportWorkflow
        organizationId="00000000-0000-4000-8000-000000000001"
        locale="de"
        reports={[{
          ...report({ id: "00000000-0000-4000-8000-000000000002", state: "ready" }),
          gapRevisionId: "00000000-0000-4000-8000-000000000006",
          metrics: { compliancePercent: 58, criticalGapCount: count },
        }]}
        canCreate
        labels={labels}
      />,
    );
    expect(html).toContain("58 % Compliance");
    expect(html).toContain(count === 1 ? "1 kritische Lücke im Bericht" : `${count} kritische Lücken im Bericht`);
    expect(html).toContain(labels.complianceExplanation);
    expect(html).not.toContain("Betroffenheitscheck im Bericht");
  });

  it("only lists report sections that are present in its source revisions", () => {
    const html = renderToStaticMarkup(
      <ReportWorkflow
        organizationId="00000000-0000-4000-8000-000000000001"
        locale="de"
        reports={[{
          ...report({ id: "00000000-0000-4000-8000-000000000002", state: "ready" }),
          gapRevisionId: "00000000-0000-4000-8000-000000000006",
          actionPlanId: "00000000-0000-4000-8000-000000000007",
        }]}
        canCreate={false}
        labels={labels}
      />,
    );

    expect(html).toContain("Keine Kennzahlen zur Gap-Analyse verfügbar");
    expect(html).toContain("Maßnahmenplan im Bericht");
    expect(html).toContain("Herunterladen");
    expect(html).not.toContain("Erneut versuchen");
    expect(html).not.toContain("data-report-create-action");
  });
});

function report({
  id,
  state,
  inputHash = null,
}: {
  id: string;
  state: "ready" | "failed";
  inputHash?: string | null;
}) {
  return {
    id,
    organizationId: "00000000-0000-4000-8000-000000000001",
    applicabilityRevisionId: "00000000-0000-4000-8000-000000000004",
    gapRevisionId: null,
    actionPlanId: null,
    renderingJobId: "00000000-0000-4000-8000-000000000005",
    locale: "de" as const,
    inputHash,
    pdfHash: state === "ready" ? "abcdef" : null,
    pdfByteSize: state === "ready" ? 1024 : null,
    state,
    createdAt: "2026-09-04T10:30:00.000Z",
    metrics: null,
  };
}
