import { db } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { requireOrganizationCapability } from "../auth/capability-service";
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
  await requireOrganizationCapability(userId, organizationId, "gap:read");
  const revision = await db.query.assessmentRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, revisionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!revision) throw new ApiError(404, "Gap questionnaire revision not found");
  return revision;
}
