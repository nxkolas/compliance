import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type AssessmentPageProps = {
  params: Promise<{
    assessmentId: string;
  }>;
};

export default function AssessmentPage({ params }: AssessmentPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <AssessmentPageContent params={params} />
    </Suspense>
  );
}

async function AssessmentPageContent({ params }: AssessmentPageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title={dictionary.assessment.pageTitle}
    >
      <p>{dictionary.assessment.pageDescription}</p>
    </AssessmentModulePage>
  );
}
