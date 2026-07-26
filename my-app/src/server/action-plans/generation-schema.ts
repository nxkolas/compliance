import * as z from "zod";
import type { AtomicGapKind } from "../gap-analysis/domain";
import { validateGeneratedAction } from "./action-style";

export type ActionPlanCategoryPolicy = {
  requirementCode: string;
  sourceFindingId: string;
  priority: "low" | "medium" | "high" | "critical";
  outputLocale: "de" | "en";
  gaps: Array<{ key: string; kind: AtomicGapKind }>;
  permittedCitationIds: string[];
};

export type ActionPlanModelResponse = {
  categories: Record<
    string,
    {
      actions: Array<{
        title: string;
        result: string;
        suggestedEvidence: string[];
        gapKeys: string[];
        citations: string[];
      }>;
    }
  >;
};

export type ValidatedActionPlanContent = {
  categories: Array<{
    requirementCode: string;
    sourceFindingId: string;
    actions: Array<{
      title: string;
      result: string;
      suggestedEvidence: string[];
      priority: "low" | "medium" | "high" | "critical";
      position: number;
      gapKeys: string[];
      citationIds: string[];
    }>;
  }>;
};

const nonblank = z.string().trim().min(1);

export function buildActionPlanResponseSchema(
  policies: ActionPlanCategoryPolicy[],
): z.ZodType<ActionPlanModelResponse> {
  if (policies.length === 0) {
    throw new Error("At least one Action Plan category policy is required");
  }
  const categories = Object.fromEntries(
    policies.map((policy) => {
      const gapKeys = policy.gaps.map((gap) => gap.key);
      const citationIds = [...new Set(policy.permittedCitationIds)];
      if (citationIds.length === 0) {
        throw new Error(
          `Category ${policy.requirementCode} has no admitted citations`,
        );
      }
      const hasUncertainGap = policy.gaps.some(
        (gap) => gap.kind === "uncertain",
      );
      const citation = z.enum(citationIds as [string, ...string[]]);
      const operationalProse =
        "Use clear, correctly spelled operational prose in the pinned locale. Do not mention NIS2, BSI law, statutes, legal obligations, regulatory requirements, articles, or other legal analysis.";
      const actionSchema = z
        .object({
          title: hasUncertainGap
            ? nonblank.describe(
                `For uncertain gaps, use a verification-first imperative title. In German, a title ending in prüfen, klären, feststellen, ermitteln, or überprüfen is valid. ${operationalProse}`,
              )
            : nonblank.describe(
                `Use a short imperative title. ${operationalProse}`,
              ),
          result: hasUncertainGap
            ? nonblank.describe(
                `For uncertain gaps, describe the completed verification state first. Verification-only is valid. If remediation is included, condition it explicitly on an identified deficiency, for example "Nur bei festgestellten Mängeln ..." or "Falls eine Lücke festgestellt wird, ...". Vague conditions such as "falls nötig", "bei Bedarf", or "ggf." are invalid. ${operationalProse}`,
              )
            : nonblank.describe(
                `Describe the completed operational state in one or two sentences. ${operationalProse}`,
              ),
          suggestedEvidence: z
            .array(
              nonblank.describe(
                `Use a concrete, correctly spelled artifact name. ${operationalProse}`,
              ),
            )
            .min(1)
            .max(5),
          gapKeys: z.array(z.enum(gapKeys as [string, ...string[]])).min(1),
          citations: z.array(citation).min(1),
        })
        .strict()
        .superRefine((action, context) => {
          const gapKinds = action.gapKeys.map((key) => {
            const gap = policy.gaps.find((candidate) => candidate.key === key);
            if (!gap) throw new Error(`Unknown gap key ${key}`);
            return gap.kind;
          });
          try {
            validateGeneratedAction({
              title: action.title,
              result: action.result,
              suggestedEvidence: action.suggestedEvidence,
              locale: policy.outputLocale,
              gapKinds,
            });
          } catch (error) {
            context.addIssue({
              code: "custom",
              message:
                error instanceof Error
                  ? error.message
                  : "Generated action content is invalid",
            });
          }
        });
      const actions =
        gapKeys.length === 0
          ? z.array(z.never()).length(0)
          : z.array(actionSchema).min(1).max(10);
      return [
        policy.requirementCode,
        z
          .object({ actions })
          .strict()
          .superRefine((category, context) => {
            const covered = new Set(
              category.actions.flatMap((action) => action.gapKeys),
            );
            const missing = gapKeys.filter((key) => !covered.has(key));
            if (missing.length > 0) {
              context.addIssue({
                code: "custom",
                path: ["actions"],
                message: `Action coverage is missing gaps: ${missing.join(", ")}`,
              });
            }
          }),
      ];
    }),
  );
  return z
    .object({ categories: z.object(categories).strict() })
    .strict() as z.ZodType<ActionPlanModelResponse>;
}

export function normalizeActionPlanResponse(input: {
  value: ActionPlanModelResponse;
  policies: ActionPlanCategoryPolicy[];
}): ValidatedActionPlanContent {
  const value = buildActionPlanResponseSchema(input.policies).parse(
    input.value,
  );
  return {
    categories: input.policies.map((policy) => ({
      requirementCode: policy.requirementCode,
      sourceFindingId: policy.sourceFindingId,
      actions: value.categories[policy.requirementCode]!.actions.map(
        (action, index) => ({
          title: action.title,
          result: action.result,
          suggestedEvidence: action.suggestedEvidence,
          priority: policy.priority,
          position: index + 1,
          gapKeys: [...new Set(action.gapKeys)],
          citationIds: [...new Set(action.citations)],
        }),
      ),
    })),
  };
}
