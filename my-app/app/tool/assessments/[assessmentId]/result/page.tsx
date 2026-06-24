import { AssessmentModulePage } from "@/components/assessment-module-page";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getSelfCheckAssessmentForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";

type AssessmentResultPageProps = {
  params: Promise<{
    assessmentId: string;
  }>;
};

export default async function AssessmentResultPage({
  params,
}: AssessmentResultPageProps) {
  const dictionary = await getDictionary();
  const { assessmentId } = await params;
  const user = await requireAuth();
  const assessment = await getSelfCheckAssessmentForUser(user.id, assessmentId);

  if (!assessment) {
    notFound();
  }

  const resultLabel =
    assessment.category === "not_affected"
      ? "Aktuell nicht erkennbar betroffen"
      : assessment.category === "unknown"
        ? "Individuelle Prüfung erforderlich"
        : "Voraussichtlich betroffen";

  return (
    <AssessmentModulePage
      assessmentId={assessmentId}
      title={dictionary.sidebar.result}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Status</h2>
          <p className="text-foreground">{resultLabel}</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Begruendung</h2>
          <p>{assessment.reasoning ?? "Noch keine Begründung vorhanden."}</p>
        </section>
      </div>
    </AssessmentModulePage>
  );
}
