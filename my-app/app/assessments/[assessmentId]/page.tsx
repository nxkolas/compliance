import { AssessmentModulePage } from "@/components/assessment-module-page";
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

  return (
    <AssessmentModulePage assessmentId={assessmentId} title="Assessment">
      <p>
        Overview for this NIS2 assessment draft, including status, result, and
        questionnaire progress.
      </p>
    </AssessmentModulePage>
  );
}
