import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { deriveOrganizationProgress } from "@/src/organization-progress/model";
import { authorizeOrganizationRead } from "@/src/server/platform/auth/organization-scope";

export async function getOrganizationProgress(userId: string, organizationId: string) {
  const { executor: db } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" });
  const [outputs, uploadedDocument, plan] = await Promise.all([
    db.query.analysisOutputs.findMany({
      columns: { kind: true, currentRevisionId: true },
      where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), inArray(table.kind, ["applicability", "gap"])) ?? operators.sql`true` },
    }),
    db.query.documents.findFirst({
      columns: { id: true },
      where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), isNotNull(table.currentVersionId)) ?? operators.sql`true` },
    }),
    db.query.actionPlans.findFirst({
      columns: { id: true },
      where: { RAW: (table, operators) => eq(table.organizationId, organizationId) ?? operators.sql`true` },
    }),
  ]);
  const applicabilityRevisionId = outputs.find((output) => output.kind === "applicability")?.currentRevisionId ?? null;
  const gapRevisionId = outputs.find((output) => output.kind === "gap")?.currentRevisionId ?? null;
  const [applicabilityRevision, planItems] = await Promise.all([
    applicabilityRevisionId ? db.query.analysisOutputRevisions.findFirst({
      columns: { outcomeCode: true },
      where: { RAW: (table, operators) => eq(table.id, applicabilityRevisionId) ?? operators.sql`true` },
    }) : null,
    plan ? db.query.actionPlanItems.findMany({
      columns: { status: true },
      where: { RAW: (table, operators) => eq(table.actionPlanId, plan.id) ?? operators.sql`true` },
    }) : null,
  ]);
  return deriveOrganizationProgress({
    hasAcceptedApplicability: applicabilityRevisionId !== null,
    applicabilityOutcome: applicabilityRevision?.outcomeCode ?? null,
    hasAcceptedGapAnalysis: gapRevisionId !== null,
    hasUploadedDocument: uploadedDocument !== undefined,
    hasActivatedActionPlan: plan !== undefined,
    activeActionPlanItemStatuses: planItems?.map((item) => item.status) ?? null,
  });
}
