import { AppShell } from "@/components/app-shell";
import { OrganizationAssessmentDestination } from "@/components/organizations/organization-assessment-destination";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { connection } from "next/server";

type ClaimAssessmentPageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function ClaimAssessmentPage({
  params,
}: ClaimAssessmentPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const { assessmentId } = await params;
  const organizations = await listOrganizationsForUser(user.id);
  const newOrganizationHref = `/tool/organizations/new?claimAssessmentId=${encodeURIComponent(
    assessmentId,
  )}`;

  return (
    <AppShell dictionary={dictionary}>
      <OrganizationAssessmentDestination
        title={dictionary.assessment.claimTitle}
        description={dictionary.assessment.claimDescription}
        newOrganizationHref={newOrganizationHref}
        organizations={organizations}
        labels={{
          assessment: dictionary.assessment,
          common: dictionary.common,
          organizations: dictionary.organizations,
        }}
        action={{ kind: "claim-assessment", assessmentId }}
      />
    </AppShell>
  );
}
