import { OrganizationInvitePanel } from "@/components/organizations/organization-invite-panel";
import { RouteTabs } from "@/components/route-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getOrganizationForUser,
  listOrganizationInvitations,
} from "@/src/server/organizations/service";
import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type OrganizationTeamPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationTeamPage({
  params,
}: OrganizationTeamPageProps) {
  return (
    <Suspense fallback={<OrganizationTeamPageFallback />}>
      <OrganizationTeamPageContent params={params} />
    </Suspense>
  );
}

async function OrganizationTeamPageContent({
  params,
}: OrganizationTeamPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const invitations = await listOrganizationInvitations(user.id, organization.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <RouteTabs
        tabs={[
          {
            href: `/tool/organizations/${organizationId}/settings`,
            label: dictionary.sidebar.general,
          },
          {
            href: `/tool/organizations/${organizationId}/settings/team`,
            label: dictionary.sidebar.team,
          },
        ]}
      />
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            {organization.name} {dictionary.organizations.teamTitle}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {dictionary.organizations.teamDescription}
          </p>
        </div>
      </section>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>{dictionary.organizations.details}</CardTitle>
              <CardDescription>
                {organization.legalName ||
                  dictionary.organizations.legalNameEmpty}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-md border px-2.5 py-1">
            {organization.size ?? dictionary.common.sizeUnknown}
          </span>
          <span className="rounded-md border px-2.5 py-1">
            {organization.countryCode ?? "DE"}
          </span>
          {organization.employeeCount !== null && (
            <span className="rounded-md border px-2.5 py-1">
              {organization.employeeCount} {dictionary.common.employees}
            </span>
          )}
        </CardContent>
      </Card>

      <OrganizationInvitePanel
        organizationId={organization.id}
        initialInvitations={serializeForClient(invitations)}
        labels={dictionary.invite}
        locale={locale}
      />
    </div>
  );
}

function OrganizationTeamPageFallback() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold">Organization team</h1>
      <p className="max-w-2xl text-muted-foreground">Loading team...</p>
    </section>
  );
}

function serializeForClient<T>(value: T): JSONValue<T> {
  return JSON.parse(JSON.stringify(value)) as JSONValue<T>;
}

type JSONValue<T> = T extends null
  ? null
  : T extends Date
    ? string
    : T extends Date | null
      ? string | null
      : T extends Array<infer U>
        ? Array<JSONValue<U>>
        : T extends object
          ? { [K in keyof T]: JSONValue<T[K]> }
          : T;
