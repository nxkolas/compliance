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
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getApplicabilityResultForUser } from "@/src/server/applicability-check/service";
import { ArrowLeft, ClipboardList, RefreshCw } from "lucide-react";
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
  const result = await getApplicabilityResultForUser(user.id, organizationId);

  if (!result) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const labels = dictionary.modules.applicabilityCheck.result;
  const presentation = getOutcomePresentation(
    result.result.outcome,
    labels.outcomes,
  );
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
        <Button asChild variant="secondary">
          <Link href={`${baseHref}/new`}>
            <RefreshCw />
            {labels.recalculate}
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden rounded-lg shadow-sm">
        <div className={cn("h-2", presentation.barClass)} />
        <CardHeader>
          <CardTitle className="text-2xl">{resultTitle}</CardTitle>
          <CardDescription>
            {labels.ruleSet}: {result.ruleSetVersionLabel ?? labels.unknown} |{" "}
            {labels.revision} {result.artifactRevisionNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">{labels.outcome}</p>
              <p className="mt-1 font-semibold">{presentation.label}</p>
            </div>
            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {labels.confidence}
              </p>
              <p className="mt-1 font-semibold">
                {Math.round(result.result.confidence * 100)}%
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {labels.assessmentSource}
              </p>
              <p className="mt-1 truncate font-semibold">
                {result.assessmentRevisionId ?? labels.unknown}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold">{labels.reasoning}</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              {result.result.reasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {result.result.matchedRuleIds.length > 0 ? (
            <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {labels.matchedRule}: {result.result.matchedRuleIds.join(", ")}
            </div>
          ) : null}

          {result.result.disclaimer ? (
            <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {result.result.disclaimer}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function getOutcomePresentation(
  outcome: string,
  labels: {
    affected: string;
    possiblyAffected: string;
    notAffected: string;
  },
) {
  if (outcome === "affected") {
    return {
      label: labels.affected,
      barClass: "bg-amber-400",
    };
  }

  if (outcome === "not_affected") {
    return {
      label: labels.notAffected,
      barClass: "bg-emerald-400",
    };
  }

  return {
    label: labels.possiblyAffected,
    barClass: "bg-blue-400",
  };
}
