import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import {
  getCurrentActionPlan,
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
  const actionableGapCount = gapWorkflow
    ? gapWorkflow.gapCounts.all - gapWorkflow.gapCounts.fulfilled
    : 0;
  const availableGapRevisionId =
    gapWorkflow?.revision &&
    gapWorkflow.lifecycle.canFinalize &&
    gapWorkflow.canManage &&
    actionableGapCount > 0 &&
    gapWorkflow.reviewBlockers.length === 0
      ? gapWorkflow.revision.id
      : null;

  return (
    <section className="flex w-full min-w-0 flex-col gap-8 xl:pl-[17px]">
      <PageHeader
        title={dictionary.modules.actionPlan.title}
        subtitle={dictionary.modules.actionPlan.description}
        className="max-w-[1274px] [&>p]:max-w-[1130px]"
      />
      <ActionPlanWorkflow
        organizationId={organizationId}
        current={current}
        availableGapRevisionId={availableGapRevisionId}
        canContribute={hasOrganizationCapability(membership.role, "plans:contribute")}
        labels={dictionary.modules.actionPlan.workflow}
      />
    </section>
  );
}
