import { SimpleAppPage } from "@/components/simple-app-page";
import { Suspense } from "react";

export default function SelfCheckPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SimpleAppPage title="Self-check">
        <p>
          Platzhalter fuer die spaetere Pruefung von Sektor, Unternehmensgroesse
          und Kategorie nach NIS2 beziehungsweise BSIG.
        </p>
      </SimpleAppPage>
    </Suspense>
  );
}
