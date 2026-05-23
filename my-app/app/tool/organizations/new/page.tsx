import { AppShell } from "@/components/app-shell";
import { OrganizationCreateForm } from "@/components/organizations/organization-create-form";
import { getDefaultDictionary, getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";
import { Suspense } from "react";

export default function NewOrganizationPage() {
  return (
    <Suspense fallback={<NewOrganizationPageFallback />}>
      <NewOrganizationPageContent />
    </Suspense>
  );
}

async function NewOrganizationPageContent() {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            {dictionary.organizations.newOrganization}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {dictionary.organizations.newDescription}
          </p>
        </div>
      </section>
      <OrganizationCreateForm labels={dictionary.organizationForm} />
      </div>
    </AppShell>
  );
}

function NewOrganizationPageFallback() {
  const dictionary = getDefaultDictionary();

  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">
          {dictionary.organizations.newOrganization}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {dictionary.organizations.loadingForm}
        </p>
      </section>
    </AppShell>
  );
}
