import { GapAnalysisWorkflow } from "@/components/gap-analysis/gap-analysis-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import { connection } from "next/server";
import { deriveGapWorkflowNavigation } from "@/src/server/gap-analysis/workflow-state";

export default async function GapAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const workflow = await getGapAnalysisWorkflow({
    userId: user.id,
    organizationId,
    locale,
  });
  const requestedStep = (await searchParams).step;
  const navigation = deriveGapWorkflowNavigation({
    prerequisiteSatisfied: workflow.prerequisite.satisfied,
    hasAssessment: Boolean(workflow.assessment),
    answeredQuestionCount: workflow.answerSummary.filter(
      (answer) => answer.answer,
    ).length,
    requiredQuestionCount: workflow.answerSummary.filter(
      (answer) => answer.required,
    ).length,
    hasPreparedInputs: Boolean(workflow.reassessment),
    hasResult: Boolean(workflow.revision),
    requestedStep,
  });

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.gapAnalysis.title}
        subtitle={dictionary.modules.gapAnalysis.description}
      />
      <GapAnalysisWorkflow
        key={[
          workflow.assessment?.currentRevisionId ?? "no-assessment",
          workflow.reassessment?.draft.id ?? "no-draft",
          workflow.reassessment?.draft.lockVersion ?? 0,
          workflow.reassessment?.draft.status ?? "no-status",
          workflow.revision?.id ?? "no-result",
        ].join(":")}
        organizationId={organizationId}
        workflow={workflow}
        labels={dictionary.modules.gapAnalysis.workflow}
        locale={locale}
        initialStep={navigation.activeStep}
      />
    </section>
  );
}
