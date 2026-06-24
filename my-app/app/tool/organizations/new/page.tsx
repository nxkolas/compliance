import { AppShell } from "@/components/app-shell";
import { OrganizationCreateForm } from "@/components/organizations/organization-create-form";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";

export default async function NewOrganizationPage() {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <div className="flex w-full flex-col gap-8">
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
