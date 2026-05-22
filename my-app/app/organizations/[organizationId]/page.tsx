import { AppShell } from "@/components/app-shell";
import { OrganizationAssessmentWorkspace } from "@/components/organizations/organization-assessment-workspace";
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
  listSelfCheckAssessmentsForOrganization,
} from "@/src/server/organizations/service";
import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type OrganizationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  return (
    <Suspense fallback={<OrganizationPageFallback />}>
      <OrganizationPageContent params={params} />
    </Suspense>
  );
}

async function OrganizationPageContent({ params }: OrganizationPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const assessments = await listSelfCheckAssessmentsForOrganization(
    user.id,
    organization.id,
  );

  return (
    <AppShell
      organizationId={organization.id}
      organizationName={organization.name}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{organization.name}</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create and review NIS2 assessments for this organization.
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

      <OrganizationAssessmentWorkspace
        organizationId={organization.id}
        initialAssessments={serializeForClient(assessments)}
      />
      </div>
    </AppShell>
  );
}

function OrganizationPageFallback() {
  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Organization</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading organization workspace...
        </p>
      </section>
    </AppShell>
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
