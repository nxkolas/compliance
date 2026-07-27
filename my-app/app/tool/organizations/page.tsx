import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { OrganizationManagementList } from "@/components/organizations/organization-management-list";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUserPage } from "@/src/server/organizations/service";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireAuth();
  const [dictionary, locale, active] = await Promise.all([
    getDictionary(),
    getLocale(),
    listOrganizationsForUserPage({ userId: user.id, status: "active", limit: 25 }),
  ]);
  const notice = (await searchParams)?.notice;
  const sidebarOrganizationId = active.organizations[0]?.id;

  return (
    <AppShell
  dictionary={dictionary}
  organizationId={sidebarOrganizationId}
>
      <div className="flex min-h-[calc(100svh-86px)] w-full flex-col">
        <header className="max-w-[1140px]">
          <div className="grid gap-4">
            <h1 className="text-4xl font-bold leading-9 tracking-normal text-white">
              Organisationen verwalten
            </h1>
            <p className="max-w-[893px] text-lg font-bold leading-7 text-blue-200">
              Wechseln Sie den aktiven Arbeitsbereich oder passen Sie Stammdaten und Mitgliedschaften an.
            </p>
          </div>
        </header>
        {(Array.isArray(notice) ? notice[0] : notice) === "archived" && (
          <div role="status" className="mt-8 rounded-lg border border-zinc-700 bg-gray-900 px-4 py-3 text-sm text-zinc-100">
            {dictionary.organizationManagement.archivedRouteNotice}
          </div>
        )}
        <div className="mt-16">
          <OrganizationManagementList
            initialActive={{ items: serialize(active.organizations), cursor: active.nextCursor }}
            initialArchived={{ items: [], cursor: undefined }}
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
    </AppShell>
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
