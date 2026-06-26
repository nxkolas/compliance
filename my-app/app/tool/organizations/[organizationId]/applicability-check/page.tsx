import { PageHeader } from "@/components/page-header";
import { QuestionnairePreview } from "@/components/questionnaires/questionnaire-preview";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getActiveApplicabilityQuestionnaire } from "@/src/server/questionnaires/service";
import { connection } from "next/server";

export default async function ApplicabilityCheckPage() {
  await connection();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const questionnaire = await getActiveApplicabilityQuestionnaire();

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.applicabilityCheck.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      {questionnaire ? (
        <QuestionnairePreview
          questionnaire={questionnaire}
          locale={locale}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground shadow-sm">
          Der NIS2-Betroffenheitscheck wurde noch nicht in die Datenbank
          geseedet.
        </div>
      )}
    </section>
  );
}
