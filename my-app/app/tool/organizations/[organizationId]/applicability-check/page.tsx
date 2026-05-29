import { ProductModuleContent } from "@/components/product-module-content";
import { ClipboardCheck } from "lucide-react";

export default function ApplicabilityCheckPage() {
  return (
    <ProductModuleContent
      eyebrow="Betroffenheitscheck"
      title="Pruefen, ob das Unternehmen unter NIS2 faellt"
      description="Der Check fuehrt durch Branche, Groesse, Umsatz, Bilanzsumme und kritische Dienstleistungen. Die spaetere Auswertung erklaert kurz, warum ein Unternehmen betroffen ist."
      icon={ClipboardCheck}
      metrics={[
        { label: "Ergebnisoptionen", value: "3" },
        { label: "Eingabebereiche", value: "4" },
        { label: "Erklaerung", value: "Kurzbegruendung" },
      ]}
      cards={[
        {
          title: "Eingaben",
          description: "Die fachlichen Felder fuer die NIS2-Betroffenheit.",
          items: [
            "Branchenauswahl",
            "Mitarbeiteranzahl",
            "Umsatz und Bilanzsumme",
            "Kritische Dienstleistungen",
          ],
        },
        {
          title: "Ergebnis",
          description: "Die UI zeigt genau eine dieser Klassifizierungen.",
          items: [
            "Betroffen",
            "Moeglicherweise betroffen",
            "Aktuell nicht betroffen",
          ],
        },
        {
          title: "Erklaerung",
          description: "Kurze, verstaendliche Antwort auf die Kernfrage.",
          items: [
            "Warum ist mein Unternehmen betroffen?",
            "Welche Eingaben waren ausschlaggebend?",
            "Welche Unsicherheiten muessen noch geprueft werden?",
          ],
        },
        {
          title: "Datenmodell",
          description: "Bestehende Tabellen fuer die spaetere Umsetzung.",
          items: [
            "organizations",
            "nis2_sectors und organization_sectors",
            "nis2_critical_services und organization_critical_services",
            "questionnaire_runs und self_check_assessments",
          ],
        },
      ]}
    />
  );
}
