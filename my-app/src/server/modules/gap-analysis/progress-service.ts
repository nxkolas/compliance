import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "./release/current";
import { and, eq } from "drizzle-orm";
import { authorizeOrganizationRead } from "../../platform/auth/organization-scope";

export async function getGapQuestionnaireProgress(
  userId: string,
  organizationId: string,
) {
  const scope = await authorizeOrganizationRead({
    actorUserId: userId,
    organizationId,
    capability: "gap:read",
  });
  const definition = getCurrentGapDefinition("de");
  const cycle = await scope.executor.query.gapAnalysisCycles.findFirst({
    columns: { id: true, draftAnswers: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.definitionHash, currentGapDefinitionHash),
        ) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  const answers = cycle?.draftAnswers ?? {};
  const questions = definition.questions.map((question) => ({
    questionKey: question.stableKey,
    required: question.required,
    answered: question.options.some(
      (option) => option.stableValue === answers[question.stableKey],
    ),
  }));
  const required = questions.filter((question) => question.required);
  const answeredRequired = required.filter((question) => question.answered).length;

  return {
    draftId: cycle?.id ?? null,
    answeredRequired,
    totalRequired: required.length,
    complete: answeredRequired === required.length,
    questions,
  };
}
