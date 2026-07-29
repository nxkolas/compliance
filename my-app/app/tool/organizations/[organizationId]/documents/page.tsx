import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { documentListQuerySchema } from "@/src/contracts/documents";
import { listOrganizationDocumentDtos } from "@/src/server/documents";
import { connection } from "next/server";

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireAuth();
  const [dictionary, locale, { organizationId }, rawSearchParams] =
    await Promise.all([
      getDictionary(),
      getLocale(),
      params,
      searchParams,
    ]);
  const parsed = documentListQuerySchema.safeParse({
    status:
      typeof rawSearchParams.status === "string"
        ? rawSearchParams.status
        : "all",
    search:
      typeof rawSearchParams.search === "string"
        ? rawSearchParams.search
        : undefined,
    limit: 25,
  });
  const query = parsed.success
    ? parsed.data
    : documentListQuerySchema.parse({});
  const library = await listOrganizationDocumentDtos({
    userId: user.id,
    organizationId,
    query,
  });

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.documents.title}
        subtitle={dictionary.modules.documents.description}
      />
      <OrganizationDocumentManager
        organizationId={organizationId}
        initialDocuments={library.documents}
        initialPermissions={library.permissions}
        initialCounts={library.counts}
        initialNextCursor={library.nextCursor}
        status={query.status}
        search={query.search ?? ""}
        locale={locale}
        labels={dictionary.modules.documents.workflow}
      />
    </section>
  );
}
