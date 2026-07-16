import * as z from "zod";
import { nis2OutcomeSchema } from "./rule-set-schema";

const localizedReasonSchema = z.object({
  code: z.string().trim().min(1),
  description: z.string().trim().min(1),
  descriptionEn: z.string().trim().min(1),
  legalReference: z.string().trim().min(1).nullable(),
});

const matchedEntityTypeSchema = z.object({
  code: z.string().trim().min(1),
  sectorCode: z.string().trim().min(1),
  annex: z.union([z.literal(1), z.literal(2)]).nullable(),
  label: z.string().trim().min(1),
  labelEn: z.string().trim().min(1),
  legalReference: z.string().trim().min(1),
});

export const ruleEvaluationResultSchema = z.object({
  schemaVersion: z.literal(2),
  outcome: nis2OutcomeSchema,
  label: z.string().trim().min(1),
  labelEn: z.string().trim().min(1),
  reasons: z.array(z.string().trim().min(1)),
  reasonsEn: z.array(z.string().trim().min(1)),
  ruleSetVersion: z.number().int().positive(),
  profileVersion: z.string().trim().min(1),
  disclaimer: z.string().trim().min(1),
  disclaimerEn: z.string().trim().min(1),
  jurisdiction: z.object({
    euActivity: z.enum(["yes", "no", "unsure"]),
    countryCode: z.string().trim().min(1).nullable(),
    basis: z.string().trim().min(1).nullable(),
    countryProfileVersion: z.string().trim().min(1).nullable(),
  }),
  sizeClassification: z.enum(["small", "medium", "large", "unknown"]),
  matchedEntityTypes: z.array(matchedEntityTypeSchema),
  scopeBases: z.array(localizedReasonSchema),
  unresolvedFacts: z.array(z.string().trim().min(1)),
  unresolvedFactsEn: z.array(z.string().trim().min(1)),
  obligationOverlays: z.array(localizedReasonSchema),
  indirectExposure: z.object({
    status: z.enum(["none", "signals_present", "unknown"]),
    reasons: z.array(z.string().trim().min(1)),
    reasonsEn: z.array(z.string().trim().min(1)),
  }),
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
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "result";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid stored NIS2 scope result: ${details}`);
  }

  return result.data;
}
