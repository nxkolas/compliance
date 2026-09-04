import { GapAnalysisWorkflow } from "@/components/gap-analysis/gap-analysis-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getGapAnalysisWorkflow } from "@/src/server/modules/gap-analysis";
import { connection } from "next/server";
import {
  deriveGapWorkflowNavigation,
  resolveGapPostGenerationView,
} from "@/src/server/modules/gap-analysis";

export default async function GapAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ step?: string; view?: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const requested = await searchParams;
  const requestedView = resolveGapPostGenerationView(requested.view);
  const workflow = await getGapAnalysisWorkflow({
    userId: user.id,
    organizationId,
    locale,
    view: requestedView,
  });
  const requestedStep = requested.step;
  const navigation = deriveGapWorkflowNavigation({
    prerequisiteSatisfied: workflow.prerequisite.satisfied,
    hasAssessment: Boolean(workflow.assessment),
    answeredQuestionCount: workflow.release.questions.filter(
      (question) => Boolean(workflow.answers[question.id]),
    ).length,
    requiredQuestionCount: workflow.release.questions.filter(
      (question) => question.required,
    ).length,
    hasPreparedInputs: Boolean(workflow.analysisCycle),
    hasResult: Boolean(workflow.revision),
    requestedStep,
  });

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        className="w-full max-w-[1130px] [&>p]:min-h-10 [&>p]:w-full [&>p]:font-sans [&>p]:text-lg [&>p]:leading-7 [&>p]:font-normal [&>p]:tracking-normal [&>p]:text-[#002BFF] dark:[&>p]:text-blue-200"
        title={dictionary.modules.gapAnalysis.title}
        subtitle={dictionary.modules.gapAnalysis.description}
      />
      <GapAnalysisWorkflow
        key={[
          workflow.assessment?.currentRevisionId ?? "no-assessment",
          workflow.analysisCycle?.draft.id ?? "no-draft",
          workflow.analysisCycle?.draft.lockVersion ?? 0,
          workflow.analysisCycle?.draft.status ?? "no-status",
          workflow.revision?.id ?? "no-result",
        ].join(":")}
        organizationId={organizationId}
        workflow={workflow}
        labels={dictionary.modules.gapAnalysis.workflow}
        locale={locale}
        initialStep={navigation.activeStep}
        initialView={requestedView}
      />
    </section>
  );
}
