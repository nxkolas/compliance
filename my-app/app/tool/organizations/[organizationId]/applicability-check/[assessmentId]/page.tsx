import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDictionary } from "@/lib/i18n";

type AssessmentPageProps = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export default async function AssessmentPage({ params }: AssessmentPageProps) {
  const dictionary = await getDictionary();
  const { organizationId, assessmentId } = await params;

  return (
    <AssessmentModulePage
      organizationId={organizationId}
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
