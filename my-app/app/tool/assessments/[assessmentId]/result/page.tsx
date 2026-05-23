import { AssessmentModulePage } from "@/components/assessment-module-page";
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

  return (
    <AssessmentModulePage assessmentId={assessmentId} title="Assessment result">
      <p>
        Assessment-specific NIS2 classification, reasoning, and review output
        will live here.
      </p>
    </AssessmentModulePage>
  );
}
