import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type AssessmentQuestionnairePageProps = {
  params: Promise<{
    assessmentId: string;
  }>;
};

export default function AssessmentQuestionnairePage({
  params,
}: AssessmentQuestionnairePageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <AssessmentQuestionnairePageContent params={params} />
    </Suspense>
  );
}

async function AssessmentQuestionnairePageContent({
  params,
}: AssessmentQuestionnairePageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title={dictionary.assessment.questionnaireTitle}
    >
      <p>{dictionary.assessment.questionnaireDescription}</p>
    </AssessmentModulePage>
  );
}
