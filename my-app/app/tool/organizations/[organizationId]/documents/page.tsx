import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { gapPageReader } from "@/src/server/gap-analysis/page-reader";
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
  const page = await gapPageReader.readDocuments({
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
        assessmentId={page.assessmentId}
        library={page.documentLibrary}
        reassessment={page.reassessment}
        labels={dictionary.modules.documents.workflow}
      />
    </section>
  );
}
