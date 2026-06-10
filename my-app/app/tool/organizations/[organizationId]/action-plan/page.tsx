import { ProductModuleContent } from "@/components/product-module-content";

export default function ActionPlanPage() {
  return (
    <ProductModuleContent
      title="Maßnahmenplan"
      description="Setzen Sie offene Anforderungen gezielt um: Hier finden Sie Ihre priorisierte Aufgabenliste mit konkreten To-Dos, Status-Tracking und Zuständigkeiten."
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
