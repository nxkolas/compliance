import * as z from "zod";
import { nis2OutcomeSchema } from "./rule-set-schema";

const evidenceBasisSchema = z.object({
  code: z.string().trim().min(1),
  legalProvisionKeys: z.array(z.string().trim().min(1)),
});

const evaluationBase = {
  outcome: nis2OutcomeSchema,
  reasonCodes: z.array(z.string().trim().min(1)),
  releaseVersion: z.string().trim().min(1),
  scopeModelVersion: z.string().trim().min(1),
  thresholdSetVersion: z.string().trim().min(1),
  profileVersionKey: z.string().trim().min(1).nullable(),
  jurisdiction: z.object({
    euActivity: z.enum(["yes", "no", "unsure"]),
    countryCode: z.string().trim().min(1).nullable(),
    basisCode: z.string().trim().min(1).nullable(),
  }),
  sizeClassification: z.enum(["small", "medium", "large", "unknown"]),
  matchedEntityTypes: z.array(z.object({
    code: z.string().trim().min(1),
    versionKey: z.string().trim().min(1),
    sectorCode: z.string().trim().min(1),
    annex: z.union([z.literal(1), z.literal(2)]).nullable(),
    legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
  })),
  scopeBases: z.array(evidenceBasisSchema),
  unresolvedFactCodes: z.array(z.string().trim().min(1)),
  obligationOverlays: z.array(evidenceBasisSchema),
  indirectExposure: z.object({
    status: z.enum(["none", "signals_present", "unknown"]),
    reasonCodes: z.array(z.string().trim().min(1)),
  }),
  decisiveFacts: z.record(z.string(), z.unknown()),
};

const v2EvaluationResultSchema = z.object({
  schemaVersion: z.literal(3),
  evaluatorKind: z.literal("nis2_scope_v2"),
  evaluatorVersion: z.literal(2),
  ...evaluationBase,
});

const v3EvaluationResultSchema = z.object({
  schemaVersion: z.literal(4),
  evaluatorKind: z.literal("nis2_scope_v3"),
  evaluatorVersion: z.literal(3),
  ...evaluationBase,
  selectedCatalogCode: z.string().trim().min(1).nullable(),
  matchedNationalEntityTypes: z.array(z.object({
    code: z.string().trim().min(1),
    versionKey: z.string().trim().min(1),
    statutoryCategoryCode: z.string().trim().min(1).nullable(),
    classificationRule: z.string().trim().min(1),
    legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
  })),
  nationalMappings: z.array(z.object({
    nationalEntityVersionKey: z.string().trim().min(1),
    euEntityCode: z.string().trim().min(1),
    relationship: z.enum(["exact", "subset", "aggregate", "overlap"]),
  })),
  appliedProfilePolicyCodes: z.array(z.string().trim().min(1)),
  appliedProfileLegalProvisionKeys: z.array(z.string().trim().min(1)),
  appliedJurisdictionRules: z.array(z.object({
    basisCode: z.string().trim().min(1),
    legalProvisionKey: z.string().trim().min(1),
    authorityDecisionRequired: z.boolean(),
  })),
  effectiveStateCodes: z.array(z.string().trim().min(1)),
  effectiveStateDeclarations: z.array(z.object({
    code: z.string().trim().min(1),
    value: z.string().trim().min(1),
    effectiveFrom: z.string().date(),
    reviewedAt: z.string().datetime(),
    officialSourceUrl: z.url(),
    legalProvisionKey: z.string().trim().min(1),
  })),
});

export const ruleEvaluationResultSchema = z.discriminatedUnion("evaluatorKind", [
  v2EvaluationResultSchema,
  v3EvaluationResultSchema,
]);

const storedFieldsSchema = z.object({
  checkReleaseId: z.uuid(),
  ruleSetId: z.uuid(),
  inputHash: z.string().length(64),
  evaluatedAt: z.string().datetime(),
  assessmentRevisionId: z.uuid().optional(),
  assessmentRevisionNumber: z.number().int().positive().optional(),
});

export const storedRuleEvaluationResultSchema = z.intersection(
  ruleEvaluationResultSchema,
  storedFieldsSchema,
);

export type RuleEvaluationResult = z.infer<typeof ruleEvaluationResultSchema>;
export type StoredRuleEvaluationResult = z.infer<typeof storedRuleEvaluationResultSchema>;

export function parseStoredRuleEvaluationResult(value: unknown): StoredRuleEvaluationResult {
  const result = storedRuleEvaluationResultSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "result"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid stored NIS2 scope result: ${details}`);
  }
  return result.data;
}
