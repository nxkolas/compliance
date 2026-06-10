import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function ActionPlanPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.actionPlan.title}
      description={dictionary.modules.actionPlan.description}
      metrics={dictionary.modules.actionPlan.metrics}
      cards={[
        {
          title: "Priorisierte Aufgaben",
          description: "Beispiele fuer konkrete NIS2-Schritte.",
          items: [
            "Zugriffskontrollen dokumentieren",
            "Notfallmanagement definieren",
            "Mitarbeiterschulungen nachweisen",
          ],
        },
        {
          title: "Aufgabenfelder",
          description: "Informationen, die jede spaetere Aufgabe tragen soll.",
          items: [
            "Prioritaet",
            "Status",
            "Fortschritt",
            "Faelligkeit",
            "Verantwortliche Person",
          ],
        },
        {
          title: "Quellen",
          description: "Massnahmen koennen aus mehreren Modulen entstehen.",
          items: [
            "Gap-Analyse",
            "Dokumentenpruefung",
            "Sicherheitsanforderungen",
            "Hochgeladene Nachweise",
          ],
        },
        {
          title: "Ziel",
          description: "Die Seite soll operative Klarheit geben.",
          items: [
            "Was muss ich jetzt konkret tun?",
            "Was ist kritisch?",
            "Was ist bereits erledigt?",
          ],
        },
      ]}
    />
  );
}
