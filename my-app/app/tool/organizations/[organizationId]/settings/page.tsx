import { OrganizationSettingsForm } from "@/components/organizations/organization-settings-form";
import { OrganizationSettingsLoading } from "@/components/organizations/organization-settings-loading";
import { RouteTabs } from "@/components/route-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
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
  const dictionary = await getDictionary();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-8">
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
      <section className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Benutzerkonto",
            description: "Login, E-Mail und Kontoangaben bleiben in Supabase Auth.",
            items: ["E-Mail-Adresse", "Passwort", "Account-Sicherheit"],
          },
          {
            title: "Sprache",
            description: "Die Spracheinstellung wird spaeter pro Nutzer gespeichert.",
            items: ["Deutsch", "Englisch", "Persoenliche Praeferenz"],
          },
          {
            title: "Benachrichtigungen",
            description: "Organisationweite und persoenliche Hinweise sind vorgesehen.",
            items: ["Offene Massnahmen", "Dokumentenstatus", "Fristen"],
          },
          {
            title: "Datenschutz",
            description: "Datenschutz- und Aufbewahrungseinstellungen werden separat abgebildet.",
            items: ["Datenaufbewahrung", "Dokumentenverarbeitung", "Organisationsrichtlinien"],
          },
        ].map((section) => (
          <Card key={section.title} className="rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function OrganizationSettingsPageFallback() {
  return <OrganizationSettingsLoading />;
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
