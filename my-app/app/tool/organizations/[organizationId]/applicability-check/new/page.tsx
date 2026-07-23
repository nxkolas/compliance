import { ApplicabilityQuestionnaireForm } from "@/components/applicability-check/applicability-questionnaire-form";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getApplicabilityQuestionnaireForUser,
  getApplicabilityRecalculationLockForUser,
} from "@/src/server/applicability-check/service";
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
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.applicabilityCheck.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      {questionnaire ? (
        <ApplicabilityQuestionnaireForm
          submitUrl={`/api/organizations/${organizationId}/applicability-check/submissions`}
          successUrl={`/tool/organizations/${organizationId}/applicability-check/result`}
          questionnaire={questionnaire}
          labels={dictionary.modules.applicabilityCheck.form}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground shadow-sm">
          {dictionary.modules.applicabilityCheck.questionnaire.notSeeded}
        </div>
      )}
    </section>
  );
}
