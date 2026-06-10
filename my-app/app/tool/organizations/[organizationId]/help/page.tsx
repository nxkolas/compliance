import { ProductModuleContent } from "@/components/product-module-content";

export default function HelpGlossaryPage() {
  return (
    <ProductModuleContent
      title="Hilfe & Glossar"
      description="Hilfe, Glossar, FAQ und Tooltips bleiben statische Inhalte ohne Datenbankinteraktion."
      metrics={[
        { label: "Datenbank", value: "Keine" },
        { label: "Inhalt", value: "Statisch" },
        { label: "Nutzung", value: "Erklaerungen" },
      ]}
      cards={[
        {
          title: "Glossarbegriffe",
          description: "Begriffe, die Nutzer direkt im Tool verstehen sollen.",
          items: [
            "Incident Response",
            "MFA",
            "Risikoanalyse",
            "Lieferkettensicherheit",
            "Business Continuity",
          ],
        },
        {
          title: "Hilfetexte",
          description: "Kurze Orientierung im gesamten System.",
          items: [
            "FAQ",
            "Kurze Hilfetexte",
            "Tooltips im gesamten System",
          ],
        },
        {
          title: "Umsetzung",
          description: "Bewusst ohne Datenmodell.",
          items: [
            "HTML",
            "Markdown",
            "React-Komponenten",
          ],
        },
        {
          title: "Nicht vorgesehen",
          description: "Diese Seite erzeugt keine Persistenz.",
          items: [
            "Keine Glossar-Tabellen",
            "Keine FAQ-Tabellen",
            "Keine Tooltip-Tabellen",
          ],
        },
      ]}
    />
  );
}
