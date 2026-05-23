import { OrganizationModulePage } from "@/components/organization-module-page";
import { getDictionary } from "@/lib/i18n";
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
  const dictionary = await getDictionary();

  return (
    <OrganizationModulePage
      organizationId={organizationId}
      title={dictionary.sidebar.registration}
    >
      <p>{dictionary.modules.registrationDescription}</p>
    </OrganizationModulePage>
  );
}
