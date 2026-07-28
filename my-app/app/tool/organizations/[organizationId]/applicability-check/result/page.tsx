import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getApplicabilityRecalculationLockForUser,
  getApplicabilityResultForUser,
} from "@/src/server/applicability-check";
import {
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

type ApplicabilityResultPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ApplicabilityResultPage({
  params,
}: ApplicabilityResultPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [result, recalculationLock] = await Promise.all([
    getApplicabilityResultForUser(user.id, organizationId),
    getApplicabilityRecalculationLockForUser(user.id, organizationId),
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
    "h-12 w-full max-w-full gap-1 rounded-lg bg-[#002BFF] px-2 text-sm outline outline-[1.5px] outline-offset-[-1.5px] outline-[#002BFF] sm:w-[21rem] sm:gap-2 sm:px-4 sm:text-base";

  return (
    <section className="mx-auto flex w-full max-w-[1278.5px] flex-col gap-8">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      {recalculationLock.locked ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{dictionary.modules.applicabilityCheck.recalculationLocked}</span>
        </div>
      ) : null}

      <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between min-[1440px]:mt-0 min-[1440px]:mb-[34px]">
        <nav
          aria-label={locale === "en" ? "Result views" : "Ergebnisansichten"}
          className="flex h-12 items-stretch"
        >
          <Link
            href={`${baseHref}/result`}
            aria-current="page"
            className="inline-flex items-center border-b-2 border-white px-5 text-base font-medium text-white"
          >
            {labels.overview}
          </Link>
          <Link
            href={`${baseHref}/answers`}
            className="inline-flex items-center border-b-[1.5px] border-gray-800 px-5 text-base font-medium text-zinc-600 transition-colors hover:text-zinc-300"
          >
            {labels.answers}
          </Link>
        </nav>

        <div className="flex justify-end sm:ml-auto sm:translate-y-12 min-[1440px]:translate-y-[17px]">
          {recalculationLock.locked ? (
            <Button
              disabled
              className={recalculateButtonClassName}
            >
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

      <ApplicabilityResultCard
        result={result}
        locale={locale}
        labels={labels}
        title={resultTitle}
        startCurrentHref={`${baseHref}/new`}
        gapAnalysisHref={`/tool/organizations/${organizationId}/gap-analysis`}
        recalculationLocked={recalculationLock.locked}
      />
    </section>
  );
}
