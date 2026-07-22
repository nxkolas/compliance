import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationDashboard } from "@/src/server/dashboard/service";
import { connection } from "next/server";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  await connection(); const user = await requireAuth(); const dictionary = await getDictionary(); const { organizationId } = await params;
  const dashboard = await getOrganizationDashboard(user.id, organizationId);
  return <ProductModuleContent
    title={dictionary.modules.dashboard.title}
    description={dictionary.modules.dashboard.description}
    metrics={[
      { label: "Betroffenheitsstatus", value: dashboard.applicability.outcome ?? "Offen" },
      { label: "Offene Maßnahmen", value: String(dashboard.plan.openItems) },
      { label: "Kritische Findings", value: String(dashboard.gap.criticalCount) },
    ]}
    cards={[
      { title: "Aktueller Datenstand", items: [`Gap-Findings: ${dashboard.gap.findingCount}`, `Dokumentversionen: ${dashboard.evidence.currentVersionCount}`, `Maßnahmen: ${dashboard.plan.totalItems}`, `Bericht: ${dashboard.report.state ?? "nicht erstellt"}`] },
      { title: "Nächste Schritte", items: dashboard.nextSteps.length ? dashboard.nextSteps.map((step) => step.replaceAll("_", " ")) : ["Keine offenen Grundschritte"] },
    ]}
  />;
}
