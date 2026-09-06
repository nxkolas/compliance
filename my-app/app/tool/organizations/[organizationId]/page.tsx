import { ComplianceDashboard } from "@/components/dashboard/compliance-dashboard";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationDashboard } from "@/src/server/dashboard/service";
import { connection } from "next/server";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  await connection(); const user = await requireAuth(); const dictionary = await getDictionary(); const { organizationId } = await params;
  const dashboard = await getOrganizationDashboard(user.id, organizationId);
  return <ComplianceDashboard dashboard={dashboard} organizationId={organizationId} labels={dictionary.modules.dashboard} locale={await getLocale()} />;
}
