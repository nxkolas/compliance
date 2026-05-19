import { SimpleAppPage } from "@/components/simple-app-page";
import { Suspense } from "react";

export default function RegistrationPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SimpleAppPage title="Registration">
        <p>
          Platzhalter fuer den zweistufigen Registrierungsprozess mit
          MUK/ELSTER-Organisationskonto und BSI-Portal.
        </p>
      </SimpleAppPage>
    </Suspense>
  );
}
