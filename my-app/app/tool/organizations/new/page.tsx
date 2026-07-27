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
    <AppShell dictionary={dictionary}>
      <main id="organization-create-page" className="w-full overflow-x-auto">
        <style>
          {`
            #organization-create-page form {
              background-color: #1B1E27 !important;
              border-color: #3D4049 !important;
              outline-color: #3D4049 !important;
              border-width: 1.5px !important;
              border-radius: 12px !important;
            }
          `}
        </style>
        <div className="w-max min-w-full pb-[364px] pl-[54px] pr-[53px] pt-0">
          {/* Überschrift */}
          <header className="h-[112px] w-[1205px] min-w-[1205px]">
            <h1 className="font-['Space_Grotesk'] text-4xl font-bold leading-9 tracking-tight text-white">
              {dictionary.organizations.newPageTitle}
            </h1>

            <p className="mt-3 font-['Space_Grotesk'] text-lg font-normal leading-7 text-blue-200">
              {dictionary.organizations.newPageDescription}
            </p>
          </header>

          {/* Formular, ohne dessen Komponente zu verändern */}
          <div
            className="
              mt-[65px]
              w-[1205px]
              min-w-[1205px]
              max-w-none
              shrink-0

              [&>div]:w-[1205px]
              [&>div]:min-w-[1205px]
              [&>div]:max-w-none

              [&_form]:w-[1205px]
              [&_form]:min-w-[1205px]
              [&_form]:max-w-none
              [&_form]:shrink-0
            "
          >
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
    </AppShell>
  );
}
