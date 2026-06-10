import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function HelpGlossaryPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.helpGlossary.title}
      description={dictionary.modules.helpGlossary.description}
      metrics={dictionary.modules.helpGlossary.metrics}
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
