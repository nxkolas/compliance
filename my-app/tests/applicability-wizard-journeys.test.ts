import { describe, expect, it } from "vitest";
import { deriveFactsForAnswers } from "@/src/server/applicability-check/fact-derivation";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";
import type { ApplicabilityAnswerValue } from "@/src/server/applicability-check/question-visibility";
import { getCurrentApplicabilityDefinition } from "@/src/server/definitions/applicability";

const definition = getCurrentApplicabilityDefinition("de");
const questions = definition.questions;
const questionIdByStableKey = Object.fromEntries(
  questions.map((question) => [question.stableKey, question.id]),
);

function evaluate(input: Record<string, ApplicabilityAnswerValue>) {
  const answers = Object.fromEntries(
    Object.entries(input).map(([stableKey, value]) => [
      questionIdByStableKey[stableKey],
      value,
    ]),
  );
  const facts = deriveFactsForAnswers(questions, answers);
  return {
    facts,
    result: evaluateRuleSet(definition.ruleSet.rules, { facts }),
  };
}

const sizeSmall = {
  "bc.employee_count": "under_50",
  "bc.annual_revenue": "revenue_at_most_10m",
  "bc.balance_sheet_total": "balance_at_most_10m",
  "bc.aggregation": "verified_de_without_it_exception",
};

const sizeMedium = {
  "bc.employee_count": "50_249",
  "bc.annual_revenue": "revenue_at_most_10m",
  "bc.balance_sheet_total": "balance_at_most_10m",
  "bc.aggregation": "verified_de_without_it_exception",
};

const sizeLarge = {
  "bc.employee_count": "250_plus",
  "bc.annual_revenue": "revenue_at_most_10m",
  "bc.balance_sheet_total": "balance_at_most_10m",
  "bc.aggregation": "verified_de_without_it_exception",
};

describe("guided wizard journeys", () => {
  it("ends particularly important for a German critical installation (Q1 route)", () => {
    const { facts, result } = evaluate({
      "bc.germany_connection": "de_critical_installation",
    });

    expect(facts).toMatchObject({
      eu_activity: "yes",
      jurisdiction_country: "DE",
      jurisdiction_basis: "de_critical_installation_location",
      member_state_designation: "de_critical_installation",
    });
    expect(result.outcome).toBe("essential_entity");
    expect(result.reasonCodes).toContain("de_critical_installation");
  });

  it("ends particularly important when Q2 reports a critical installation", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "de_critical_installation",
    });

    expect(result.outcome).toBe("essential_entity");
  });

  it("ends particularly important for a CER/authority designation (Q2 route)", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "essential_or_cer",
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.reasonCodes).toContain("cer_critical_designation");
  });

  it("routes the federal administration to the essential outcome", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_federal_administration",
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.reasonCodes).toContain(
      "de_size_independent_particularly_important",
    );
  });

  it("keeps regional administration as clarification required", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_regional_administration",
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.unresolvedFactCodes).toContain(
      "unresolved_regional_administration",
    );
  });

  it("applies the Q2 important floor to a sector with no covered activity", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "important",
      "bc.sector": "none_of_these",
    });

    expect(result.outcome).toBe("important_entity");
  });

  it("ends not directly in scope when no German connection applies", () => {
    const { facts, result } = evaluate({
      "bc.germany_connection": "none",
    });

    expect(facts.eu_activity).toBe("no");
    expect(result.outcome).toBe("not_directly_in_scope");
  });

  it("ends clarification required when the Germany connection is unsure", () => {
    const { result } = evaluate({
      "bc.germany_connection": "unsure",
    });

    expect(result.outcome).toBe("clarification_required");
  });

  it("classifies a medium Annex-1 electricity supplier as important", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_supply_networks"],
      ...sizeMedium,
    });

    expect(result.outcome).toBe("important_entity");
    expect(result.reasonCodes).toContain("de_annex_1_medium");
  });

  it("classifies a large Annex-1 electricity supplier as essential", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_supply_networks"],
      ...sizeLarge,
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.reasonCodes).toContain("de_annex_1_large");
  });

  it("classifies a medium Annex-2 postal provider as important", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["transport"],
      "bc.activity": ["transport_postal_courier"],
      ...sizeMedium,
    });

    expect(result.outcome).toBe("important_entity");
    expect(result.reasonCodes).toContain("de_annex_2_medium_or_large");
  });

  it("classifies small and medium telecom providers per the special size rule", () => {
    const small = evaluate({
      "bc.germany_connection": "de_telecom_provider",
      "bc.special_status": "none",
      ...sizeSmall,
    });
    const medium = evaluate({
      "bc.germany_connection": "de_telecom_provider",
      "bc.special_status": "none",
      ...sizeMedium,
    });

    expect(small.result.outcome).toBe("important_entity");
    expect(small.result.reasonCodes).toContain("de_telecom_small");
    expect(medium.result.outcome).toBe("essential_entity");
    expect(medium.result.reasonCodes).toContain("de_telecom_medium_or_large");
  });

  it("keeps the domain-registration route clarification with the §34 overlay", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["digital"],
      "bc.activity": ["digital_domain_registration"],
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.obligationOverlays.map((overlay) => overlay.code)).toContain(
      "domain_registration_obligations",
    );
  });

  it("classifies a cross-border DNS provider as essential via the digital route", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_cross_border_digital_provider",
      "bc.special_status": "none",
      "bc.activity": ["digital_dns"],
    });

    expect(result.outcome).toBe("essential_entity");
    if (result.evaluatorKind !== "nis2_scope_v3") {
      throw new Error("Expected v3 evidence");
    }
    expect(result.selectedCatalogCode).toBe("country:DE");
  });

  it("classifies a non-qualified trust provider as important without size", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["digital"],
      "bc.activity": ["digital_other_trust"],
    });

    expect(result.outcome).toBe("important_entity");
  });

  it("returns not directly in scope when only 'none of these' activities apply", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_none"],
    });

    expect(result.outcome).toBe("not_directly_in_scope");
  });

  it("returns clarification when an activity section is unsure", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_unsure"],
    });

    expect(result.outcome).toBe("clarification_required");
  });

  it("requires a confirmed aggregation for a size-dependent small entity", () => {
    const unverified = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_supply_networks"],
      "bc.employee_count": "under_50",
      "bc.annual_revenue": "revenue_at_most_10m",
      "bc.balance_sheet_total": "balance_at_most_10m",
    });
    const verified = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_supply_networks"],
      ...sizeSmall,
    });

    expect(unverified.result.outcome).toBe("clarification_required");
    expect(unverified.result.unresolvedFactCodes).toContain(
      "unresolved_size_aggregation",
    );
    expect(verified.result.outcome).toBe("not_directly_in_scope");
  });

  it("keeps the decisive size route valid when aggregation is auto-confirmed", () => {
    const { result } = evaluate({
      "bc.germany_connection": "de_established",
      "bc.special_status": "none",
      "bc.sector": ["energy"],
      "bc.activity": ["energy_supply_networks"],
      ...sizeLarge,
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.sizeClassification).toBe("large");
  });
});
