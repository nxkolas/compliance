import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
  const [dictionary, locale, active, archived] = await Promise.all([
    getDictionary(),
    getLocale(),
    listOrganizationsForUserPage({ userId: user.id, status: "active", limit: 25 }),
    listOrganizationsForUserPage({ userId: user.id, status: "archived", limit: 25 }),
  ]);
  const notice = (await searchParams)?.notice;

  return (
    <AppShell dictionary={dictionary}>
      <div className="flex w-full flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-2">
            <h1 className="text-3xl font-bold">{dictionary.organizations.title}</h1>
            <p className="max-w-2xl text-muted-foreground">{dictionary.organizations.description}</p>
          </div>
          <Button asChild>
            <Link href="/tool/organizations/new"><Plus />{dictionary.organizations.switcherCreate}</Link>
          </Button>
        </header>
        {(Array.isArray(notice) ? notice[0] : notice) === "archived" && (
          <div role="status" className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            {dictionary.organizationManagement.archivedRouteNotice}
          </div>
        )}
        <OrganizationManagementList
          initialActive={{ items: serialize(active.organizations), cursor: active.nextCursor }}
          initialArchived={{ items: serialize(archived.organizations), cursor: archived.nextCursor }}
          locale={locale}
          labels={dictionary.organizationManagement}
        />
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
