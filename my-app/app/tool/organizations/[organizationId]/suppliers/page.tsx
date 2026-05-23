import { OrganizationModulePage } from "@/components/organization-module-page";
import { getDictionary } from "@/lib/i18n";
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
  const dictionary = await getDictionary();

  return (
    <OrganizationModulePage
      organizationId={organizationId}
      title={dictionary.sidebar.suppliers}
    >
      <p>{dictionary.modules.suppliersDescription}</p>
    </OrganizationModulePage>
  );
}
