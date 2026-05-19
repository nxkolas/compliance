import { SimpleAppPage } from "@/components/simple-app-page";
import { Suspense } from "react";

export default function RequirementsPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SimpleAppPage title="Requirements">
        <p>
          Platzhalter fuer Requirements Engineering aus Recherche, Interview-
          Leitfaden und Unternehmensinterviews.
        </p>
      </SimpleAppPage>
    </Suspense>
  );
}
