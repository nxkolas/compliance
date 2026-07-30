import { ApplicabilityResultNavigation } from "@/components/applicability-check/applicability-result-navigation";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { LockKeyhole, RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import {
  getCompletedApplicabilityRecalculationLock,
  getCompletedApplicabilityResult,
} from "./data";

type CompletedApplicabilityCheckLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function CompletedApplicabilityCheckLayout({
  children,
  params,
}: CompletedApplicabilityCheckLayoutProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [result, recalculationLock] = await Promise.all([
    getCompletedApplicabilityResult(user.id, organizationId),
    getCompletedApplicabilityRecalculationLock(user.id, organizationId),
  ]);

  if (!result) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const labels = dictionary.modules.applicabilityCheck.result;
  const resultTitle =
    locale === "en"
      ? result.result.labelEn ?? result.result.label
      : result.result.label;
  const pageTitle =
    locale === "en"
      ? "Applicability check result"
      : "Betroffenheitscheck-Ergebnis";
  const pageSubtitle =
    locale === "en"
      ? `Your result: ${resultTitle}`
      : `Ihr Ergebnis: ${resultTitle}`;
  const recalculateLabel =
    locale === "en"
      ? "Recalculate applicability check"
      : "Betroffenheitscheck neu berechnen";
  const recalculateButtonClassName =
    "h-12 w-full max-w-full justify-center gap-2 rounded-lg bg-[#002BFF] px-5 text-base outline outline-[1.5px] outline-offset-[-1.5px] outline-[#002BFF] sm:w-[21rem]";

  return (
    <section className="@container/result-page flex w-full min-w-0 flex-col gap-8">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      {recalculationLock.locked ? (
        <Alert className="items-start gap-x-2 gap-y-0 rounded-md border-primary/35 bg-primary/10 px-4 py-3 text-sm has-[>svg]:gap-x-2 [&>svg]:translate-y-0">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <AlertDescription className="min-w-0 break-words text-foreground">
            {dictionary.modules.applicabilityCheck.recalculationLocked}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-12 flex flex-col gap-4 sm:mb-0 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between @5xl/result-page:mb-[17px]">
        <ApplicabilityResultNavigation
          answersLabel={labels.answers}
          baseHref={baseHref}
          locale={locale}
          overviewLabel={labels.overview}
        />

        <div className="flex justify-end sm:mt-12 sm:ml-auto @5xl/result-page:mt-[17px]">
          {recalculationLock.locked ? (
            <Button disabled className={recalculateButtonClassName}>
              <LockKeyhole />
              {recalculateLabel}
            </Button>
          ) : (
            <Button
              asChild
              className={`${recalculateButtonClassName} hover:bg-[#002BFF]/90`}
            >
              <Link href={`${baseHref}/new`}>
                <RefreshCw />
                {recalculateLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}
