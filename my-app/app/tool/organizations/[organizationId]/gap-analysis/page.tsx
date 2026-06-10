import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function GapAnalysisPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.gapAnalysis.title}
      description={dictionary.modules.gapAnalysis.description}
      metrics={dictionary.modules.gapAnalysis.metrics}
      cards={[
        {
          title: "Fragebogen",
          description: "Die fachlichen Sicherheitsbereiche der Analyse.",
          items: [
            "Zugriffskontrolle",
            "Backup & Recovery",
            "Incident Response",
            "Lieferkettensicherheit",
            "Netzwerk-/Systemschutz",
            "Awareness-Schulungen",
            "Risikoanalyse",
          ],
        },
        {
          title: "Ergebnis",
          description: "Die spaetere Analyse ordnet den Status in eine Stufe ein.",
          items: [
            "Handlungsbedarf",
            "Teilweise umgesetzt",
            "Grundanforderungen erfuellt",
          ],
        },
        {
          title: "Fortschritt",
          description: "Der Fortschritt entsteht aus beantworteten Fragen und bewerteten Bereichen.",
          items: [
            "Fortschrittsanzeige",
            "Offene Bereiche",
            "Abgeschlossene Pruefabschnitte",
          ],
        },
        {
          title: "Priorisierte Massnahmen",
          description: "Aus Luecken entstehen spaeter konkrete Aufgaben.",
          items: [
            "Hohe Prioritaet fuer kritische Risiken",
            "Mittlere Prioritaet fuer teilweise umgesetzte Anforderungen",
            "Niedrige Prioritaet fuer Nachweise und Optimierungen",
          ],
        },
      ]}
    />
  );
}
