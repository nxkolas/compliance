import { AssessmentModulePage } from "@/components/assessment-module-page";
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

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title="Assessment questionnaire"
    >
      <p>
        Platzhalter fuer die spaetere Pruefung von Sektor,
        Unternehmensgroesse und Kategorie nach NIS2 beziehungsweise BSIG.
      </p>
    </AssessmentModulePage>
  );
}
