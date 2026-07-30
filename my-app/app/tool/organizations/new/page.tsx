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

  const nextParam = Array.isArray(params.next)
    ? params.next[0]
    : params.next;

  const guestApplicabilityCheck = Array.isArray(
    params.guestApplicabilityCheck,
  )
    ? params.guestApplicabilityCheck[0]
    : params.guestApplicabilityCheck;

  const claimToken = Array.isArray(params.claim)
    ? params.claim[0]
    : params.claim;

  const redirectAfterCreate =
    nextParam === "assessment" ? "assessment" : "organization";

  return (
    <main
      id="organization-create-page"
      className="w-full min-w-0 overflow-x-hidden"
    >
      <div className="w-full min-w-0 pt-0">
        {/* Überschrift */}
        <header className="min-h-[112px] w-full min-w-0">
          <h1 className="break-words font-['Space_Grotesk'] text-3xl leading-9 font-bold tracking-tight text-foreground sm:text-4xl">
            {dictionary.organizations.newPageTitle}
          </h1>

          <p className="mt-3 max-w-4xl font-['Space_Grotesk'] text-base leading-7 font-normal text-info-foreground sm:text-lg">
            {dictionary.organizations.newPageDescription}
          </p>
        </header>

        {/* Formular, ohne dessen Komponente zu verändern */}
        <div className="mt-10 w-full min-w-0 sm:mt-[65px]">
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
      </div>
    </main>
  );
}
