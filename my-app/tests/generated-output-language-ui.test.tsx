import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import { GapResultsStep } from "@/components/gap-analysis/gap-results-step";
import { GapReviewStep } from "@/components/gap-analysis/gap-review-step";
import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("generated output language indicators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps German generated prose when the surrounding UI is English", () => {
    const labels = modulesMessages.en.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapResultsStep
        organizationId="organization-1"
        locale="en"
        labels={labels}
        onError={() => undefined}
        workflow={{
          revision: {
            id: "revision-1",
            outputLocale: "de",
          },
          findings: [
            {
              finding: {
                id: "finding-1",
                status: "not_fulfilled",
                severity: "high",
                requiresReview: false,
                reviewNotice: null,
                gaps: [
                  {
                    id: "gap-1",
                    statement: "Die Kontrolle ist nicht umgesetzt.",
                  },
                ],
              },
              requirement: {
                code: "R1",
                icon: "KeyRound",
                title: {
                  de: "Deutsche Anforderung",
                  en: "English requirement",
                },
              },
              sources: [],
              hasQuestionnaireDisagreement: false,
              hasOrganizationDocument: false,
              manuallyChanged: false,
            },
          ],
          lifecycle: {
            locked: false,
            canFinalize: false,
          },
          canManage: false,
          reviewBlockers: [],
          staleness: null,
          lastWorkflowChange: null,
        } as never}
      />,
    );

    expect(html).toContain("Result language");
    expect(html).toContain("German");
    expect(html).toContain("English requirement");
    expect(html).toContain("lucide-key-round");
    expect(html).toContain("Die Kontrolle ist nicht umgesetzt.");
    expect(html).toContain("Sources");
    expect(html).toContain("No sources linked");
    expect(html).not.toContain("Show evidence and details");
  });

  it("keeps English generated prose when the surrounding UI is German", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapResultsStep
        organizationId="organization-1"
        locale="de"
        labels={labels}
        onError={() => undefined}
        workflow={{
          revision: {
            id: "revision-1",
            outputLocale: "en",
          },
          findings: [
            {
              finding: {
                id: "finding-1",
                status: "not_fulfilled",
                severity: "high",
                requiresReview: false,
                reviewNotice: null,
                gaps: [
                  {
                    id: "gap-1",
                    statement: "The control has not been implemented.",
                  },
                ],
              },
              requirement: {
                code: "R1",
                title: {
                  de: "Deutsche Anforderung",
                  en: "English requirement",
                },
              },
              sources: [],
              hasQuestionnaireDisagreement: false,
              hasOrganizationDocument: false,
              manuallyChanged: false,
            },
          ],
          lifecycle: {
            locked: false,
            canFinalize: false,
          },
          canManage: false,
          reviewBlockers: [],
          staleness: null,
          lastWorkflowChange: null,
        } as never}
      />,
    );

    expect(html).toContain("Ergebnissprache");
    expect(html).toContain("Englisch");
    expect(html).toContain("Deutsche Anforderung");
    expect(html).toContain("The control has not been implemented.");
    expect(html).toContain("Quellen");
    expect(html).toContain("Keine Quellen verknüpft");
    expect(html).not.toContain("Nachweise und Details anzeigen");
  });

  it("shows contradiction details without disabling action-plan creation", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapResultsStep
        organizationId="organization-1"
        locale="de"
        labels={labels}
        onError={() => undefined}
        workflow={{
          revision: {
            id: "revision-1",
            outputLocale: "de",
          },
          findings: [
            {
              finding: {
                id: "finding-1",
                status: "not_fulfilled",
                severity: "high",
                requiresReview: true,
                reviewNotice:
                  "Fragebogen und Organisationsdokument widersprechen sich.",
                gaps: [
                  {
                    id: "gap-1",
                    statement: "Die Kontrolle ist nicht umgesetzt.",
                  },
                ],
              },
              requirement: {
                code: "R1",
                title: {
                  de: "Deutsche Anforderung",
                  en: "English requirement",
                },
              },
              sources: [],
              hasQuestionnaireDisagreement: false,
              hasOrganizationDocument: true,
              manuallyChanged: false,
            },
          ],
          lifecycle: {
            locked: false,
            canFinalize: true,
          },
          canManage: true,
          reviewBlockers: ["finding-1"],
          staleness: null,
          lastWorkflowChange: null,
        } as never}
      />,
    );

    expect(html).toContain("Widersprüchliche Angaben");
    expect(html).toContain(
      "Fragebogen und Organisationsdokument widersprechen sich.",
    );
    expect(html).toMatch(
      /<button[^>]*>[\s\S]*Maßnahmenplan erstellen[\s\S]*<\/button>/u,
    );
    expect(html).not.toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*Maßnahmenplan erstellen/u,
    );
  });

  it.each([
    [
      "de",
      "AI_OUTPUT_LANGUAGE_MISMATCH",
      "Die Analyse wurde nicht in der gewählten Ergebnissprache erstellt.",
    ],
    [
      "en",
      "AI_LANGUAGE_VALIDATION_UNAVAILABLE",
      "The result language could not be validated safely.",
    ],
  ] as const)(
    "renders localized language validation failures in %s",
    (locale, errorCode, expected) => {
      const labels =
        modulesMessages[locale].modules.gapAnalysis.workflow;
      const html = renderToStaticMarkup(
        <GapReviewStep
          locale={locale}
          labels={labels}
          answers={{}}
          selected={[]}
          busy={null}
          generating={false}
          onNavigate={() => undefined}
          onGenerate={() => undefined}
          onRetry={() => undefined}
          onCancel={() => undefined}
          workflow={{
            release: {
              questions: [],
              requirements: [
                {
                  id: "requirement-1",
                  title: "Incident response",
                  icon: "Siren",
                  position: 1,
                  questionStableKeys: [],
                },
              ],
              versionLabel: "guided-v3",
            },
            documentLibrary: { documents: [] },
            analysisCycle: {
              draft: {
                status: "failed",
                outputLocale: locale,
                generationJobId: "job-1",
              },
              summary: {},
            },
            candidateRevision: null,
            run: { errorCode },
          } as never}
        />,
      );
      expect(html).toContain(expected);
      expect(html).toContain("lucide-siren");
    },
  );

  it("shows the action plan's pinned language independently of UI copy", () => {
    const labels = modulesMessages.en.modules.actionPlan.workflow;
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        labels={labels}
        canContribute={false}
        current={{
          plan: {
            id: "plan-1",
            outputLocale: "de",
          },
          categories: [],
          sourceStaleness: { stale: false },
        } as never}
      />,
    );

    expect(html).toContain("Result language");
    expect(html).toContain("German");
  });

  it("offers status as the only user-editable action-plan field", () => {
    const labels = modulesMessages.en.modules.actionPlan.workflow;
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        labels={labels}
        canContribute
        current={{
          plan: {
            id: "plan-1",
            outputLocale: "en",
          },
          categories: [
            {
              requirementVersionId: "requirement-1",
              title: "Governance",
              position: 1,
              actions: [
                {
                  id: "item-1",
                  title: "Define responsibilities",
                  result: "Responsibilities are documented.",
                  suggestedEvidence: [],
                  priority: "high",
                  status: "open",
                  version: 1,
                },
              ],
            },
          ],
          sourceStaleness: { stale: false },
        } as never}
      />,
    );

    expect(html).toContain("Status");
    expect(html).not.toContain("Save changes");
    expect(html).not.toContain("Responsible user ID");
    expect(html).not.toContain("Due date");
    expect(html).not.toContain("Execution notes");
  });
});
