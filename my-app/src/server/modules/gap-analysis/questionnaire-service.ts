import { and, eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { authorizeOrganizationRead } from "../../platform/auth/organization-scope";
import { finalizeGapCycleQuestionnaire } from "./analysis-cycle-service";

export async function submitGapQuestionnaire(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  draftId: string;
  expectedVersion?: number;
}) {
  return finalizeGapCycleQuestionnaire({
    userId: input.userId,
    organizationId: input.organizationId,
    cycleId: input.draftId,
    assessmentId: input.assessmentId,
  });
}

export async function getGapQuestionnaireRevision(
  userId: string,
  organizationId: string,
  revisionId: string,
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "gap:read" });
  const revision = await executor.query.assessmentRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, revisionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!revision) throw new ApiError(404, "Gap questionnaire revision not found");
  return revision;
}
