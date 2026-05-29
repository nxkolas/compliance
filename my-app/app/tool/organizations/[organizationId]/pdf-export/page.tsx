import { ProductModuleContent } from "@/components/product-module-content";
import { ReceiptText } from "lucide-react";

export default function PdfExportPage() {
  return (
    <ProductModuleContent
      eyebrow="PDF-Export"
      title="Bericht exportieren"
      description="Der PDF-Export fasst den aktuellen Compliance-Stand fuer Management, Beratung oder interne Dokumentation zusammen. Die eigentliche Generierung ist noch nicht aktiv."
      icon={ReceiptText}
      metrics={[
        { label: "Zielgruppen", value: "3" },
        { label: "Berichtsbereiche", value: "5" },
        { label: "Historie", value: "Vorgesehen" },
      ]}
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
