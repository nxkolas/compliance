import * as z from "zod";
import { contentHash } from "@/src/server/compliance/domain";
import {
  normalizeOneLine,
  normalizeUniqueStrings,
  GenerationContentValidationError,
  type NormalizationCode,
} from "../ai/generation";
import { validateAtomicGapStatement } from "./gap-style";
import type {
  AtomicGapKind,
  GapStatementBasis,
  ValidatedCategoryGapResult,
} from "./generation-schema-v7";

export type GapResponsePolicyV8 = {
  requirementCode: string;
  outputLocale: "de" | "en";
  statementBasis: GapStatementBasis;
  statementMaximumByQuestion?: Record<string, number>;
  admittedOrganizationCitationIds: string[];
  questionnaireCitationIdsByQuestion: Record<string, string>;
  preferredPrimaryLegalCitationId: string;
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
};

export type GapCategoryResponseV8 = {
  gaps: Record<
    string,
    Array<{
      statement: string;
      supportingOrganizationCitationIds: string[];
    }>
  >;
  evidenceSufficiency: "sufficient" | "partial" | "none";
  reviewNotice: string | null;
  assumptions: string[];
  contradictions: string[];
  requiresReview: boolean;
};

const nonblank = z.string().trim().min(1);

export function buildGapCategoryResponseSchemaV8(
  policy: GapResponsePolicyV8,
): z.ZodType<GapCategoryResponseV8> {
  const organizationCitations =
    policy.admittedOrganizationCitationIds.length
      ? z.array(
          z.enum(
            policy.admittedOrganizationCitationIds as [
              string,
              ...string[],
            ],
          ),
        )
      : z.array(z.string()).max(0);
  const gaps = Object.fromEntries(
    policy.statementBasis.triggeringQuestions.map((trigger) => {
      const maximum = policy.statementMaximumByQuestion?.[trigger.stableKey] ?? 1;
      return [
        trigger.stableKey,
        z
          .array(
            z
              .object({
                statement: z
                  .string()
                  .trim()
                  .min(1)
                  .max(240)
                  .describe(
                    gapStatementDescription(
                      trigger.kind,
                      policy.outputLocale,
                    ),
                  ),
                supportingOrganizationCitationIds:
                  organizationCitations,
              })
              .strict(),
          )
          .min(1)
          .max(maximum),
      ];
    }),
  );
  return z
    .object({
      gaps: z.object(gaps).strict(),
      evidenceSufficiency: policy.forcedEvidenceSufficiency
        ? z.literal(policy.forcedEvidenceSufficiency)
        : policy.admittedOrganizationCitationIds.length
          ? z.enum(["sufficient", "partial", "none"])
          : z.literal("none"),
      reviewNotice: nonblank.max(320).nullable(),
      assumptions: z.array(nonblank.max(320)).max(10),
      contradictions: z.array(nonblank.max(320)).max(10),
      requiresReview:
        policy.forcedRequiresReview === undefined
          ? z.boolean()
          : z.literal(policy.forcedRequiresReview),
    })
    .strict() as z.ZodType<GapCategoryResponseV8>;
}

export function normalizeGapCategoryResponseV8(input: {
  value: GapCategoryResponseV8;
  policy: GapResponsePolicyV8;
}): { value: ValidatedCategoryGapResult; normalizationCodes: NormalizationCode[] } {
  const codes = new Set<NormalizationCode>();
  const normalized: GapCategoryResponseV8 = {
    ...input.value,
    gaps: Object.fromEntries(
      Object.entries(input.value.gaps).map(([key, gaps]) => [
        key,
        gaps.map((gap) => {
          const statement = normalizeOneLine(gap.statement, {
            finalPeriod: true,
          });
          const citations = normalizeUniqueStrings(
            gap.supportingOrganizationCitationIds,
            input.policy.outputLocale,
          );
          statement.codes.forEach((code) => codes.add(code));
          citations.codes.forEach((code) => codes.add(code));
          return {
            statement: statement.value,
            supportingOrganizationCitationIds: citations.value,
          };
        }),
      ]),
    ),
    reviewNotice: input.value.reviewNotice
      ? normalizeOneLine(input.value.reviewNotice).value
      : null,
    assumptions: normalizeUniqueStrings(
      input.value.assumptions,
      input.policy.outputLocale,
    ).value,
    contradictions: normalizeUniqueStrings(
      input.value.contradictions,
      input.policy.outputLocale,
    ).value,
  };
  const parsed = buildGapCategoryResponseSchemaV8(input.policy).parse(normalized);
  if (parsed.requiresReview !== Boolean(parsed.reviewNotice)) {
    throw new GenerationContentValidationError([
      { code: "review_notice_state", path: ["requiresReview"] },
      { code: "review_notice_state", path: ["reviewNotice"] },
    ]);
  }
  if (
    parsed.contradictions.length > 0 &&
    !parsed.requiresReview &&
    input.policy.forcedRequiresReview !== false
  ) {
    throw new GenerationContentValidationError([
      {
        code: "contradiction_review_required",
        path: ["contradictions"],
      },
      {
        code: "contradiction_review_required",
        path: ["requiresReview"],
      },
    ]);
  }
  for (const trigger of input.policy.statementBasis.triggeringQuestions) {
    for (const [index, gap] of (
      parsed.gaps[trigger.stableKey] ?? []
    ).entries()) {
      try {
        validateAtomicGapStatement({
          statement: gap.statement,
          kind: trigger.kind,
          locale: input.policy.outputLocale,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const evidentiaryPreamble = message.includes(
          "evidentiary preamble",
        );
        throw new GenerationContentValidationError([
          {
            code:
              /gap must use|uncertain gap must/u.test(message) ||
              (evidentiaryPreamble && trigger.kind !== "uncertain")
              ? "gap_kind_mismatch"
              : "gap_statement_style",
            path: ["gaps", trigger.stableKey, index, "statement"],
          },
        ]);
      }
    }
  }
  const allOptional = Object.values(parsed.gaps).flatMap((gaps) =>
    gaps.flatMap((gap) => gap.supportingOrganizationCitationIds),
  );
  const gaps = input.policy.statementBasis.triggeringQuestions.flatMap(
    (trigger) =>
      parsed.gaps[trigger.stableKey]!.map((gap) => ({
        questionStableKey: trigger.stableKey,
        sourceAssessmentAnswerId: trigger.sourceAssessmentAnswerId,
        kind: trigger.kind,
        statement: gap.statement,
        citationIds: [
          input.policy.questionnaireCitationIdsByQuestion[trigger.stableKey]!,
          ...gap.supportingOrganizationCitationIds,
        ],
      })),
  );
  return {
    value: {
      requirementCode: input.policy.requirementCode,
      statementBasis: input.policy.statementBasis,
      statementBasisHash: contentHash(input.policy.statementBasis),
      evidenceSufficiency: parsed.evidenceSufficiency,
      gaps,
      reviewNotice: parsed.reviewNotice,
      assumptions: parsed.assumptions,
      citationIds: [
        input.policy.preferredPrimaryLegalCitationId,
        ...new Set(allOptional),
      ],
      contradictions: parsed.contradictions,
      requiresReview: parsed.requiresReview,
      legalCitationId: input.policy.preferredPrimaryLegalCitationId,
    },
    normalizationCodes: [...codes],
  };
}

export function defaultGapStatementMaximum(
  trigger: { splittable?: boolean; maximumStatements?: number },
) {
  if (!trigger.splittable) return 1;
  const maximum = trigger.maximumStatements ?? 1;
  if (!Number.isInteger(maximum) || maximum < 2 || maximum > 5) {
    throw new Error("Splittable Gap statement maximum must be between 2 and 5");
  }
  return maximum;
}

export type { AtomicGapKind };

function gapStatementDescription(
  kind: AtomicGapKind,
  locale: "de" | "en",
) {
  if (locale === "de") {
    if (kind === "missing") {
      return 'Unveränderliche Art "missing": bestätigte Abwesenheit, zum Beispiel mit "fehlt", "nicht vorhanden" oder "wird nicht durchgeführt"; keine Unsicherheits- oder Nachweisformulierung.';
    }
    if (kind === "partial") {
      return 'Unveränderliche Art "partial": nur die unvollständige Umsetzung beschreiben; keine vollständige Abwesenheit und keine erfundenen fehlenden Teilkontrollen.';
    }
    return 'Unveränderliche Art "uncertain": ausdrücklich "unklar", "ungewiss", "Unsicherheit", "nicht nachgewiesen" oder "nicht ersichtlich" verwenden; keine Abwesenheit behaupten.';
  }
  if (kind === "missing") {
    return 'Immutable kind "missing": state confirmed absence, for example "No ...", "... is missing", or "... is not performed"; do not use uncertainty or evidence wording.';
  }
  if (kind === "partial") {
    return 'Immutable kind "partial": state only that implementation is incomplete; do not claim complete absence or invent a missing sub-control.';
  }
  return 'Immutable kind "uncertain": explicitly use "unclear", "unknown", "uncertain", "not evidenced", or "not established"; never claim absence.';
}
