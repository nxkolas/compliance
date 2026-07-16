import { describe, expect, it } from "vitest";
import { nis2ScopeRuleSet } from "@/src/server/applicability-check/nis2-scope-definition";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";

function facts(overrides: Record<string, unknown> = {}) {
  return {
    eu_activity: "yes",
    jurisdiction_country: "DE",
    jurisdiction_basis: "establishment",
    nis2_entity_types: ["electricity_supplier"],
    member_state_designation: "none",
    employee_count_bucket: "under_50",
    annual_revenue_bucket: "revenue_at_most_10m",
    balance_sheet_total_bucket: "balance_at_most_10m",
    sme_figures_verified: "yes",
    serves_critical_customers: "no",
    has_customer_security_evidence_requests: "no",
    ...overrides,
  };
}

describe("rigid NIS2 scope evaluator", () => {
  it("classifies a large Annex I entity as essential", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ employee_count_bucket: "250_plus" }),
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.sizeClassification).toBe("large");
    expect(result.scopeBases.map((item) => item.code)).toContain("annex_i_large");
  });

  it("classifies a medium Annex I entity as important", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ employee_count_bucket: "50_249" }),
    });

    expect(result.outcome).toBe("important_entity");
    expect(result.sizeClassification).toBe("medium");
  });

  it("classifies medium and large Annex II entities as important", () => {
    for (const employeeCount of ["50_249", "250_plus"]) {
      const result = evaluateRuleSet(nis2ScopeRuleSet, {
        facts: facts({
          nis2_entity_types: ["postal_courier_provider"],
          employee_count_bucket: employeeCount,
        }),
      });

      expect(result.outcome).toBe("important_entity");
    }
  });

  it("requires both financial thresholds when employee count is below 50", () => {
    const turnoverOnly = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ annual_revenue_bucket: "revenue_over_10m_to_50m" }),
    });
    const balanceOnly = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ balance_sheet_total_bucket: "balance_over_10m_to_43m" }),
    });
    const both = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        annual_revenue_bucket: "revenue_over_10m_to_50m",
        balance_sheet_total_bucket: "balance_over_10m_to_43m",
      }),
    });

    expect(turnoverOnly.sizeClassification).toBe("small");
    expect(turnoverOnly.outcome).toBe("not_directly_in_scope");
    expect(balanceOnly.sizeClassification).toBe("small");
    expect(balanceOnly.outcome).toBe("not_directly_in_scope");
    expect(both.sizeClassification).toBe("medium");
    expect(both.outcome).toBe("important_entity");
  });

  it("requires both large financial thresholds", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        annual_revenue_bucket: "revenue_over_50m",
        balance_sheet_total_bucket: "balance_over_10m_to_43m",
      }),
    });

    expect(result.sizeClassification).toBe("medium");
    expect(result.outcome).toBe("important_entity");
  });

  it("classifies size-independent digital infrastructure correctly", () => {
    const dns = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ nis2_entity_types: ["dns_service_provider"] }),
    });
    const trust = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ nis2_entity_types: ["other_trust_service_provider"] }),
    });
    const smallTelecom = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["public_electronic_communications_service"],
      }),
    });

    expect(dns.outcome).toBe("essential_entity");
    expect(trust.outcome).toBe("important_entity");
    expect(smallTelecom.outcome).toBe("important_entity");
  });

  it("uses the highest category across multiple entity types", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["postal_courier_provider", "dns_service_provider"],
      }),
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.matchedEntityTypes).toHaveLength(2);
  });

  it("honors Member-State and CER designations", () => {
    const important = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["none_of_these"],
        member_state_designation: "important",
      }),
    });
    const cer = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["none_of_these"],
        member_state_designation: "cer_critical",
      }),
    });

    expect(important.outcome).toBe("important_entity");
    expect(cer.outcome).toBe("essential_entity");
  });

  it("reports domain-name registration as a special clarification case", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["domain_name_registration_service"],
      }),
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.obligationOverlays.map((item) => item.code)).toContain(
      "domain_registration_obligations",
    );
  });

  it("only permits a negative conclusion for a supported country profile", () => {
    const germany = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ nis2_entity_types: ["none_of_these"] }),
    });
    const unsupported = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_country: "FR",
        nis2_entity_types: ["none_of_these"],
      }),
    });

    expect(germany.outcome).toBe("not_directly_in_scope");
    expect(unsupported.outcome).toBe("clarification_required");
  });

  it("requires verified SME figures for size-dependent entities", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        employee_count_bucket: "250_plus",
        sme_figures_verified: "no",
      }),
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.sizeClassification).toBe("unknown");
  });

  it("keeps indirect exposure separate from the legal outcome", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["none_of_these"],
        serves_critical_customers: "yes",
        has_customer_security_evidence_requests: "yes",
      }),
    });

    expect(result.outcome).toBe("not_directly_in_scope");
    expect(result.indirectExposure.status).toBe("signals_present");
    expect(result.indirectExposure.reasons).toHaveLength(2);
  });

  it("returns not in scope when there is no relevant EU activity", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: { eu_activity: "no" },
    });

    expect(result.outcome).toBe("not_directly_in_scope");
  });
});
