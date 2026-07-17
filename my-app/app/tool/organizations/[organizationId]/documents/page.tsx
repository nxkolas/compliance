import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import { connection } from "next/server";

export default async function DocumentsPage({
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
        title={dictionary.modules.documents.title}
        subtitle={dictionary.modules.documents.description}
      />
      <OrganizationDocumentManager
        organizationId={organizationId}
        assessmentId={workflow.assessment?.id ?? null}
        library={workflow.documentLibrary}
        reassessment={workflow.reassessment}
        labels={dictionary.modules.documents.workflow}
      />
    </section>
  );
}
