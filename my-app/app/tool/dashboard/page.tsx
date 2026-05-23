import { SimpleAppPage } from "@/components/simple-app-page";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SimpleAppPage title="Dashboard">
        <p>
          Ueberblick fuer den NIS2 Compliance Checker. Von hier aus fuehren die
          ersten Schritte zur Betroffenheitspruefung, Requirements-Erfassung,
          Risikomanagement, Lieferkettenbewertung und Registrierung.
        </p>
      </SimpleAppPage>
    </Suspense>
  );
}
