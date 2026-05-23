import { OrganizationModulePage } from "@/components/organization-module-page";
import { Suspense } from "react";

type RiskManagementPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function RiskManagementPage({ params }: RiskManagementPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <RiskManagementPageContent params={params} />
    </Suspense>
  );
}

async function RiskManagementPageContent({
  params,
}: RiskManagementPageProps) {
  const { organizationId } = await params;

  return (
    <OrganizationModulePage
      organizationId={organizationId}
      title="Risk management"
    >
      <p>
        Platzhalter fuer die Dokumentation der technischen und
        organisatorischen Massnahmen aus den Risikomanagementbereichen des BSIG.
      </p>
    </OrganizationModulePage>
  );
}
