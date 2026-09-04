import * as z from "zod";

export const nis2OutcomeSchema = z.enum([
  "essential_entity",
  "important_entity",
  "not_directly_in_scope",
  "clarification_required",
]);

export const nis2EntityRuleSchema = z.enum([
  "standard",
  "always_essential",
  "always_important",
  "telecom",
  "central_public_administration",
  "regional_public_administration",
  "domain_registration",
]);

export const nis2EntityTypeSchema = z.object({
  code: z.string().trim().min(1),
  versionKey: z.string().trim().min(1),
  sectorCode: z.string().trim().min(1),
  annex: z.union([z.literal(1), z.literal(2)]).nullable(),
  legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
  rule: nis2EntityRuleSchema.default("standard"),
});

const countryProfileBaseSchema = z.object({
  countryCode: z.string().length(2),
  versionKey: z.string().trim().min(1),
  supported: z.boolean(),
  allowNegativeConclusion: z.boolean(),
  legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
});

const countryProfileV2Schema = countryProfileBaseSchema.extend({
  entityOverrides: z.record(z.string(), z.object({
    ruleKind: z.string().trim().min(1),
    legalProvisionKey: z.string().trim().min(1),
  })),
});

const thresholdSchema = z.object({
  mediumEmployeeThreshold: z.number().int().positive(),
  mediumTurnoverThreshold: z.number().positive(),
  mediumBalanceSheetThreshold: z.number().positive(),
  largeEmployeeThreshold: z.number().int().positive(),
  largeTurnoverThreshold: z.number().positive(),
  largeBalanceSheetThreshold: z.number().positive(),
  employeeComparison: z.literal("at_least"),
  financialComparison: z.literal("both_above"),
  buckets: z.object({
    employees: z.object({ medium: z.string(), large: z.string() }),
    turnover: z.object({ medium: z.array(z.string()), large: z.string() }),
    balanceSheet: z.object({ medium: z.array(z.string()), large: z.string() }),
  }),
});

const documentBase = {
  releaseVersion: z.string().trim().min(1),
  scopeModelVersion: z.string().trim().min(1),
  thresholdSetVersion: z.string().trim().min(1),
  disclaimerContentKey: z.string().trim().min(1),
  outcomeContentKeys: z.record(nis2OutcomeSchema, z.string().trim().min(1)),
  reasonContentKeys: z.record(z.string(), z.string().trim().min(1)),
  thresholds: thresholdSchema,
  entityTypes: z.array(nis2EntityTypeSchema).length(70),
};

const nationalMappingSchema = z.object({
  euEntityCode: z.string().trim().min(1),
  relationship: z.enum(["exact", "subset", "aggregate", "overlap"]),
});

const nationalEntityTypeSchema = z.object({
  code: z.string().trim().min(1),
  versionKey: z.string().trim().min(1),
  statutoryCategoryCode: z.string().trim().min(1).nullable(),
  annex: z.union([z.literal(1), z.literal(2)]).nullable(),
  classificationRule: z.enum(["annex_1_standard", "annex_2_standard", "always_particularly_important", "always_important", "telecom", "federal_administration", "domain_registration_obligations", "requires_land_law"]),
  legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
  mappings: z.array(nationalMappingSchema),
});

const countryProfileV3Schema = countryProfileBaseSchema.extend({
  entityCatalog: z.array(nationalEntityTypeSchema).min(1),
  unmappedEuEntityCodes: z.array(z.string().trim().min(1)),
  thresholdPolicy: z.object({
    employeeMeasure: z.literal("annual_work_units"),
    publicBodyRule: z.literal("exclude_recommendation_annex_article_3_4"),
    aggregationRule: z.literal("recommendation_articles_3_to_6_with_de_it_independence_exception"),
    negligibleActivityRule: z.literal("may_disregard"),
    legalProvisionKeys: z.array(z.string().trim().min(1)).min(1),
  }),
  jurisdictionRules: z.array(z.object({
    basisCode: z.string().trim().min(1),
    entityCodes: z.array(z.string().trim().min(1)).min(1),
    legalProvisionKey: z.string().trim().min(1),
    authorityDecisionRequired: z.boolean().optional(),
  })),
  effectiveStates: z.array(z.object({
    code: z.string().trim().min(1),
    value: z.string().trim().min(1),
    effectiveFrom: z.string().date(),
    effectiveTo: z.string().date().optional(),
    reviewedAt: z.string().datetime(),
    officialSourceUrl: z.url(),
    legalProvisionKey: z.string().trim().min(1),
  })).min(1),
});
type CountryProfileV3 = z.infer<typeof countryProfileV3Schema>;

const nis2ScopeV2DocumentSchema = z.object({
    kind: z.literal("nis2_scope_v2"),
    evaluatorSchemaVersion: z.literal(2),
    ...documentBase,
    countryProfiles: z.record(z.string().length(2), countryProfileV2Schema),
});

const nis2ScopeV3DocumentSchema = z.object({
  kind: z.literal("nis2_scope_v3"),
  evaluatorSchemaVersion: z.literal(3),
  ...documentBase,
  countryProfiles: z.record(z.string().length(2), countryProfileV3Schema),
});

export const nis2ScopeRuleSetDocumentSchema = z
  .discriminatedUnion("kind", [nis2ScopeV2DocumentSchema, nis2ScopeV3DocumentSchema])
  .superRefine((document, context) => {
    const codes = new Set<string>();
    document.entityTypes.forEach((entityType, index) => {
      if (codes.has(entityType.code)) {
        context.addIssue({ code: "custom", message: `Duplicate entity type code ${entityType.code}`, path: ["entityTypes", index, "code"] });
      }
      codes.add(entityType.code);
      if (entityType.annex === null && entityType.rule !== "domain_registration") {
        context.addIssue({ code: "custom", message: "Only domain-registration entries may omit an annex", path: ["entityTypes", index, "annex"] });
      }
    });
    for (const [countryCode, profile] of Object.entries(document.countryProfiles)) {
      if (countryCode !== profile.countryCode) {
        context.addIssue({ code: "custom", message: "Country-profile key must match countryCode", path: ["countryProfiles", countryCode, "countryCode"] });
      }
      if (document.kind === "nis2_scope_v3") {
        const nationalProfile = profile as CountryProfileV3;
        const nationalCodes = new Set<string>();
        nationalProfile.entityCatalog.forEach((entity, index) => {
          if (nationalCodes.has(entity.code)) {
            context.addIssue({ code: "custom", message: `Duplicate national entity type code ${entity.code}`, path: ["countryProfiles", countryCode, "entityCatalog", index, "code"] });
          }
          nationalCodes.add(entity.code);
        });
      }
    }
  });

export type Nis2Outcome = z.infer<typeof nis2OutcomeSchema>;
export type Nis2EntityRule = z.infer<typeof nis2EntityRuleSchema>;
export type Nis2EntityType = z.infer<typeof nis2EntityTypeSchema>;
export type Nis2NationalEntityType = z.infer<typeof nationalEntityTypeSchema>;
export type Nis2ScopeRuleSetDocument = z.infer<typeof nis2ScopeRuleSetDocumentSchema>;

export function parseRuleSetDocument(value: unknown): Nis2ScopeRuleSetDocument {
  const result = nis2ScopeRuleSetDocumentSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "ruleSet"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid NIS2 scope rule set: ${details}`);
  }
  return result.data;
}
