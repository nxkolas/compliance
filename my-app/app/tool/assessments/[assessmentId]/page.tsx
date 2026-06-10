import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDefaultDictionary, getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type AssessmentPageProps = {
  params: Promise<{
    assessmentId: string;
  }>;
};

export default function AssessmentPage({ params }: AssessmentPageProps) {
  const dictionary = getDefaultDictionary();

  return (
    <Suspense fallback={<main className="p-8">{dictionary.common.loading}</main>}>
      <AssessmentPageContent params={params} />
    </Suspense>
  );
}

async function AssessmentPageContent({ params }: AssessmentPageProps) {
  const dictionary = await getDictionary();
  const { assessmentId } = await params;

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title={dictionary.sidebar.applicabilityCheck}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Zweck</h2>
          <p>Pruefen, ob das Unternehmen unter NIS2 faellt.</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Ergebnis</h2>
          <ul className="flex flex-col gap-1">
            <li>Betroffen</li>
            <li>Moeglicherweise betroffen</li>
            <li>Aktuell nicht betroffen</li>
          </ul>
        </section>
      </div>
    </AssessmentModulePage>
  );
}
