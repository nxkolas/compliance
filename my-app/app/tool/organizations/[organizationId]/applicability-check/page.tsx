import { PageHeader } from "@/components/page-header";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
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
} from "@/src/server/applicability-check";
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
  const reasons =
    locale === "en"
      ? overview.result?.result.reasonsEn
      : overview.result?.result.reasons;
  const actionButtonClassName =
    "h-auto min-h-9 w-full min-w-0 whitespace-normal py-2 text-center sm:w-auto";

  return (
    <section className="flex w-full min-w-0 flex-col gap-8">
      <PageHeader
        title={dictionary.modules.applicabilityCheck.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      {recalculationLock.locked ? (
        <Alert className="min-w-0 rounded-md border-primary/35 bg-primary/10 has-[>svg]:gap-x-2">
          <LockKeyhole className="shrink-0 text-primary" />
          <AlertDescription className="min-w-0 break-words text-foreground">
            {dictionary.modules.applicabilityCheck.recalculationLocked}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        <Card className="min-w-0 gap-0 rounded-md py-0 shadow-none">
          <CardContent className="px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {labels.resultMetric}
            </p>
            <p className="mt-1 break-words text-xl font-semibold">
              {resultLabel ?? labels.pending}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-0 rounded-md py-0 shadow-none">
          <CardContent className="px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {labels.revisionMetric}
            </p>
            <p className="mt-1 break-words text-xl font-semibold">
              {overview.assessmentRevisionNumber}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-0 rounded-md py-0 shadow-none">
          <CardContent className="px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {labels.statusMetric}
            </p>
            <p className="mt-1 break-words text-xl font-semibold">
              {formatOutcome(outcome, labels.outcomes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden rounded-lg shadow-sm">
        <CardHeader className="min-w-0 px-4 sm:px-6">
          <CardTitle>{labels.currentTitle}</CardTitle>
          <CardDescription>
            {labels.lastCalculation}:{" "}
            {overview.submittedAt
              ? formatDateTime(overview.submittedAt, locale)
              : labels.noDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4 px-4 sm:px-6">
          <p className="max-w-2xl break-words text-sm leading-6 text-muted-foreground">
            {reasons?.join(" ") ?? labels.noResult}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild className={actionButtonClassName}>
              <Link href={`${baseHref}/result`}>
                <FileText />
                {labels.viewResult}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={actionButtonClassName}
            >
              <Link href={`${baseHref}/answers`}>
                <ClipboardList />
                {labels.viewAnswers}
              </Link>
            </Button>
            {recalculationLock.locked ? (
              <Button
                disabled
                variant="secondary"
                className={actionButtonClassName}
              >
                <LockKeyhole />
                {labels.recalculate}
              </Button>
            ) : (
              <Button
                asChild
                variant="secondary"
                className={actionButtonClassName}
              >
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
