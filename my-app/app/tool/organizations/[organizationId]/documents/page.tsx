import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { PageHeader } from "@/components/page-header";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationDocumentLibrary } from "@/src/server/documents";
import { connection } from "next/server";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const { organizationId } = await params;
  const library = await getOrganizationDocumentLibrary(
    user.id,
    organizationId,
    { includeUsage: false },
  );

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.documents.title}
        subtitle={dictionary.modules.documents.description}
      />
      <OrganizationDocumentManager
        organizationId={organizationId}
        library={library}
        labels={dictionary.modules.documents.workflow}
      />
    </section>
  );
}
