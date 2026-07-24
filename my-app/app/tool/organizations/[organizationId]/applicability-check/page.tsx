import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary, getLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getApplicabilityOverviewForUser,
  getApplicabilityRecalculationLockForUser,
} from "@/src/server/applicability-check/service";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

type ApplicabilityCheckPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ApplicabilityCheckPage({
  params,
}: ApplicabilityCheckPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [overview, recalculationLock] = await Promise.all([
    getApplicabilityOverviewForUser(user.id, organizationId),
    getApplicabilityRecalculationLockForUser(user.id, organizationId),
  ]);

  if (!overview) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const outcome = overview.result?.result.outcome ?? "clarification_required";
  const labels = dictionary.modules.applicabilityCheck.overview;
  const resultLabel =
    locale === "en"
      ? overview.result?.result.labelEn ?? overview.result?.result.label
      : overview.result?.result.label;

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.applicabilityCheck.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      {recalculationLock.locked ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{dictionary.modules.applicabilityCheck.recalculationLocked}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">{labels.resultMetric}</p>
          <p className="mt-1 text-xl font-semibold">
            {resultLabel ?? labels.pending}
          </p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {labels.revisionMetric}
          </p>
          <p className="mt-1 text-xl font-semibold">
            {overview.assessmentRevisionNumber}
          </p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">{labels.statusMetric}</p>
          <p className="mt-1 text-xl font-semibold">
            {formatOutcome(outcome, labels.outcomes)}
          </p>
        </div>
      </div>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>{labels.currentTitle}</CardTitle>
          <CardDescription>
            {labels.lastCalculation}:{" "}
            {overview.submittedAt
              ? formatDateTime(overview.submittedAt, locale)
              : labels.noDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {overview.result?.result.reasons.join(" ") ?? labels.noResult}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`${baseHref}/result`}>
                <FileText />
                {labels.viewResult}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${baseHref}/answers`}>
                <ClipboardList />
                {labels.viewAnswers}
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
        </CardContent>
      </Card>
    </section>
  );
}

function formatOutcome(
  outcome: string,
  labels: {
    essentialEntity: string;
    importantEntity: string;
    notDirectlyInScope: string;
    clarificationRequired: string;
  },
) {
  if (outcome === "essential_entity") {
    return labels.essentialEntity;
  }

  if (outcome === "important_entity") {
    return labels.importantEntity;
  }

  if (outcome === "not_directly_in_scope") {
    return labels.notDirectlyInScope;
  }

  return labels.clarificationRequired;
}
