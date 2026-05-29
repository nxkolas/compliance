import { ProductModuleContent } from "@/components/product-module-content";
import { ShieldCheck } from "lucide-react";

export default function GapAnalysisPage() {
  return (
    <ProductModuleContent
      eyebrow="Gap-Analyse"
      title="Aktuelle Sicherheitsmassnahmen pruefen"
      description="Die Gap-Analyse bildet die vorhandenen Massnahmen gegen die erwarteten NIS2- und BSIG-Bereiche ab. Sie bleibt hier bewusst statisch; Auswertung und Speicherung kommen spaeter."
      icon={ShieldCheck}
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
