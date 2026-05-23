import { OrganizationModulePage } from "@/components/organization-module-page";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type RequirementsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function RequirementsPage({ params }: RequirementsPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <RequirementsPageContent params={params} />
    </Suspense>
  );
}

async function RequirementsPageContent({ params }: RequirementsPageProps) {
  const { organizationId } = await params;
  const dictionary = await getDictionary();

  return (
    <OrganizationModulePage
      organizationId={organizationId}
      title={dictionary.sidebar.requirements}
    >
      <p>{dictionary.modules.requirementsDescription}</p>
    </OrganizationModulePage>
  );
}
