import { AppNavigation } from "@/components/app-navigation";
import { OrganizationInvitePanel } from "@/components/organizations/organization-invite-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getOrganizationForUser,
  listOrganizationInvitations,
} from "@/src/server/organizations/service";
import { ArrowLeft, Building2, ClipboardCheck } from "lucide-react";
import Link from "next/link";
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
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const invitations = await listOrganizationInvitations(user.id, organization.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/organizations">
              <ArrowLeft />
              Organizations
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/organizations/${organization.id}`}>
              <ClipboardCheck />
              Assessments
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{organization.name} team</h1>
          <p className="max-w-2xl text-muted-foreground">
            Manage organization invitations and teammate access.
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
              <CardTitle>Organization details</CardTitle>
              <CardDescription>
                {organization.legalName || "No legal name set"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-md border px-2.5 py-1">
            {organization.size ?? "Size unknown"}
          </span>
          <span className="rounded-md border px-2.5 py-1">
            {organization.countryCode ?? "DE"}
          </span>
          {organization.employeeCount !== null && (
            <span className="rounded-md border px-2.5 py-1">
              {organization.employeeCount} employees
            </span>
          )}
        </CardContent>
      </Card>

      <OrganizationInvitePanel
        organizationId={organization.id}
        initialInvitations={serializeForClient(invitations)}
      />
    </main>
  );
}

function OrganizationTeamPageFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Organization team</h1>
        <p className="max-w-2xl text-muted-foreground">Loading team...</p>
      </section>
    </main>
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
