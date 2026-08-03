import { assessments, auditEvents } from "@/src/db/schema";
import { currentApplicabilityDefinitionHash } from "@/src/server/definitions";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "../auth/organization-scope";
import {
  assertGapApplicabilityEligible,
  evaluateGapApplicabilityPrerequisite,
} from "./applicability-eligibility";
import { createOrOpenQuestionnaireDraft } from "./questionnaire-draft-service";

export async function createOrOpenGapAssessment(
  userId: string,
  organizationId: string,
) {
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "gap:contribute" }, async ({ executor: db }) => {
  const applicabilityOutput = await db.query.analysisOutputs.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, "applicability")) ?? operators.sql`true`,
    },
  });
  const applicabilityRevision = applicabilityOutput?.currentRevisionId
    ? await db.query.analysisOutputRevisions.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.id, applicabilityOutput.currentRevisionId!),
              eq(table.organizationId, organizationId),
            ) ?? operators.sql`true`,
        },
      })
    : null;
  assertGapApplicabilityEligible(
    evaluateGapApplicabilityPrerequisite(
      currentApplicabilityDefinitionHash,
      applicabilityRevision,
    ),
  );
  await db
    .insert(assessments)
    .values({ organizationId, kind: "gap" })
    .onConflictDoNothing({ target: [assessments.organizationId, assessments.kind] });
  const assessment = await db.query.assessments.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, "gap")) ?? operators.sql`true`,
    },
  });
  if (!assessment) throw new Error("Gap assessment was not created");
  if (!assessment.currentRevisionId) {
    await db.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "gap_assessment.opened",
      entityType: "assessment",
      entityId: assessment.id,
      metadata: { applicabilityOutputRevisionId: applicabilityRevision?.id },
    });
  }
  await createOrOpenQuestionnaireDraft({
    userId,
    organizationId,
    assessment,
    locale: "de",
    executor: db,
  });
  return assessment;
  });
}

export async function getGapAssessment(
  userId: string,
  organizationId: string,
  assessmentId: string,
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "gap:read" });
  const assessment = await executor.query.assessments.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.id, assessmentId), eq(table.organizationId, organizationId), eq(table.kind, "gap")) ?? operators.sql`true`,
    },
  });
  if (!assessment) throw new ApiError(404, "Gap assessment not found", undefined, "GAP_ASSESSMENT_NOT_FOUND");
  return assessment;
}
