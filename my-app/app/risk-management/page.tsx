import { SimpleAppPage } from "@/components/simple-app-page";
import { Suspense } from "react";

export default function RiskManagementPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SimpleAppPage title="Risk management">
        <p>
          Platzhalter fuer die Dokumentation der technischen und
          organisatorischen Massnahmen aus den Risikomanagementbereichen des
          BSIG.
        </p>
      </SimpleAppPage>
    </Suspense>
  );
}
