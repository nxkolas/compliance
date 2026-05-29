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
    <AssessmentModulePage
      assessmentId={assessmentId}
      title="Ergebnis"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Status</h2>
          <ul className="flex flex-col gap-1">
            <li>Betroffen</li>
            <li>Moeglicherweise betroffen</li>
            <li>Aktuell nicht betroffen</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Begruendung</h2>
          <p>
            Hier erscheint spaeter die kurze Erklaerung, welche Branchen-,
            Groessen- oder Dienstleistungsangaben das Ergebnis ausloesen.
          </p>
        </section>
      </div>
    </AssessmentModulePage>
  );
}
