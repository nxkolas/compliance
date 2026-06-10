import { ProductModuleContent } from "@/components/product-module-content";

export default function GapAnalysisPage() {
  return (
    <ProductModuleContent
      title="Gap-Analyse"
      description="Identifizieren Sie Sicherheitslücken durch unseren gezielten Fragebogen zu Kernbereichen wie Backup, Incident Response und Zugriffskontrolle, um Ihren Handlungsbedarf zu ermitteln."
      metrics={[
        { label: "Fragebogenbereiche", value: "7" },
        { label: "Ergebnisstufen", value: "3" },
        { label: "Massnahmen", value: "Priorisiert" },
      ]}
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
