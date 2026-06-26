import { AppShell } from "@/components/app-shell";
import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";

export default async function ClaimAssessmentPage() {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <ProductModuleContent
        title={dictionary.assessment.claimTitle}
        description="Die Uebernahme alter Schnellchecks ist im org-only Schema deaktiviert."
        cards={[
          {
            title: "Aktiver Datenbereich",
            items: [
              "Organisationen",
              "Mitgliedschaften",
              "Einladungen",
            ],
          },
          {
            title: "Spaeter wieder aktiv",
            items: [
              "Guest assessments",
              "Versionierte Antworten",
              "Assessment-Ergebnisse",
            ],
          },
        ]}
      />
    </AppShell>
  );
}
