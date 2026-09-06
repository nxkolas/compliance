import { ComplianceDashboard } from "@/components/dashboard/compliance-dashboard";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { getOrganizationDashboard } from "@/src/server/modules/organizations";
import { connection } from "next/server";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  await connection(); const user = await requireAuth(); const dictionary = await getDictionary(); const { organizationId } = await params;
  const dashboard = await getOrganizationDashboard(user.id, organizationId);
  return <ComplianceDashboard dashboard={dashboard} organizationId={organizationId} labels={dictionary.modules.dashboard} locale={await getLocale()} />;
}
