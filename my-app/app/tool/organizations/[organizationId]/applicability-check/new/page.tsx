import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function NewAssessmentPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.assessment.newTitle}
      description="Das Erstellen von NIS2-Betroffenheitscheck-Instanzen wird mit dem neuen versionierten Assessment-Schema wieder aktiviert."
      cards={[
        {
          title: "Noch nicht persistiert",
          items: [
            "NIS2 questionnaire definitions",
            "Assessment revisions",
            "Answer revisions",
          ],
        },
        {
          title: "Bereits aktiv",
          items: [
            "Organisation anlegen",
            "Organisation oeffnen",
            "Team einladen",
          ],
        },
      ]}
    />
  );
}
