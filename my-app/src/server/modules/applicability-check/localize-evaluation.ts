import type { PublishedComplianceRelease } from "@/src/server/modules/compliance";
import { legalCitationContentKey } from "@/src/server/modules/compliance";
import type { StoredRuleEvaluationResult } from "../compliance/nis2/rule-evaluation-schema";
import { parseRuleSetDocument } from "../compliance/nis2/rule-set-schema";

export type LocalizedRuleEvaluationResult = {
  outcome: StoredRuleEvaluationResult["outcome"];
  label: string;
  labelEn: string;
  reasons: string[];
  reasonsEn: string[];
  sizeClassification: StoredRuleEvaluationResult["sizeClassification"];
  jurisdiction: {
    countryCode: string | null;
    countryProfileVersion: string | null;
  };
  matchedEntityTypes: Array<{
    code: string;
    label: string;
    labelEn: string;
    legalReference: string;
  }>;
  scopeBases: Array<{
    code: string;
    description: string;
    descriptionEn: string;
    legalReference: string | null;
  }>;
  unresolvedFacts: string[];
  unresolvedFactsEn: string[];
  obligationOverlays: Array<{
    code: string;
    description: string;
    descriptionEn: string;
    legalReference: string | null;
  }>;
  indirectExposure: {
    status: StoredRuleEvaluationResult["indirectExposure"]["status"];
    reasons: string[];
    reasonsEn: string[];
  };
  disclaimer: string;
  disclaimerEn: string;
};

export function localizeEvaluation(
  evidence: StoredRuleEvaluationResult,
  release: PublishedComplianceRelease,
  releaseEn: PublishedComplianceRelease,
): LocalizedRuleEvaluationResult {
  const artifact = parseRuleSetDocument(release.ruleSet.rules);
  const text = (key: string | undefined, locale: "de" | "en") => {
    if (!key) return "";
    const bundle = locale === "en" ? releaseEn : release;
    return bundle.contentByStableKey[key] ?? key;
  };
  const reason = (code: string, locale: "de" | "en") =>
    text(artifact.reasonContentKeys[code], locale) || code;
  const legalCitation = (key: string, locale: "de" | "en") => {
    const contentKey = legalCitationContentKey(key);
    return (contentKey ? text(contentKey, locale) : "") || key;
  };
  const displayEntities =
    evidence.evaluatorKind === "nis2_scope_v3" &&
    evidence.matchedNationalEntityTypes.length > 0
      ? evidence.matchedNationalEntityTypes
      : evidence.matchedEntityTypes;
  const localizeBasis = (
    item: StoredRuleEvaluationResult["scopeBases"][number],
  ) => ({
    code: item.code,
    description: reason(item.code, "de"),
    descriptionEn: reason(item.code, "en"),
    legalReference:
      item.legalProvisionKeys
        .map((key) => legalCitation(key, "de"))
        .join(", ") || null,
  });

  return {
    outcome: evidence.outcome,
    label: text(artifact.outcomeContentKeys[evidence.outcome], "de"),
    labelEn: text(artifact.outcomeContentKeys[evidence.outcome], "en"),
    reasons: evidence.reasonCodes.map((code) => reason(code, "de")),
    reasonsEn: evidence.reasonCodes.map((code) => reason(code, "en")),
    sizeClassification: evidence.sizeClassification,
    jurisdiction: {
      countryCode: evidence.jurisdiction.countryCode,
      countryProfileVersion: evidence.profileVersionKey,
    },
    matchedEntityTypes: displayEntities.map((entity) => ({
      code: entity.code,
      label: optionLabel(release, "nis2_entity_types", entity.code),
      labelEn: optionLabel(releaseEn, "nis2_entity_types", entity.code),
      legalReference: entity.legalProvisionKeys
        .map((key) => legalCitation(key, "de"))
        .join(", "),
    })),
    scopeBases: evidence.scopeBases.map(localizeBasis),
    unresolvedFacts: evidence.unresolvedFactCodes.map((code) =>
      reason(code, "de"),
    ),
    unresolvedFactsEn: evidence.unresolvedFactCodes.map((code) =>
      reason(code, "en"),
    ),
    obligationOverlays: evidence.obligationOverlays.map(localizeBasis),
    indirectExposure: {
      status: evidence.indirectExposure.status,
      reasons: evidence.indirectExposure.reasonCodes.map((code) =>
        reason(code, "de"),
      ),
      reasonsEn: evidence.indirectExposure.reasonCodes.map((code) =>
        reason(code, "en"),
      ),
    },
    disclaimer: text(artifact.disclaimerContentKey, "de"),
    disclaimerEn: text(artifact.disclaimerContentKey, "en"),
  };
}

function optionLabel(
  release: PublishedComplianceRelease,
  factKey: string,
  stableValue: string,
) {
  const directLabel =
    release.contentByStableKey[
      `nis2.profile.de.entity.${stableValue}.label`
    ] ??
    release.contentByStableKey[`nis2.entity.${stableValue}.label`];
  if (directLabel) return directLabel;

  const questionIndex = release.questionIndexByFactKey[factKey];
  const question =
    questionIndex === undefined ? undefined : release.questions[questionIndex];
  if (!question) return stableValue;
  const optionIndex =
    release.optionIndexByQuestionAndValue[
      `${question.id}\u0000${stableValue}`
    ];
  return optionIndex
    ? release.questions[optionIndex.questionIndex]?.options[
        optionIndex.optionIndex
      ]?.label ?? stableValue
    : stableValue;
}
