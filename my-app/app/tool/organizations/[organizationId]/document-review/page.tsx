import { ProductModuleContent } from "@/components/product-module-content";

export default function DocumentReviewPage() {
  return (
    <ProductModuleContent
      title="Dokumentenprüfung"
      description="Laden Sie Ihre Sicherheitskonzepte und Richtlinien hoch. Unsere KI prüft diese automatisch auf Vollständigkeit und Konformität mit den NIS2-Anforderungen."
      metrics={[
        { label: "Upload-Arten", value: "4" },
        { label: "Pruefstatus", value: "3" },
        { label: "Beispiele", value: "4" },
      ]}
      cards={[
        {
          title: "Upload von",
          description: "Dokumente, die fuer die KI-Pruefung vorgesehen sind.",
          items: [
            "Richtlinien",
            "Policies",
            "Sicherheitskonzepte",
            "Notfallplaene",
          ],
        },
        {
          title: "KI erkennt",
          description: "Die spaetere Analyse ordnet jedes erwartete Dokument ein.",
          items: [
            "Vorhanden",
            "Unvollstaendig",
            "Nicht gefunden",
          ],
        },
        {
          title: "Beispiele",
          description: "Typische Dokumente im NIS2-Kontext.",
          items: [
            "Passwort-Richtlinie",
            "MFA-Richtlinie",
            "Incident-Response-Dokument",
            "Backup-Konzept",
          ],
        },
        {
          title: "Folgeaufgaben",
          description: "Fehlende oder unvollstaendige Inhalte werden spaeter in den Massnahmenplan uebertragen.",
          items: [
            "Fehlendes Dokument erstellen",
            "Unvollstaendige Policy ueberarbeiten",
            "Nachweis einem Sicherheitsbereich zuordnen",
          ],
        },
      ]}
    />
  );
}
