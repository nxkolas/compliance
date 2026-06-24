import { AppShell } from "@/components/app-shell";
import { OrganizationAssessmentDestination } from "@/components/organizations/organization-assessment-destination";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { connection } from "next/server";

export default async function StartAssessmentPage() {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const organizations = await listOrganizationsForUser(user.id);

  return (
    <AppShell dictionary={dictionary}>
      <OrganizationAssessmentDestination
        title={dictionary.assessment.newTitle}
        description={dictionary.organizations.selectDescription}
        newOrganizationHref="/tool/organizations/new?next=assessment"
        organizations={organizations}
        labels={{
          assessment: dictionary.assessment,
          common: dictionary.common,
          organizations: dictionary.organizations,
        }}
        action={{ kind: "create-assessment" }}
      />
    </AppShell>
  );
}
