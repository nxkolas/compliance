import { PageHeader } from "@/components/page-header";
import { ReportWorkflow } from "@/components/reports/report-workflow";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { hasOrganizationCapability } from "@/src/server/auth/capabilities";
import { assertCanAccessOrganization } from "@/src/server/organizations/service";
import { listReports } from "@/src/server/reports/service";
import { connection } from "next/server";

export default async function PdfExportPage({ params }: { params: Promise<{ organizationId: string }> }) {
  await connection(); const user = await requireAuth(); const dictionary = await getDictionary(); const locale = await getLocale(); const { organizationId } = await params;
  const [membership, reports] = await Promise.all([assertCanAccessOrganization(user.id, organizationId), listReports(user.id, organizationId)]);
  return <section className="flex w-full flex-col gap-8"><PageHeader title={dictionary.modules.pdfExport.title} subtitle={dictionary.modules.pdfExport.description} /><ReportWorkflow organizationId={organizationId} locale={locale} reports={reports} canCreate={hasOrganizationCapability(membership.role, "reports:create")} /></section>;
}
