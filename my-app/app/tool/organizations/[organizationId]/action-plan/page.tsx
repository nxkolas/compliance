import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import {
  getCurrentActionPlan,
  getActionPlanGenerationStatus,
  resolvePlanPreparation,
} from "@/src/server/modules/action-plans";
import { assertCanAccessOrganization } from "@/src/server/modules/organizations";
import { hasOrganizationCapability } from "@/src/server/platform/auth/capabilities";
import { getGapAnalysisWorkflow } from "@/src/server/modules/gap-analysis";
import { connection } from "next/server";

export default async function ActionPlanPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const membership = await assertCanAccessOrganization(user.id, organizationId);
  const current = await getCurrentActionPlan(user.id, organizationId);
  const gapWorkflow = current
    ? null
    : await getGapAnalysisWorkflow({
        userId: user.id,
        organizationId,
        locale,
      });
  const generationJob = gapWorkflow
    ? await getActionPlanGenerationStatus(user.id, organizationId, gapWorkflow.revision?.id ?? null)
    : null;
  const preparationState = gapWorkflow ? resolvePlanPreparation(gapWorkflow, generationJob) : undefined;
  const availableGapRevisionId = preparationState === "ready" || preparationState === "failed"
    ? gapWorkflow?.revision?.id ?? null : null;

  return (
    <section className="flex w-full min-w-0 flex-col gap-8">
      <PageHeader
        title={dictionary.modules.actionPlan.title}
        subtitle={dictionary.modules.actionPlan.description}
        className="w-full [&>p]:w-full [&>p]:max-w-none"
      />
      <ActionPlanWorkflow
        organizationId={organizationId}
        current={current}
        availableGapRevisionId={availableGapRevisionId}
        preparationState={preparationState}
        generationJobId={preparationState === "generating" ? generationJob?.id : undefined}
        canContribute={hasOrganizationCapability(membership.role, "plans:contribute")}
        labels={dictionary.modules.actionPlan.workflow}
      />
    </section>
  );
}
