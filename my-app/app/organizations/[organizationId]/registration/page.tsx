import { OrganizationModulePage } from "@/components/organization-module-page";
import { Suspense } from "react";

type RegistrationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function RegistrationPage({ params }: RegistrationPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <RegistrationPageContent params={params} />
    </Suspense>
  );
}

async function RegistrationPageContent({ params }: RegistrationPageProps) {
  const { organizationId } = await params;

  return (
    <OrganizationModulePage organizationId={organizationId} title="Registration">
      <p>
        Platzhalter fuer den zweistufigen Registrierungsprozess mit
        MUK/ELSTER-Organisationskonto und BSI-Portal.
      </p>
    </OrganizationModulePage>
  );
}
