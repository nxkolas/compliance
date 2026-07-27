import * as z from "zod";
import {
  normalizeOneLine,
  normalizeUniqueStrings,
  GenerationContentValidationError,
  type NormalizationCode,
} from "../ai/generation";
import { validateGeneratedAction } from "./action-style";
import type {
  ActionPlanCategoryPolicy,
  ValidatedActionPlanContent,
} from "./generation-schema";

export type ActionPlanCategoryPolicyV2 = Omit<
  ActionPlanCategoryPolicy,
  "permittedCitationIds"
> & {
  admittedOrganizationCitationIds: string[];
  mandatoryCitationIdsByGapKey: Record<string, string[]>;
};

export type ActionPlanCategoryResponseV2 = {
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

const prose = z.string().trim().min(1);

export function buildActionPlanCategoryResponseSchemaV2(
  policy: ActionPlanCategoryPolicyV2,
): z.ZodType<ActionPlanCategoryResponseV2> {
  const confirmed = policy.gaps
    .filter((gap) => gap.kind !== "uncertain")
    .map((gap) => gap.key);
  const uncertain = policy.gaps
    .filter((gap) => gap.kind === "uncertain")
    .map((gap) => gap.key);
  const optionalCitations = policy.admittedOrganizationCitationIds.length
    ? z.array(
        z.enum(
          policy.admittedOrganizationCitationIds as [
            string,
            ...string[],
          ],
        ),
      )
    : z.array(z.string()).max(0);
  const common = {
    suggestedEvidence: z.array(prose.max(120)).min(1).max(5),
    supportingOrganizationCitationIds: optionalCitations,
  };
  const variants: z.ZodType[] = [];
  if (confirmed.length) {
    variants.push(
      z
        .object({
          mode: z.literal("remediation"),
          gapKeys: z
            .array(z.enum(confirmed as [string, ...string[]]))
            .min(1),
          title: prose.max(120),
          result: prose.max(320),
          ...common,
        })
        .strict(),
    );
  }
  if (uncertain.length) {
    variants.push(
      z
        .object({
          mode: z.literal("verification"),
          gapKeys: z
            .array(z.enum(uncertain as [string, ...string[]]))
            .min(1),
          verificationTitle: prose.max(120),
          verificationResult: prose
            .max(160)
            .describe(
              "Completed verification state, at most 20 words and 160 characters.",
            ),
          conditionalRemediation: prose
            .max(100)
            .describe(
              "Only the remediation content, at most 14 words and 100 characters; the server adds the condition.",
            )
            .nullable(),
          ...common,
        })
        .strict(),
    );
  }
  const action: z.ZodType<
    ActionPlanCategoryResponseV2["actions"][number]
  > =
    variants.length === 1
      ? (variants[0]! as z.ZodType<
          ActionPlanCategoryResponseV2["actions"][number]
        >)
      : z.union(
          variants as [z.ZodType<ActionPlanCategoryResponseV2["actions"][number]>, z.ZodType<ActionPlanCategoryResponseV2["actions"][number]>],
        );
  return z
    .object({ actions: z.array(action).min(1).max(10) })
    .strict() as z.ZodType<ActionPlanCategoryResponseV2>;
}

export function normalizeActionPlanCategoryResponseV2(input: {
  value: ActionPlanCategoryResponseV2;
  policy: ActionPlanCategoryPolicyV2;
}): {
  value: ValidatedActionPlanContent["categories"][number];
  normalizationCodes: NormalizationCode[];
} {
  const codes = new Set<NormalizationCode>();
  const normalized = {
    actions: input.value.actions.map((action) => {
      const title = normalizeOneLine(
        action.mode === "remediation"
          ? action.title
          : action.verificationTitle,
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
      [...title.codes, ...result.codes, ...evidence.codes, ...optional.codes]
        .forEach((code) => codes.add(code));
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
  } as ActionPlanCategoryResponseV2;
  const parsed = buildActionPlanCategoryResponseSchemaV2(input.policy).parse(
    normalized,
  );
  const covered = new Set(parsed.actions.flatMap((action) => action.gapKeys));
  if (input.policy.gaps.some((gap) => !covered.has(gap.key))) {
    throw new Error("Gap coverage is incomplete");
  }
  const actions = parsed.actions.map((action, index) => {
    const title =
      action.mode === "remediation" ? action.title : action.verificationTitle;
    const verificationResult =
      action.mode === "remediation" ? action.result : action.verificationResult;
    if (
      input.policy.requirementCode !== "NIS2-BC-05" &&
      /\b(?:backup\w*|restor\w*|datensicher\w*|wiederherstell\w*)\b/iu.test(
        `${title} ${verificationResult}`,
      )
    ) {
      throw new GenerationContentValidationError([
        { code: "action_example_leakage", path: ["actions", index] },
      ]);
    }
    if (
      action.mode === "verification" &&
      !isCompletedVerificationResult(
        action.verificationResult,
        input.policy.outputLocale,
      )
    ) {
      throw new GenerationContentValidationError([
        {
          code: "action_verification_result_state",
          path: ["actions", index, "verificationResult"],
        },
      ]);
    }
    const conditional =
      action.mode === "verification" && action.conditionalRemediation
        ? renderConditionalRemediation(
            action.conditionalRemediation,
            input.policy.outputLocale,
          )
        : null;
    const result = conditional
      ? `${verificationResult} ${conditional}`
      : verificationResult;
    try {
      validateGeneratedAction({
        title,
        result,
        suggestedEvidence: action.suggestedEvidence,
        locale: input.policy.outputLocale,
        gapKinds: [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      throw new GenerationContentValidationError([
        {
          code: actionValidationIssueCode(message),
          path: ["actions", index],
        },
      ]);
    }
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

function isCompletedVerificationResult(value: string, locale: "de" | "en") {
  return locale === "de"
    ? /\b(?:dokumentiert|bewertet|beurteilt|geprüft|festgestellt|ermittelt|verifiziert|protokolliert|nachgewiesen)\b/iu.test(
        value,
      )
    : /\b(?:assessed|documented|determined|evaluated|reviewed|verified|recorded|established)\b/iu.test(
        value,
      );
}

function actionValidationIssueCode(message: string) {
  if (message.includes("must not be blank")) return "action_blank" as const;
  if (message.includes("exactly one line")) return "action_multiline" as const;
  if (
    message.includes("Action title must contain at most") ||
    message.includes("Action title exceeds")
  ) {
    return "action_title_length" as const;
  }
  if (
    message.includes("Action result must contain at most 40 words") ||
    message.includes("Action result exceeds")
  ) {
    return "action_result_length" as const;
  }
  if (message.includes("Action result must contain one or two sentences")) {
    return "action_result_sentences" as const;
  }
  if (message.includes("one to five evidence items")) {
    return "action_evidence_count" as const;
  }
  if (
    message.includes("Recommended evidence must contain at most") ||
    message.includes("Recommended evidence exceeds")
  ) {
    return "action_evidence_length" as const;
  }
  if (message.includes("raw identifier")) {
    return "action_raw_identifier" as const;
  }
  if (message.includes("forbidden label")) {
    return "action_forbidden_label" as const;
  }
  if (message.includes("legal analysis")) {
    return "action_legal_analysis" as const;
  }
  return "action_content_invalid" as const;
}
