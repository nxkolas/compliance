import { AssessmentModulePage } from "@/components/assessment-module-page";
import { AssessmentQuestionnaire } from "@/components/organizations/assessment-questionnaire";
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
    >
      <AssessmentQuestionnaire
        apiBasePath={`/api/organizations/${organizationId}/assessments/${assessmentId}`}
        questionnaireHref={`${baseHref}/questionnaire`}
        resultHref={`${baseHref}/result`}
        labels={dictionary.guestCheck.questionnaire}
      />
    </AssessmentModulePage>
  );
}
