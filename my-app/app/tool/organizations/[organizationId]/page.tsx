import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationDashboard } from "@/src/server/modules/organizations";
import { connection } from "next/server";
import { buildDashboardPresentation } from "@/lib/i18n/dashboard";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  await connection(); const user = await requireAuth(); const dictionary = await getDictionary(); const { organizationId } = await params;
  const dashboard = await getOrganizationDashboard(user.id, organizationId);
  const presentation = buildDashboardPresentation(
    dashboard,
    dictionary.modules.dashboard,
  );
  return <ProductModuleContent
    title={dictionary.modules.dashboard.title}
    description={dictionary.modules.dashboard.description}
    metrics={presentation.metrics}
    cards={presentation.cards}
  />;
}
