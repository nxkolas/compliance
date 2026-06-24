import { AssessmentModulePage } from "@/components/assessment-module-page";
import { AssessmentResult } from "@/components/organizations/assessment-result";
import { getDictionary } from "@/lib/i18n";

type AssessmentResultPageProps = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export default async function AssessmentResultPage({
  params,
}: AssessmentResultPageProps) {
  const dictionary = await getDictionary();
  const { organizationId, assessmentId } = await params;
  const baseHref = `/tool/organizations/${organizationId}/applicability-check/${assessmentId}`;

  return (
    <AssessmentModulePage
      organizationId={organizationId}
      assessmentId={assessmentId}
      title={dictionary.sidebar.result}
    >
      <AssessmentResult
        apiBasePath={`/api/organizations/${organizationId}/assessments/${assessmentId}`}
        questionnaireHref={`${baseHref}/questionnaire`}
        labels={dictionary.guestCheck.result}
      />
    </AssessmentModulePage>
  );
}
