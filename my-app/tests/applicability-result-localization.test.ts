import { describe, expect, it } from "vitest";
import {
  getNis2ReleaseMessage,
  getNis2ReleaseMessageKeys,
} from "@/lib/i18n/messages/nis2-release";
import { localizeEvaluation } from "@/src/server/modules/applicability-check/localize-evaluation";
import { evaluateRuleSet } from "@/src/server/modules/compliance/nis2/rules";
import type { StoredRuleEvaluationResult } from "@/src/server/modules/compliance/nis2/rule-evaluation-schema";
import { nis2ReleaseDefinition } from "@/src/server/modules/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/modules/compliance/publishing/compile-release";
import type { PublishedComplianceRelease } from "@/src/server/modules/compliance/runtime-release/types";

describe("applicability result localization", () => {
  it("projects a result entirely from preloaded German and English bundles", () => {
    const artifact = compileRelease(nis2ReleaseDefinition).artifact;
    const evaluation = evaluateRuleSet(artifact, {
      facts: baseFacts({
        nis2_entity_types: ["none_of_these"],
      }),
    });
    const evidence: StoredRuleEvaluationResult = {
      ...evaluation,
      checkReleaseId: "release-1",
      ruleSetId: "rule-set-1",
      inputHash: "input-hash",
      evaluatedAt: "2026-01-01T00:00:00.000Z",
    };

    const localized = localizeEvaluation(
      evidence,
      bundle("de", artifact),
      bundle("en", artifact),
    );

    expect(localized.outcome).toBe("not_directly_in_scope");
    expect(localized.label).toBe("Nicht direkt im Anwendungsbereich");
    expect(localized.labelEn).toBe("Not directly in scope");
    expect(localized.reasons).toEqual([
      "Keine erfasste Einrichtungsart angegeben.",
    ]);
    expect(localized.reasonsEn).toEqual(["No covered entity type reported."]);
    expect(localized.scopeBases[0]?.legalReference).toBe(
      "§ 28, Anlage 1, Anlage 2",
    );
    expect(localized.disclaimer).toBe(
      "Diese automatisierte Einstufung ist eine nachvollziehbare Vorprüfung und ersetzt keine rechtliche Beratung oder behördliche Entscheidung.",
    );
    expect(localized.disclaimerEn).toBe(
      "This automated classification is a traceable preliminary assessment and does not replace legal advice or an authority decision.",
    );
  });

  it("preserves German and English entity labels from the preloaded option indexes", () => {
    const artifact = compileRelease(nis2ReleaseDefinition).artifact;
    const evaluation = evaluateRuleSet(artifact, {
      facts: baseFacts({
        nis2_entity_types: ["de_bsig_electricity_supplier"],
        employee_count_bucket: "50_249",
      }),
    });
    const evidence: StoredRuleEvaluationResult = {
      ...evaluation,
      checkReleaseId: "release-1",
      ruleSetId: "rule-set-1",
      inputHash: "input-hash",
      evaluatedAt: "2026-01-01T00:00:00.000Z",
    };

    const localized = localizeEvaluation(
      evidence,
      bundle("de", artifact),
      bundle("en", artifact),
    );

    expect(localized.outcome).toBe("important_entity");
    expect(localized.matchedEntityTypes).toContainEqual(
      expect.objectContaining({
        code: "de_bsig_electricity_supplier",
        label: "Stromlieferant",
        labelEn: "Electricity supplier",
      }),
    );
  });
});

function bundle(
  locale: "de" | "en",
  rules: unknown,
): PublishedComplianceRelease {
  const contentByStableKey = Object.fromEntries(
    getNis2ReleaseMessageKeys().map((key) => [
      key,
      getNis2ReleaseMessage(locale, key) ?? key,
    ]),
  );
  const questions = nis2ReleaseDefinition.questions.map((question) => ({
    id: question.stableKey,
    stableKey: question.stableKey,
    position: question.position,
    questionText: contentByStableKey[question.questionContentKey] ?? "",
    helpText: question.helpContentKey
      ? (contentByStableKey[question.helpContentKey] ?? null)
      : null,
    answerType: question.answerType,
    required: question.required,
    config: question.config,
    options: question.options.map((option) => ({
      id: `${question.stableKey}:${option.stableValue}`,
      stableValue: option.stableValue,
      catalogCode: "all",
      label: contentByStableKey[option.labelContentKey] ?? option.stableValue,
      position: option.position,
      metadata: {},
    })),
    factMappings: [{ factKey: question.factKey, transform: {} }],
  }));
  const questionIndexByFactKey = Object.fromEntries(
    nis2ReleaseDefinition.questions.map((question, index) => [
      question.factKey,
      index,
    ]),
  );
  const optionIndexByQuestionAndValue = Object.fromEntries(
    questions.flatMap((question, questionIndex) =>
      question.options.map((option, optionIndex) => [
        `${question.id}\u0000${option.stableValue}`,
        { questionIndex, optionIndex },
      ]),
    ),
  );
  return {
    locale,
    ruleSet: { rules } as PublishedComplianceRelease["ruleSet"],
    contentByStableKey,
    questions,
    questionIndexByFactKey,
    optionIndexByQuestionAndValue,
  } as unknown as PublishedComplianceRelease;
}

function baseFacts(overrides: Record<string, unknown>) {
  return {
    eu_activity: "yes",
    jurisdiction_country: "DE",
    jurisdiction_basis: "de_establishment",
    nis2_entity_types: ["none_of_these"],
    member_state_designation: "none",
    employee_count_bucket: "under_50",
    annual_revenue_bucket: "revenue_at_most_10m",
    balance_sheet_total_bucket: "balance_at_most_10m",
    sme_figures_verified: "verified_de_without_it_exception",
    sector_specific_regime: "none",
    serves_critical_customers: "no",
    has_customer_security_evidence_requests: "no",
    ...overrides,
  };
}
