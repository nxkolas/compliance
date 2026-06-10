import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listOrganizationsForUser } from "@/src/server/organizations/service";
import { Building2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<OrganizationsPageFallback />}>
      <OrganizationsPageContent />
    </Suspense>
  );
}

async function OrganizationsPageContent() {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const organizations = await listOrganizationsForUser(user.id);

  const sortedOrganizations = [...organizations].sort((a, b) =>
    a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
  );

  return (
    <AppShell dictionary={dictionary}>
      <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{dictionary.organizations.title}</h1>
          <p className="max-w-2xl text-muted-foreground">
            {dictionary.organizations.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/tool/organizations/new">
              <Plus />
              {dictionary.organizations.newOrganization}
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {dictionary.organizations.yourOrganizations}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dictionary.organizations.selectDescription}
            </p>
          </div>
          <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            {organizations.length} {dictionary.organizations.total}
          </span>
        </div>

        {sortedOrganizations.length === 0 ? (
          <Card className="rounded-lg border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {dictionary.organizations.noOrganization}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dictionary.organizations.createFirst}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedOrganizations.map((organization) => (
              <Card key={organization.id} className="rounded-lg shadow-sm">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {organization.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {organization.legalName ||
                          dictionary.organizations.legalNameEmpty}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border px-2 py-1">
                      {organization.size ?? dictionary.common.sizeUnknown}
                    </span>
                    <span className="rounded-md border px-2 py-1">
                      {organization.countryCode ?? "DE"}
                    </span>
                    {organization.employeeCount !== null && (
                      <span className="rounded-md border px-2 py-1">
                        {organization.employeeCount} {dictionary.common.employees}
                      </span>
                    )}
                  </div>
                  <Button asChild variant="outline" className="justify-self-start">
                    <Link href={`/tool/organizations/${organization.id}`}>
                      {dictionary.organizations.openOrganization}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      </div>
    </AppShell>
  );
}

function OrganizationsPageFallback() {
  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading your organizations...
        </p>
      </section>
    </AppShell>
  );
}
