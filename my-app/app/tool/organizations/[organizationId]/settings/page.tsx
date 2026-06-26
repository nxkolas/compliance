import { OrganizationSettingsForm } from "@/components/organizations/organization-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getOrganizationForUser,
  listCurrentOrganizationFactsForUser,
} from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type OrganizationSettingsPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const organizationFacts = await listCurrentOrganizationFactsForUser(
    user.id,
    organizationId,
  );
  const settingsLabels = dictionary.organizationSettings;

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">
          {dictionary.organizations.settingsTitle}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {dictionary.organizations.settingsDescription}
        </p>
      </section>
      <OrganizationSettingsForm
        organization={serializeForClient(organization)}
        labels={dictionary.organizationForm}
      />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle>{settingsLabels.factsTitle}</CardTitle>
            <CardDescription>{settingsLabels.factsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {organizationFacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {settingsLabels.factsEmpty}
              </p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {organizationFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="rounded-md border bg-muted/20 px-4 py-3"
                  >
                    <dt className="text-sm font-medium">
                      {fact.definition.label}
                    </dt>
                    <dd className="mt-1 break-words text-sm text-muted-foreground">
                      {formatFactValue(fact.value, settingsLabels)}
                    </dd>
                    <dd className="mt-2 text-xs text-muted-foreground">
                      {settingsLabels.sourceLabel}: {fact.sourceType}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle>{settingsLabels.frameworkTitle}</CardTitle>
            <CardDescription>
              {settingsLabels.frameworkDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {settingsLabels.activeFrameworkLabel}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {settingsLabels.activeFrameworkValue}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function formatFactValue(
  value: unknown,
  labels: OrganizationSettingsLabels,
): string {
  if (typeof value === "boolean") {
    return value ? labels.booleanTrue : labels.booleanFalse;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatFactValue(item, labels)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return labels.unsetValue;
}

type OrganizationSettingsLabels = Awaited<
  ReturnType<typeof getDictionary>
>["organizationSettings"];

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
