import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import { GuestApplicabilityActions } from "@/components/applicability-check/guest/guest-applicability-actions";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getGuestApplicabilityToken } from "@/src/server/applicability-check/guest-cookie";
import { getGuestApplicabilityCheck } from "@/src/server/applicability-check/service";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

type GuestApplicabilityResultPageProps = {
  searchParams?: Promise<{
    check?: string;
    claim?: string;
  }>;
};

export default function GuestApplicabilityResultPage({
  searchParams,
}: GuestApplicabilityResultPageProps) {
  return (
    <Suspense fallback={null}>
      <GuestApplicabilityResultPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function GuestApplicabilityResultPageContent({
  searchParams,
}: GuestApplicabilityResultPageProps) {
  await connection();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const labels = dictionary.modules.applicabilityCheck.guest;
  const resultLabels = dictionary.modules.applicabilityCheck.result;
  const resolvedSearchParams = await searchParams;
  const token =
    resolvedSearchParams?.claim ?? (await getGuestApplicabilityToken());
  const guestCheck = await getGuestApplicabilityCheck(
    token,
    resolvedSearchParams?.check,
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user && !user.is_anonymous);

  if (!guestCheck) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" className="w-fit">
            <Link href="/check/applicability">
              <ArrowLeft />
              {labels.backHome}
            </Link>
          </Button>
          <div className="rounded-lg border bg-card p-6 text-muted-foreground shadow-sm">
            {labels.notFound}
          </div>
          <Button asChild className="w-fit">
            <Link href="/check/applicability">
              <RefreshCw />
              {dictionary.modules.applicabilityCheck.overview.recalculate}
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const resultTitle =
    locale === "en"
      ? guestCheck.result.result.labelEn ?? guestCheck.result.result.label
      : guestCheck.result.result.label;
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/check/applicability">
            <ArrowLeft />
            {dictionary.modules.applicabilityCheck.result.recalculate}
          </Link>
        </Button>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {labels.resultTitle}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            {labels.resultDescription}
          </p>
        </header>

        <ApplicabilityResultCard
          result={guestCheck.result}
          labels={resultLabels}
          title={resultTitle}
        />

        <GuestApplicabilityActions
          labels={labels}
          isAuthenticated={isAuthenticated}
          guestToken={resolvedSearchParams?.claim}
          guestCheckId={guestCheck.id}
        />
      </div>
    </main>
  );
}
