import { ProductModuleContent } from "@/components/product-module-content";

export default function ApplicabilityCheckPage() {
  return (
    <ProductModuleContent
      title="Betroffenheitscheck"
      description="Prüfen Sie, ob Ihr Unternehmen unter die NIS2-Richtlinie fällt."
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
