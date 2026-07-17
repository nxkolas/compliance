import { GapAnalysisWorkflow } from "@/components/gap-analysis/gap-analysis-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import { connection } from "next/server";

export default async function GapAnalysisPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const workflow = await getGapAnalysisWorkflow({
    userId: user.id,
    organizationId,
    locale,
  });

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.gapAnalysis.title}
        subtitle={dictionary.modules.gapAnalysis.description}
      />
      <GapAnalysisWorkflow
        organizationId={organizationId}
        workflow={workflow}
        labels={dictionary.modules.gapAnalysis.workflow}
        documentLabels={dictionary.modules.documents.workflow}
        locale={locale}
      />
    </section>
  );
}
