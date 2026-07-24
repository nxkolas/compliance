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
  ArrowLeft,
  ClipboardList,
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

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={labels.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      {recalculationLock.locked ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{dictionary.modules.applicabilityCheck.recalculationLocked}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={baseHref}>
            <ArrowLeft />
            {labels.overview}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${baseHref}/answers`}>
            <ClipboardList />
            {labels.answers}
          </Link>
        </Button>
        {recalculationLock.locked ? (
          <Button disabled variant="secondary">
            <LockKeyhole />
            {labels.recalculate}
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href={`${baseHref}/new`}>
              <RefreshCw />
              {labels.recalculate}
            </Link>
          </Button>
        )}
      </div>

      <ApplicabilityResultCard
        result={result}
        locale={locale}
        labels={labels}
        title={resultTitle}
        startCurrentHref={`${baseHref}/new`}
        recalculationLocked={recalculationLock.locked}
      />
    </section>
  );
}
