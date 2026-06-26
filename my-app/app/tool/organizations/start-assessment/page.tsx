import { AppShell } from "@/components/app-shell";
import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";

export default async function StartAssessmentPage() {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <ProductModuleContent
        title={dictionary.assessment.newTitle}
        description="Der Betroffenheitscheck wird nach dem Schema-Neustart als versionierter Fragebogen neu angebunden."
        cards={[
          {
            title: "V1-Status",
            description:
              "Organisationen, Mitgliedschaften und Einladungen sind aktiv.",
            items: [
              "Neue Organisation erstellen",
              "Teammitglieder einladen",
              "Arbeitsbereich ueber die Navigation oeffnen",
            ],
          },
          {
            title: "Naechste Schema-Phase",
            description:
              "Der Fragebogen bleibt als UI-Komponente erhalten und wird spaeter an das neue Assessment-Modell angeschlossen.",
            items: [
              "Framework-Versionen",
              "Questionnaire-Versionen",
              "Assessment-Revisions",
            ],
          },
        ]}
      />
    </AppShell>
  );
}
