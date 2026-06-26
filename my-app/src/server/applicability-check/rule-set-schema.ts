import * as z from "zod";

const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "in",
  "not_in",
  "exists",
  "missing",
]);

const outcomeLabelSchema = z.object({
  label: z.string().trim().min(1),
  labelEn: z.string().trim().min(1).optional(),
});

export type RuleOutcome = string;

export type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | {
      factKey?: string;
      questionStableKey?: string;
      operator: z.infer<typeof conditionOperatorSchema>;
      value?: unknown;
      values?: unknown[];
    };

export type FieldRuleCondition = Extract<RuleCondition, { operator: string }>;

export const ruleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ruleConditionSchema).min(1) }),
    z.object({ any: z.array(ruleConditionSchema).min(1) }),
    z.object({ not: ruleConditionSchema }),
    z
      .object({
        factKey: z.string().trim().min(1).optional(),
        questionStableKey: z.string().trim().min(1).optional(),
        operator: conditionOperatorSchema,
        value: z.unknown().optional(),
        values: z.array(z.unknown()).optional(),
      })
      .superRefine((condition, context) => {
        if (!condition.factKey && !condition.questionStableKey) {
          context.addIssue({
            code: "custom",
            message: "Condition needs factKey or questionStableKey",
            path: ["factKey"],
          });
        }

        if (
          (condition.operator === "in" || condition.operator === "not_in") &&
          !condition.values
        ) {
          context.addIssue({
            code: "custom",
            message: `${condition.operator} conditions need values`,
            path: ["values"],
          });
        }
      }),
  ]),
);

export const ruleDocumentSchema = z.object({
  id: z.string().trim().min(1),
  outcome: z.string().trim().min(1),
  priority: z.number(),
  conditions: ruleConditionSchema,
  reasons: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const ruleSetDocumentSchema = z
  .object({
    version: z.number(),
    defaultOutcome: z.string().trim().min(1),
    disclaimer: z.string().optional(),
    outcomes: z.record(z.string().trim().min(1), outcomeLabelSchema),
    rules: z.array(ruleDocumentSchema),
  })
  .superRefine((ruleSet, context) => {
    const definedOutcomes = new Set(Object.keys(ruleSet.outcomes));

    if (definedOutcomes.size === 0) {
      context.addIssue({
        code: "custom",
        message: "Rule set must define at least one outcome",
        path: ["outcomes"],
      });
      return;
    }

    if (!definedOutcomes.has(ruleSet.defaultOutcome)) {
      context.addIssue({
        code: "custom",
        message: `defaultOutcome must reference a defined outcome`,
        path: ["defaultOutcome"],
      });
    }

    ruleSet.rules.forEach((rule, index) => {
      if (!definedOutcomes.has(rule.outcome)) {
        context.addIssue({
          code: "custom",
          message: `Rule outcome must reference a defined outcome`,
          path: ["rules", index, "outcome"],
        });
      }
    });
  });

export type RuleDocument = z.infer<typeof ruleDocumentSchema>;
export type RuleSetDocument = z.infer<typeof ruleSetDocumentSchema>;

export function parseRuleSetDocument(value: unknown): RuleSetDocument {
  const result = ruleSetDocumentSchema.safeParse(value);

  if (!result.success) {
    throw new Error(formatRuleSetError(result.error));
  }

  return result.data;
}

function formatRuleSetError(error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "ruleSet";

      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Invalid rule set document: ${details}`;
}
