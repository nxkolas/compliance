import * as z from "zod";
import {
  GenerationContentValidationError,
  normalizeOneLine,
  normalizeUniqueStrings,
  type NormalizationCode,
} from "../ai/generation";
import type { AtomicGapKind } from "../gap-analysis/domain";

export type ActionPlanCategoryPolicy = {
  requirementCode: string;
  sourceFindingId: string;
  priority: "low" | "medium" | "high" | "critical";
  outputLocale: "de" | "en";
  gaps: Array<{ key: string; kind: AtomicGapKind }>;
  admittedOrganizationCitationIds: string[];
  mandatoryCitationIdsByGapKey: Record<string, string[]>;
};

export type ActionPlanCategoryResponse = {
  actions: Array<
    | {
        mode: "remediation";
        gapKeys: string[];
        title: string;
        result: string;
        suggestedEvidence: string[];
        supportingOrganizationCitationIds: string[];
      }
    | {
        mode: "verification";
        gapKeys: string[];
        verificationTitle: string;
        verificationResult: string;
        conditionalRemediation: string | null;
        suggestedEvidence: string[];
        supportingOrganizationCitationIds: string[];
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

const prose = z.string().trim().min(1);

export function buildActionPlanCategoryResponseSchema(
  policy: ActionPlanCategoryPolicy,
): z.ZodType<ActionPlanCategoryResponse> {
  const confirmed = policy.gaps
    .filter((gap) => gap.kind !== "uncertain")
    .map((gap) => gap.key);
  const uncertain = policy.gaps
    .filter((gap) => gap.kind === "uncertain")
    .map((gap) => gap.key);
  const optionalCitations =
    policy.admittedOrganizationCitationIds.length > 0
      ? z.array(
          z.enum(
            policy.admittedOrganizationCitationIds as [string, ...string[]],
          ),
        )
      : z.array(z.string()).max(0);
  const common = {
    suggestedEvidence: z.array(prose.max(240)).min(1).max(5),
    supportingOrganizationCitationIds: optionalCitations,
  };
  const variants: z.ZodType[] = [];
  if (confirmed.length > 0) {
    variants.push(
      z
        .object({
          mode: z.literal("remediation"),
          gapKeys: z.array(z.enum(confirmed as [string, ...string[]])).min(1),
          title: prose.max(240),
          result: prose.max(1_000),
          ...common,
        })
        .strict(),
    );
  }
  if (uncertain.length > 0) {
    variants.push(
      z
        .object({
          mode: z.literal("verification"),
          gapKeys: z.array(z.enum(uncertain as [string, ...string[]])).min(1),
          verificationTitle: prose.max(240),
          verificationResult: prose.max(1_000),
          conditionalRemediation: prose.max(500).nullable(),
          ...common,
        })
        .strict(),
    );
  }
  const action: z.ZodType<ActionPlanCategoryResponse["actions"][number]> =
    variants.length === 1
      ? (variants[0]! as z.ZodType<
          ActionPlanCategoryResponse["actions"][number]
        >)
      : z.union(
          variants as [
            z.ZodType<ActionPlanCategoryResponse["actions"][number]>,
            z.ZodType<ActionPlanCategoryResponse["actions"][number]>,
          ],
        );
  return z
    .object({ actions: z.array(action).min(1).max(10) })
    .strict() as z.ZodType<ActionPlanCategoryResponse>;
}

export function normalizeActionPlanCategoryResponse(input: {
  value: ActionPlanCategoryResponse;
  policy: ActionPlanCategoryPolicy;
}): {
  value: ValidatedActionPlanContent["categories"][number];
  normalizationCodes: NormalizationCode[];
} {
  const codes = new Set<NormalizationCode>();
  const normalized = {
    actions: input.value.actions.map((action) => {
      const title = normalizeOneLine(
        action.mode === "remediation" ? action.title : action.verificationTitle,
      );
      const result = normalizeOneLine(
        action.mode === "remediation"
          ? action.result
          : action.verificationResult,
        { finalPeriod: true },
      );
      const evidence = normalizeUniqueStrings(
        action.suggestedEvidence,
        input.policy.outputLocale,
      );
      const optional = normalizeUniqueStrings(
        action.supportingOrganizationCitationIds,
        input.policy.outputLocale,
      );
      [
        ...title.codes,
        ...result.codes,
        ...evidence.codes,
        ...optional.codes,
      ].forEach((code) => codes.add(code));
      return action.mode === "remediation"
        ? {
            ...action,
            title: title.value,
            result: result.value,
            suggestedEvidence: evidence.value,
            supportingOrganizationCitationIds: optional.value,
          }
        : {
            ...action,
            verificationTitle: title.value,
            verificationResult: result.value,
            conditionalRemediation: action.conditionalRemediation
              ? normalizeOneLine(action.conditionalRemediation).value
              : null,
            suggestedEvidence: evidence.value,
            supportingOrganizationCitationIds: optional.value,
          };
    }),
  } as ActionPlanCategoryResponse;
  const parsed = buildActionPlanCategoryResponseSchema(input.policy).parse(
    normalized,
  );
  const covered = new Set(parsed.actions.flatMap((action) => action.gapKeys));
  if (input.policy.gaps.some((gap) => !covered.has(gap.key))) {
    throw new GenerationContentValidationError([
      { code: "coverage_incomplete", path: ["actions"] },
    ]);
  }
  const actions = parsed.actions.map((action, index) => {
    const title =
      action.mode === "remediation" ? action.title : action.verificationTitle;
    const baseResult =
      action.mode === "remediation" ? action.result : action.verificationResult;
    const conditional =
      action.mode === "verification" && action.conditionalRemediation
        ? renderConditionalRemediation(
            action.conditionalRemediation,
            input.policy.outputLocale,
          )
        : null;
    const result = conditional ? `${baseResult} ${conditional}` : baseResult;
    assertSafeProse(title, ["actions", index, "title"]);
    assertSafeProse(result, ["actions", index, "result"]);
    action.suggestedEvidence.forEach((value, evidenceIndex) =>
      assertSafeProse(value, [
        "actions",
        index,
        "suggestedEvidence",
        evidenceIndex,
      ]),
    );
    return {
      title,
      result,
      suggestedEvidence: action.suggestedEvidence,
      priority: input.policy.priority,
      position: index + 1,
      gapKeys: [...new Set(action.gapKeys)],
      citationIds: [
        ...new Set([
          ...action.gapKeys.flatMap(
            (key) => input.policy.mandatoryCitationIdsByGapKey[key] ?? [],
          ),
          ...action.supportingOrganizationCitationIds,
        ]),
      ],
    };
  });
  return {
    value: {
      requirementCode: input.policy.requirementCode,
      sourceFindingId: input.policy.sourceFindingId,
      actions,
    },
    normalizationCodes: [...codes],
  };
}

export function renderConditionalRemediation(
  content: string,
  locale: "de" | "en",
) {
  const normalized = normalizeOneLine(content, { finalPeriod: true }).value;
  return locale === "de"
    ? `Falls die Prüfung einen Mangel ergibt, ${normalized}`
    : `If verification identifies a deficiency, ${lowercaseFirst(normalized)}`;
}

function lowercaseFirst(value: string) {
  return value ? value[0]!.toLocaleLowerCase() + value.slice(1) : value;
}

function assertSafeProse(value: string, path: Array<string | number>) {
  if (
    /\b(?:https?:\/\/|www\.)\S+/iu.test(value) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu.test(
      value,
    )
  ) {
    throw new GenerationContentValidationError([
      { code: "action_raw_identifier", path },
    ]);
  }
}
