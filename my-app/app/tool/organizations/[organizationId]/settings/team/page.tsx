import { OrganizationInvitePanel } from "@/components/organizations/organization-invite-panel";
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

type OrganizationTeamPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationTeamPage({
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
    <div className="flex w-full flex-col gap-8">
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
            {organization.country ?? "DE"}
          </span>
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
