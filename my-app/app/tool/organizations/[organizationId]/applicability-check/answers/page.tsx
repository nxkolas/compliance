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
  getApplicabilityAnswersForUser,
  getApplicabilityRecalculationLockForUser,
} from "@/src/server/applicability-check";
import { ArrowLeft, LockKeyhole, RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

type ApplicabilityAnswersPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ApplicabilityAnswersPage({
  params,
}: ApplicabilityAnswersPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [answers, recalculationLock] = await Promise.all([
    getApplicabilityAnswersForUser(user.id, organizationId, locale),
    getApplicabilityRecalculationLockForUser(user.id, organizationId),
  ]);

  if (!answers) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const labels = dictionary.modules.applicabilityCheck.answers;

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

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>
            {labels.revision} {answers.assessmentRevisionNumber}
          </CardTitle>
          <CardDescription>
            {labels.submitted}:{" "}
            {answers.submittedAt
              ? formatDateTime(answers.submittedAt, locale)
              : labels.noDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4">
            {answers.answers.map((answer) => (
              <div
                key={answer.questionStableKey}
                className="rounded-md border bg-muted/20 px-4 py-3"
              >
                <dt className="flex gap-3 text-sm font-medium">
                  <span className="text-muted-foreground">
                    {answer.questionPosition}.
                  </span>
                  <span>{answer.questionText}</span>
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground">
                  {answer.answerLabel ??
                    formatAnswerValue(answer.answerValue, labels.unset)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

function formatAnswerValue(value: unknown, unsetLabel: string): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatAnswerValue(item, unsetLabel)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return unsetLabel;
}
