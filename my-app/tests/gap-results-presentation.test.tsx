import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import type { GapWorkflow } from "@/components/gap-analysis/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { GapResultsStep } from "@/components/gap-analysis/gap-results-step";

describe("Gap result presentation", () => {
  it("decides the document badge independently from source badges and omits duplicate guidance", () => {
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
    expect(html).not.toContain("DUPLICATE_GUIDANCE_SENTINEL");
  });
});

function workflowFixture() {
  const finding = (input: {
    id: string;
    hasOrganizationDocument: boolean;
    sources: Array<Record<string, unknown>>;
    reviewNotice: string | null;
  }) => ({
    finding: {
      id: input.id,
      status: "not_fulfilled",
      guidance: "DUPLICATE_GUIDANCE_SENTINEL",
      materialContradiction: Boolean(input.reviewNotice),
      contradictionResolved: false,
      reviewNotice: input.reviewNotice,
      gaps: [{ id: `${input.id}-gap`, statement: "A security owner is not assigned." }],
    },
    requirement: {
      id: `${input.id}-requirement`,
      stableRequirementId: `${input.id}-requirement`,
      title: `Requirement ${input.id}`,
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
        hasOrganizationDocument: true,
        reviewNotice: "The documented owner conflicts with the questionnaire.",
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
        hasOrganizationDocument: false,
        reviewNotice: null,
        sources: [],
      }),
    ],
    lifecycle: { canFinalize: false },
    canManage: false,
  } as unknown as GapWorkflow;
}
