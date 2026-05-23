import { OrganizationModulePage } from "@/components/organization-module-page";
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

  return (
    <OrganizationModulePage organizationId={organizationId} title="Requirements">
      <p>
        Platzhalter fuer Requirements Engineering aus Recherche, Interview-
        Leitfaden und Unternehmensinterviews.
      </p>
    </OrganizationModulePage>
  );
}
