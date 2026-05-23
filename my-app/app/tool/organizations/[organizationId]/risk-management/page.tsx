import { OrganizationModulePage } from "@/components/organization-module-page";
import { getDictionary } from "@/lib/i18n";
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
  const dictionary = await getDictionary();

  return (
    <OrganizationModulePage
      organizationId={organizationId}
      title={dictionary.sidebar.riskManagement}
    >
      <p>{dictionary.modules.riskManagementDescription}</p>
    </OrganizationModulePage>
  );
}
