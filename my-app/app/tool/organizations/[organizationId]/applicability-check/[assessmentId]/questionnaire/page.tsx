import { AssessmentModulePage } from "@/components/assessment-module-page";
import { GuestQuestionnaire } from "@/components/guest/guest-questionnaire";
import { getDictionary } from "@/lib/i18n";

type AssessmentQuestionnairePageProps = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export default async function AssessmentQuestionnairePage({
  params,
}: AssessmentQuestionnairePageProps) {
  const dictionary = await getDictionary();
  const { organizationId, assessmentId } = await params;
  const baseHref = `/tool/organizations/${organizationId}/applicability-check/${assessmentId}`;

  return (
    <AssessmentModulePage
      organizationId={organizationId}
      assessmentId={assessmentId}
      title={dictionary.sidebar.questionnaire}
      headerClassName="mx-auto w-full max-w-3xl gap-3"
      titleClassName="font-semibold text-white sm:text-4xl"
      descriptionClassName="max-w-2xl text-base leading-7 text-white/70"
      cardClassName="mx-auto w-full max-w-3xl border-0 bg-transparent shadow-none"
      contentClassName="p-0 text-white"
    >
      <GuestQuestionnaire
        apiBasePath={`/api/organizations/${organizationId}/assessments/${assessmentId}`}
        resultHref={`${baseHref}/result`}
        refreshOnComplete
        labels={dictionary.guestCheck.questionnaire}
      />
    </AssessmentModulePage>
  );
}
