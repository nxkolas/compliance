import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <section className="@container/result-page flex w-full min-w-0 flex-col gap-8">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      {recalculationLock.locked ? (
        <Alert className="items-start gap-x-2 gap-y-0 rounded-md border-primary/35 bg-primary/10 px-4 py-3 text-sm has-[>svg]:gap-x-2 [&>svg]:translate-y-0">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <AlertDescription className="text-foreground">
            {dictionary.modules.applicabilityCheck.recalculationLocked}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-12 flex flex-col gap-4 sm:mb-0 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between @5xl/result-page:mb-[17px]">
        <nav
          aria-label={locale === "en" ? "Result views" : "Ergebnisansichten"}
        >
          <Tabs value={`${baseHref}/result`} className="gap-0">
            <TabsList
              variant="line"
              className="h-12 gap-0 rounded-none p-0"
            >
              <TabsTrigger
                value={`${baseHref}/result`}
                asChild
                className="h-12 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-white bg-transparent px-5 py-0 text-base font-medium text-white shadow-none after:hidden hover:text-white data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:text-white dark:hover:text-white dark:data-[state=active]:border-white dark:data-[state=active]:bg-transparent"
              >
                <Link href={`${baseHref}/result`} aria-current="page">
                  {labels.overview}
                </Link>
              </TabsTrigger>
              <TabsTrigger
                value={`${baseHref}/answers`}
                asChild
                className="h-12 flex-none rounded-none border-x-0 border-t-0 border-b-[1.5px] border-gray-800 bg-transparent px-5 py-0 text-base font-medium text-zinc-600 shadow-none after:hidden hover:text-zinc-300 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:text-zinc-600 dark:hover:text-zinc-300 dark:data-[state=active]:bg-transparent"
              >
                <Link href={`${baseHref}/answers`}>{labels.answers}</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>

        <div className="flex justify-end sm:mt-12 sm:ml-auto @5xl/result-page:mt-[17px]">
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
