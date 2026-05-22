import { OrganizationModulePage } from "@/components/organization-module-page";
import { Suspense } from "react";

type SuppliersPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function SuppliersPage({ params }: SuppliersPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SuppliersPageContent params={params} />
    </Suspense>
  );
}

async function SuppliersPageContent({ params }: SuppliersPageProps) {
  const { organizationId } = await params;

  return (
    <OrganizationModulePage organizationId={organizationId} title="Suppliers">
      <p>
        Platzhalter fuer Supply Chain Risk Mapping und die spaetere Erfassung
        unmittelbarer Zulieferer und Dienstleister.
      </p>
    </OrganizationModulePage>
  );
}
