import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { modulesMessages } from "@/src/i18n/messages/modules";
import type { GapWorkflow } from "@/components/gap-analysis/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { GapResultsStep } from "@/components/gap-analysis/gap-results-step";

describe("Gap result presentation", () => {
  it("renders the Figma result cards from real finding fields", () => {
    const html = renderToStaticMarkup(
      <GapResultsStep
        organizationId="00000000-0000-4000-8000-000000000001"
        workflow={workflowFixture()}
        labels={modulesMessages.en.modules.gapAnalysis.workflow}
        locale="en"
        onError={() => undefined}
      />,
    );

    expect(html).toContain("Document provided");
    expect(html).toContain("No document provided");
    expect(html).toContain("Organization policy");
    expect(html).toContain("No sources linked");
    expect(html).toContain("The documented owner conflicts with the questionnaire.");
    expect(html).toContain("A security owner is not assigned.");
    expect(html).toContain("data-gap-results");
    expect(html).toContain("data-gap-results-locked");
    expect(html).toContain("bg-[#191F3C]");
    expect(html).toContain("outline-[#122272]");
    expect(html.match(/data-gap-result-card/g)).toHaveLength(4);
    expect(html.match(/data-gap-contradiction/g)).toHaveLength(1);
    expect(html).toContain("max-w-[1046px]");
    expect(html).toContain("min-h-24");
    expect(html).toContain("bg-zinc-800");
    expect(html).toContain("outline-red-400");
    expect(html).toMatch(/data-gap-status-filter="all"[^>]*>[\s\S]*?>4<\/span>/);
    for (const status of [
      "not_fulfilled",
      "partially_fulfilled",
      "insufficient_evidence",
      "fulfilled",
    ]) {
      expect(html).toMatch(
        new RegExp(
          `data-gap-status-filter="${status}"[^>]*>[\\s\\S]*?>1</span>`,
        ),
      );
    }
    expect(html).not.toContain("finding-1-gap");
    expect(html).not.toContain("document:1");
    expect(html).not.toContain("DUPLICATE_GUIDANCE_SENTINEL");
    expect(html).toContain('stroke="#EAB446"');
    expect(html).toContain('stroke="#7E6181"');
    expect(html).toContain('stroke="#46A95A"');
    expect(html).toContain("M4.83171 9.41504L0.665039 13.5817");
  });

  it("omits locked and contradiction boxes when the real state does not require them", () => {
    const html = renderToStaticMarkup(
      <GapResultsStep
        organizationId="00000000-0000-4000-8000-000000000001"
        workflow={workflowFixture({ contradiction: false, locked: false })}
        labels={modulesMessages.en.modules.gapAnalysis.workflow}
        locale="en"
        onError={() => undefined}
      />,
    );

    expect(html).not.toContain("data-gap-results-locked");
    expect(html).not.toContain("data-gap-contradiction");
  });
});

function workflowFixture(
  options: { contradiction?: boolean; locked?: boolean } = {},
) {
  const contradiction = options.contradiction ?? true;
  const locked = options.locked ?? true;
  const finding = (input: {
    id: string;
    title: string;
    status: "not_fulfilled" | "partially_fulfilled" | "insufficient_evidence" | "fulfilled";
    hasOrganizationDocument: boolean;
    sources: Array<Record<string, unknown>>;
    reviewNotice: string | null;
  }) => ({
    finding: {
      id: input.id,
      status: input.status,
      guidance: "DUPLICATE_GUIDANCE_SENTINEL",
      materialContradiction: Boolean(input.reviewNotice),
      contradictionResolved: false,
      reviewNotice: input.reviewNotice,
      gaps: [{ id: `${input.id}-gap`, statement: "A security owner is not assigned." }],
    },
    requirement: {
      id: `${input.id}-requirement`,
      stableRequirementId: `${input.id}-requirement`,
      title: input.title,
      requirementText: "Requirement text",
      icon: "shield",
      criticality: "high",
      position: input.id === "finding-1" ? 1 : 2,
    },
    sources: input.sources,
    hasOrganizationDocument: input.hasOrganizationDocument,
    manuallyChanged: false,
  });

  return {
    revision: { id: "revision", outputLocale: "en", createdAt: new Date() },
    findings: [
      finding({
        id: "finding-1",
        title: "Responsibility and organization",
        status: "not_fulfilled",
        hasOrganizationDocument: true,
        reviewNotice: contradiction
          ? "The documented owner conflicts with the questionnaire."
          : null,
        sources: [{
          kind: "document",
          key: "document:1",
          label: "Organization policy",
          href: "/source",
          available: true,
          pageNumbers: [],
          sectionLabels: [],
        }],
      }),
      finding({
        id: "finding-2",
        title: "Risk management",
        status: "partially_fulfilled",
        hasOrganizationDocument: false,
        reviewNotice: null,
        sources: [],
      }),
      finding({
        id: "finding-3",
        title: "Evidence management",
        status: "insufficient_evidence",
        hasOrganizationDocument: false,
        reviewNotice: null,
        sources: [],
      }),
      finding({
        id: "finding-4",
        title: "Access control",
        status: "fulfilled",
        hasOrganizationDocument: true,
        reviewNotice: null,
        sources: [],
      }),
    ],
    lifecycle: {
      canFinalize: false,
      findingsEditable: !locked,
      locked,
    },
    canManage: false,
  } as unknown as GapWorkflow;
}
