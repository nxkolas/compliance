import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function AssessmentQuestionnairePage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.sidebar.questionnaire}
      description="Der allgemeine Fragebogen bleibt als UI-Komponente erhalten, wird aber erst mit dem neuen Assessment-Schema wieder gespeichert."
      cards={[
        {
          title: "UI bleibt verfuegbar",
          items: [
            "Fragen rendern",
            "Antwortoptionen darstellen",
            "Fortschritt anzeigen",
          ],
        },
        {
          title: "Persistenz folgt spaeter",
          items: [
            "Questionnaire-Versionen",
            "Assessment-Antworten",
            "Revisionen",
          ],
        },
      ]}
    />
  );
}
