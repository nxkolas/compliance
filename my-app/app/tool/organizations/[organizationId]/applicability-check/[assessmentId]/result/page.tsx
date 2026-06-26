import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function AssessmentResultPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.sidebar.result}
      description="Betroffenheits-Ergebnisse werden nicht mehr aus dem alten Schema gelesen."
      cards={[
        {
          title: "Altes Ergebnis deaktiviert",
          items: [
            "Keine Self-Check-Tabelle",
            "Keine Questionnaire-Runs",
            "Keine alte Ergebnis-Kategorie",
          ],
        },
        {
          title: "Neues Modell geplant",
          items: [
            "Generated artifacts",
            "Artifact revisions",
            "Source dependencies",
          ],
        },
      ]}
    />
  );
}
