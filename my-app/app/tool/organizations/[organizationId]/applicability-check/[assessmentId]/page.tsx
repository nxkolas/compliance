import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function AssessmentPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.sidebar.applicabilityCheck}
      description="Diese alte Assessment-URL bleibt erreichbar, ist im org-only Schema aber nicht mehr an persistierte Daten gebunden."
      cards={[
        {
          title: "Aktuell deaktiviert",
          items: [
            "Assessment-Instanzen",
            "Questionnaire-Runs",
            "Ergebnisberechnung",
          ],
        },
        {
          title: "Geplante Reaktivierung",
          items: [
            "Versionierte Assessment-Revisions",
            "Versionierte Fragen",
            "Generierte Artefakte",
          ],
        },
      ]}
    />
  );
}
