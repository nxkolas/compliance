import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type AssessmentResultPageProps = {
  params: Promise<{
    assessmentId: string;
  }>;
};

export default function AssessmentResultPage({
  params,
}: AssessmentResultPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <AssessmentResultPageContent params={params} />
    </Suspense>
  );
}

async function AssessmentResultPageContent({
  params,
}: AssessmentResultPageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title={dictionary.assessment.resultTitle}
    >
      <p>{dictionary.assessment.resultDescription}</p>
    </AssessmentModulePage>
  );
}
