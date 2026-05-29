import { ProductModuleContent } from "@/components/product-module-content";
import { ListChecks } from "lucide-react";

export default function ActionPlanPage() {
  return (
    <ProductModuleContent
      eyebrow="Massnahmenplan"
      title="Konkrete naechste Schritte anzeigen"
      description="Der Massnahmenplan beantwortet die Frage, was jetzt konkret zu tun ist. In dieser Version werden Struktur und erwartete Inhalte statisch dargestellt."
      icon={ListChecks}
      metrics={[
        { label: "Aufgabentyp", value: "Priorisiert" },
        { label: "Status", value: "Nachverfolgbar" },
        { label: "Fortschritt", value: "Pro Aufgabe" },
      ]}
      cards={[
        {
          title: "Priorisierte Aufgaben",
          description: "Beispiele fuer konkrete NIS2-Schritte.",
          items: [
            "Zugriffskontrollen dokumentieren",
            "Notfallmanagement definieren",
            "Mitarbeiterschulungen nachweisen",
          ],
        },
        {
          title: "Aufgabenfelder",
          description: "Informationen, die jede spaetere Aufgabe tragen soll.",
          items: [
            "Prioritaet",
            "Status",
            "Fortschritt",
            "Faelligkeit",
            "Verantwortliche Person",
          ],
        },
        {
          title: "Quellen",
          description: "Massnahmen koennen aus mehreren Modulen entstehen.",
          items: [
            "Gap-Analyse",
            "Dokumentenpruefung",
            "Sicherheitsanforderungen",
            "Hochgeladene Nachweise",
          ],
        },
        {
          title: "Ziel",
          description: "Die Seite soll operative Klarheit geben.",
          items: [
            "Was muss ich jetzt konkret tun?",
            "Was ist kritisch?",
            "Was ist bereits erledigt?",
          ],
        },
      ]}
    />
  );
}
