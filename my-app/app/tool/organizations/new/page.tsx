import { AppShell } from "@/components/app-shell";
import { OrganizationCreateForm } from "@/components/organizations/organization-create-form";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";

type NewOrganizationPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    guestApplicabilityCheck?: string | string[];
    claim?: string | string[];
  }>;
};

export default async function NewOrganizationPage({
  searchParams,
}: NewOrganizationPageProps) {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const params = searchParams ? await searchParams : {};
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const guestApplicabilityCheck = Array.isArray(params.guestApplicabilityCheck)
    ? params.guestApplicabilityCheck[0]
    : params.guestApplicabilityCheck;
  const claimToken = Array.isArray(params.claim) ? params.claim[0] : params.claim;
  const redirectAfterCreate =
    nextParam === "assessment" ? "assessment" : "organization";

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
      <OrganizationCreateForm
        labels={dictionary.organizationForm}
        locale={locale}
        redirectAfterCreate={redirectAfterCreate}
        guestApplicabilityClaim={
          guestApplicabilityCheck
            ? {
                checkId: guestApplicabilityCheck,
                token: claimToken,
              }
            : undefined
        }
      />
      </div>
    </AppShell>
  );
}
