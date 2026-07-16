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
  sectorCode: z.string().trim().min(1),
  annex: z.union([z.literal(1), z.literal(2)]).nullable(),
  label: z.string().trim().min(1),
  labelEn: z.string().trim().min(1),
  description: z.string().trim().min(1),
  descriptionEn: z.string().trim().min(1),
  legalReference: z.string().trim().min(1),
  rule: nis2EntityRuleSchema.default("standard"),
});

const outcomeLabelSchema = z.object({
  label: z.string().trim().min(1),
  labelEn: z.string().trim().min(1),
});

const countryProfileSchema = z.object({
  countryCode: z.string().length(2),
  version: z.string().trim().min(1),
  supported: z.boolean(),
  allowNegativeConclusion: z.boolean(),
  legalReferences: z.array(z.string().trim().min(1)).min(1),
});

export const nis2ScopeRuleSetDocumentSchema = z
  .object({
    kind: z.literal("nis2_scope_v2"),
    version: z.number().int().positive(),
    profileVersion: z.string().trim().min(1),
    disclaimer: z.string().trim().min(1),
    disclaimerEn: z.string().trim().min(1),
    outcomes: z.object({
      essential_entity: outcomeLabelSchema,
      important_entity: outcomeLabelSchema,
      not_directly_in_scope: outcomeLabelSchema,
      clarification_required: outcomeLabelSchema,
    }),
    entityTypes: z.array(nis2EntityTypeSchema).min(1),
    countryProfiles: z.record(z.string().length(2), countryProfileSchema),
  })
  .superRefine((document, context) => {
    const codes = new Set<string>();

    document.entityTypes.forEach((entityType, index) => {
      if (codes.has(entityType.code)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate entity type code ${entityType.code}`,
          path: ["entityTypes", index, "code"],
        });
      }
      codes.add(entityType.code);

      if (
        entityType.annex === null &&
        entityType.rule !== "domain_registration"
      ) {
        context.addIssue({
          code: "custom",
          message: "Only domain-registration entries may omit an annex",
          path: ["entityTypes", index, "annex"],
        });
      }
    });

    for (const [countryCode, profile] of Object.entries(
      document.countryProfiles,
    )) {
      if (countryCode !== profile.countryCode) {
        context.addIssue({
          code: "custom",
          message: "Country-profile key must match countryCode",
          path: ["countryProfiles", countryCode, "countryCode"],
        });
      }
    }
  });

export type Nis2Outcome = z.infer<typeof nis2OutcomeSchema>;
export type Nis2EntityRule = z.infer<typeof nis2EntityRuleSchema>;
export type Nis2EntityType = z.infer<typeof nis2EntityTypeSchema>;
export type Nis2ScopeRuleSetDocument = z.infer<
  typeof nis2ScopeRuleSetDocumentSchema
>;

export function parseRuleSetDocument(
  value: unknown,
): Nis2ScopeRuleSetDocument {
  const result = nis2ScopeRuleSetDocumentSchema.safeParse(value);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "ruleSet";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid NIS2 scope rule set: ${details}`);
  }

  return result.data;
}
