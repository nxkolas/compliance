import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { PageHeader } from "@/components/page-header";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  getCurrentActionPlan,
  getCurrentApprovedGapRevision,
  getActionPlanHistory,
} from "@/src/server/action-plans/service";
import { getActionPlanReconciliation } from "@/src/server/action-plans/reconciliation-service";
import { assertCanAccessOrganization, listOrganizationMembers } from "@/src/server/organizations/service";
import { hasOrganizationCapability } from "@/src/server/auth/capabilities";
import { connection } from "next/server";

export default async function ActionPlanPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const { organizationId } = await params;
  const membership = await assertCanAccessOrganization(user.id, organizationId);
  const [current, approvedRevision, reconciliation, history, members] = await Promise.all([
    getCurrentActionPlan(user.id, organizationId),
    getCurrentApprovedGapRevision(user.id, organizationId),
    getActionPlanReconciliation(user.id, organizationId),
    getActionPlanHistory(user.id, organizationId),
    listOrganizationMembers(user.id, organizationId),
  ]);

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={dictionary.modules.actionPlan.title}
        subtitle={dictionary.modules.actionPlan.description}
      />
      <ActionPlanWorkflow
        organizationId={organizationId}
        current={current}
        reconciliation={reconciliation}
        history={history}
        approvedGapRevisionId={approvedRevision?.id ?? null}
        canManage={hasOrganizationCapability(membership.role, "plans:manage")}
        canContribute={hasOrganizationCapability(membership.role, "plans:contribute")}
        labels={dictionary.modules.actionPlan.workflow}
        members={members.map(({ userId, status }) => ({ userId, status }))}
      />
    </section>
  );
}
