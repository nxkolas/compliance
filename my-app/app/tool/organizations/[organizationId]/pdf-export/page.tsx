import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function PdfExportPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.pdfExport.title}
      description={dictionary.modules.pdfExport.description}
      metrics={dictionary.modules.pdfExport.metrics}
      cards={[
        {
          title: "Inhalt",
          description: "Abschnitte des spaeteren Berichts.",
          items: [
            "Zusammenfassung des aktuellen Status",
            "Kritische Bereiche",
            "Massnahmenliste",
            "Dokumentenpruefung",
            "Fortschritt der Analyse",
          ],
        },
        {
          title: "Zielgruppe",
          description: "Empfaenger und typische Nutzung.",
          items: [
            "Geschaeftsfuehrung",
            "Externe Beratung",
            "Interne Dokumentation",
          ],
        },
        {
          title: "Exportstatus",
          description: "Die spaetere Historie zeigt den Zustand jedes Berichts.",
          items: [
            "In Warteschlange",
            "Wird generiert",
            "Bereit",
            "Fehlgeschlagen",
          ],
        },
        {
          title: "Datenbasis",
          description: "Berichte entstehen aus dem aktuellen Stand der Organisation.",
          items: [
            "Betroffenheitscheck",
            "Gap-Analyse",
            "Dokumentenpruefung",
            "Massnahmenplan",
          ],
        },
      ]}
    />
  );
}
