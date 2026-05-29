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
      title="Fragebogen"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Eingaben</h2>
          <ul className="flex flex-col gap-1">
            <li>Branchenauswahl</li>
            <li>Mitarbeiteranzahl</li>
            <li>Umsatz/Bilanzsumme</li>
            <li>Kritische Dienstleistungen</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Erklaerung</h2>
          <p>
            Die spaetere Auswertung beantwortet: Warum ist mein Unternehmen
            betroffen?
          </p>
        </section>
      </div>
    </AssessmentModulePage>
  );
}
