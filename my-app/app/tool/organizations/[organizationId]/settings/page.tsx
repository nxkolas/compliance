import { OrganizationSettingsForm } from "@/components/organizations/organization-settings-form";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type OrganizationSettingsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  return (
    <Suspense fallback={<OrganizationSettingsPageFallback />}>
      <OrganizationSettingsPageContent params={params} />
    </Suspense>
  );
}

async function OrganizationSettingsPageContent({
  params,
}: OrganizationSettingsPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Organization settings</h1>
        <p className="max-w-2xl text-muted-foreground">
          Edit organization data and workspace settings.
        </p>
      </section>
      <OrganizationSettingsForm organization={serializeForClient(organization)} />
    </div>
  );
}

function OrganizationSettingsPageFallback() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold">Organization settings</h1>
      <p className="max-w-2xl text-muted-foreground">
        Loading organization settings...
      </p>
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
