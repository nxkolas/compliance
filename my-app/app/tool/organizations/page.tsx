import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { OrganizationManagementList } from "@/components/organizations/organization-management-list";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { listOrganizationsForUserPage } from "@/src/server/modules/organizations";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireAuth();
  const [dictionary, locale, active, archived] = await Promise.all([
    getDictionary(),
    getLocale(),
    listOrganizationsForUserPage({ userId: user.id, status: "active", limit: 25 }),
    listOrganizationsForUserPage({ userId: user.id, status: "archived", limit: 25 }),
  ]);
  const notice = (await searchParams)?.notice;

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        className="max-w-[1140px] [&>p]:max-w-[893px]"
        title={dictionary.organizations.managementTitle}
        subtitle={dictionary.organizations.managementDescription}
      />
      {(Array.isArray(notice) ? notice[0] : notice) === "archived" && (
        <div role="status" className="mt-8 rounded-lg border border-border-strong bg-card px-4 py-3 text-sm text-card-foreground">
          {dictionary.organizationManagement.archivedRouteNotice}
        </div>
      )}
      <div className="mt-16">
        <OrganizationManagementList
          initialActive={{ items: serialize(active.organizations), cursor: active.nextCursor }}
          initialArchived={{ items: serialize(archived.organizations), cursor: archived.nextCursor }}
          locale={locale}
          labels={dictionary.organizationManagement}
          teamLabels={dictionary.teamManagement}
          inviteLabels={dictionary.invite}
          createHref="/tool/organizations/new"
          createLabel={dictionary.organizations.switcherCreate}
          loadArchivedOnMount
        />
      </div>
    </div>
  );
}

function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value)) as Serialized<T>;
}

type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
