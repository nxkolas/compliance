import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary, getLocale } from "@/src/i18n";
import { formatDateTime } from "@/src/i18n/format";
import { requireAuth } from "@/src/supabase/require-auth";
import { getApplicabilityAnswersForUser } from "@/src/server/modules/applicability-check";
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
  const answers = await getApplicabilityAnswersForUser(
    user.id,
    organizationId,
  );

  if (!answers) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const labels = dictionary.modules.applicabilityCheck.answers;

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg shadow-sm">
      <CardHeader className="min-w-0 px-4 sm:px-6">
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
      <CardContent className="min-w-0 px-4 sm:px-6">
        <dl className="grid gap-4">
          {answers.answers.map((answer) => (
            <div
              key={answer.questionStableKey}
              className="min-w-0 rounded-md border bg-muted/20 px-4 py-3"
            >
              <dt className="flex min-w-0 gap-3 text-sm font-medium">
                <span className="text-muted-foreground">
                  {answer.questionPosition}.
                </span>
                <span className="min-w-0 break-words">
                  {answer.questionText}
                </span>
              </dt>
              <dd className="mt-2 min-w-0 break-words text-sm text-muted-foreground">
                {answer.answerLabel ??
                  formatAnswerValue(answer.answerValue, labels.unset)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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
