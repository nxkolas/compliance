import { ApplicabilityQuestionnaireForm } from "@/components/applicability-check/applicability-questionnaire-form";
import { PageHeader } from "@/components/page-header";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getApplicabilityQuestionnaireForUser,
  getApplicabilityRecalculationLockForUser,
} from "@/src/server/applicability-check";
import { redirect } from "next/navigation";
import { connection } from "next/server";

type NewApplicabilityCheckPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function NewApplicabilityCheckPage({
  params,
}: NewApplicabilityCheckPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [questionnaire, recalculationLock] = await Promise.all([
    getApplicabilityQuestionnaireForUser(user.id, organizationId, locale),
    getApplicabilityRecalculationLockForUser(user.id, organizationId),
  ]);
  if (recalculationLock.locked) {
    redirect(`/tool/organizations/${organizationId}/applicability-check`);
  }

  return (
    <section className="flex w-full min-w-0 flex-col gap-8 sm:gap-12">
      <PageHeader
        title={dictionary.modules.applicabilityCheck.title}
        subtitle={dictionary.modules.applicabilityCheck.questionnaireDescription}
      />

      {questionnaire ? (
        <ApplicabilityQuestionnaireForm
          submitUrl={`/api/organizations/${organizationId}/applicability-check/submissions`}
          successUrl={`/tool/organizations/${organizationId}/applicability-check/result`}
          questionnaire={questionnaire}
          labels={dictionary.modules.applicabilityCheck.form}
          presentation="authenticated-stepper"
        />
      ) : (
        <Alert className="p-6 text-muted-foreground shadow-sm">
          <AlertDescription className="text-muted-foreground">
            {dictionary.modules.applicabilityCheck.questionnaire.notSeeded}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
