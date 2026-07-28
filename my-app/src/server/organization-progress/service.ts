import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/src/db";
import { deriveOrganizationProgress } from "@/src/organization-progress/model";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";

export async function getOrganizationProgress(
  userId: string,
  organizationId: string,
) {
  await requireOrganizationCapability(
    userId,
    organizationId,
    "organizations:read",
  );

  const [artifacts, uploadedDocument, plans] = await Promise.all([
    db.query.generatedArtifacts.findMany({
      columns: {
        artifactType: true,
        acceptedRevisionId: true,
      },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.organizationId, organizationId),
            inArray(table.artifactType, [
              "affectedness_result",
              "gap_analysis_result",
            ]),
          ) ?? operators.sql`true`,
      },
    }),
    db.query.documents.findFirst({
      columns: { id: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.organizationId, organizationId),
            isNotNull(table.currentVersionId),
          ) ?? operators.sql`true`,
      },
    }),
    db.query.actionPlans.findMany({
      columns: {
        id: true,
        status: true,
        activatedAt: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.organizationId, organizationId) ?? operators.sql`true`,
      },
    }),
  ]);

  const applicabilityRevisionId =
    artifacts.find(
      (artifact) => artifact.artifactType === "affectedness_result",
    )?.acceptedRevisionId ?? null;
  const gapRevisionId =
    artifacts.find(
      (artifact) => artifact.artifactType === "gap_analysis_result",
    )?.acceptedRevisionId ?? null;
  const activePlan = plans.find((plan) => plan.status === "active") ?? null;

  const [applicabilityRevision, activePlanItems] = await Promise.all([
    applicabilityRevisionId
      ? db.query.generatedArtifactRevisions.findFirst({
          columns: { outcomeCode: true },
          where: {
            RAW: (table, operators) =>
              eq(table.id, applicabilityRevisionId) ?? operators.sql`true`,
          },
        })
      : null,
    activePlan
      ? db.query.actionPlanItems.findMany({
          columns: { status: true },
          where: {
            RAW: (table, operators) =>
              eq(table.actionPlanId, activePlan.id) ?? operators.sql`true`,
          },
        })
      : null,
  ]);

  return deriveOrganizationProgress({
    hasAcceptedApplicability: applicabilityRevisionId !== null,
    applicabilityOutcome: applicabilityRevision?.outcomeCode ?? null,
    hasAcceptedGapAnalysis: gapRevisionId !== null,
    hasUploadedDocument: uploadedDocument !== undefined,
    hasActivatedActionPlan: plans.some((plan) => plan.activatedAt !== null),
    activeActionPlanItemStatuses:
      activePlanItems?.map((item) => item.status) ?? null,
  });
}
