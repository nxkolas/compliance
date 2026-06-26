import * as z from "zod";

export const ruleEvaluationResultSchema = z.object({
  outcome: z.string().trim().min(1),
  label: z.string(),
  labelEn: z.string().nullable(),
  reasons: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  matchedRuleIds: z.array(z.string()),
  ruleSetVersion: z.number(),
  disclaimer: z.string().nullable(),
});

export const storedRuleEvaluationResultSchema =
  ruleEvaluationResultSchema.extend({
    assessmentRevisionId: z.uuid().optional(),
    assessmentRevisionNumber: z.number().int().positive().optional(),
    generatedAt: z.string().datetime().optional(),
  });

export type RuleEvaluationResult = z.infer<typeof ruleEvaluationResultSchema>;
export type StoredRuleEvaluationResult = z.infer<
  typeof storedRuleEvaluationResultSchema
>;

export function parseStoredRuleEvaluationResult(
  value: unknown,
): StoredRuleEvaluationResult {
  const result = storedRuleEvaluationResultSchema.safeParse(value);

  if (!result.success) {
    throw new Error(formatRuleEvaluationError(result.error));
  }

  return result.data;
}

function formatRuleEvaluationError(error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "result";

      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Invalid stored rule evaluation result: ${details}`;
}
