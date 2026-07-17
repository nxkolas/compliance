import { describe, expect, it } from "vitest";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";

const nis2ScopeRuleSet = compileRelease(nis2ReleaseDefinition).artifact;

function facts(overrides: Record<string, unknown> = {}) {
  return {
    eu_activity: "yes",
    jurisdiction_country: "DE",
    jurisdiction_basis: "de_establishment",
    nis2_entity_types: ["de_bsig_electricity_supplier"],
    member_state_designation: "none",
    employee_count_bucket: "under_50",
    annual_revenue_bucket: "revenue_at_most_10m",
    balance_sheet_total_bucket: "balance_at_most_10m",
    sme_figures_verified: "verified_de_without_it_exception",
    serves_critical_customers: "no",
    has_customer_security_evidence_requests: "no",
    ...overrides,
  };
}

describe("rigid NIS2 scope evaluator", () => {
  it("classifies German national identities and records their EU mappings", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_basis: "de_establishment",
        nis2_entity_types: ["de_bsig_electricity_supplier"],
        employee_count_bucket: "50_249",
        sme_figures_verified: "verified_de_without_it_exception",
      }),
    });

    expect(result.outcome).toBe("important_entity");
    if (result.evaluatorKind !== "nis2_scope_v3") {
      throw new Error("Expected v3 evidence");
    }
    expect(result.selectedCatalogCode).toBe("country:DE");
    expect(result.matchedNationalEntityTypes).toContainEqual(
      expect.objectContaining({
        code: "de_bsig_electricity_supplier",
        statutoryCategoryCode: "de_bsig_annex_1_1_1_1",
        classificationRule: "annex_1_standard",
      }),
    );
    expect(result.nationalMappings).toContainEqual({
      nationalEntityVersionKey: "de_nis2:de-bsig-2025-amended-2026-03:de_bsig_electricity_supplier",
      euEntityCode: "electricity_supplier",
      relationship: "exact",
    });
    expect(result.appliedJurisdictionRules).toContainEqual({
      basisCode: "de_establishment",
      legalProvisionKey: "de_bsig.section_59",
      authorityDecisionRequired: false,
    });
    expect(result.effectiveStateDeclarations.map((state) => state.code)).toEqual(
      expect.arrayContaining([
        "de_critical_installation_definition_regime",
        "de_bsi_kritisv_section_12_repeal_trigger",
      ]),
    );
  });

  it("distinguishes qualified and non-qualified German trust providers", () => {
    const qualified = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_basis: "de_establishment",
        nis2_entity_types: ["de_bsig_qualified_trust_service_provider"],
      }),
    });
    const nonQualified = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_basis: "de_establishment",
        nis2_entity_types: ["de_bsig_non_qualified_trust_service_provider"],
      }),
    });

    expect(qualified.outcome).toBe("essential_entity");
    expect(nonQualified.outcome).toBe("important_entity");
  });

  it("requires the German aggregation declaration for size-dependent identities", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_basis: "de_establishment",
        nis2_entity_types: ["de_bsig_electricity_supplier"],
        employee_count_bucket: "250_plus",
        sme_figures_verified: "yes",
      }),
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.sizeClassification).toBe("unknown");
    expect(result.unresolvedFactCodes).toContain("unresolved_size_aggregation");
  });

  it("requires a matching German jurisdiction rule", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        jurisdiction_basis: "de_main_eu_establishment",
        nis2_entity_types: ["de_bsig_electricity_supplier"],
        sme_figures_verified: "verified_de_without_it_exception",
      }),
    });

    expect(result.outcome).toBe("clarification_required");
    expect(result.unresolvedFactCodes).toContain("unresolved_profile_jurisdiction");
  });

  it("classifies a large Annex I entity as essential", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ employee_count_bucket: "250_plus" }),
    });

    expect(result.outcome).toBe("essential_entity");
    expect(result.sizeClassification).toBe("large");
    expect(result.scopeBases.map((item) => item.code)).toContain("de_annex_1_large");
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
          nis2_entity_types: ["de_bsig_postal_courier_provider"],
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
      facts: facts({
        jurisdiction_basis: "de_main_eu_establishment",
        nis2_entity_types: ["de_bsig_dns_service_provider"],
      }),
    });
    const trust = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({ nis2_entity_types: ["de_bsig_non_qualified_trust_service_provider"] }),
    });
    const smallTelecom = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["de_bsig_publicly_available_telecom_service_provider"],
      }),
    });

    expect(dns.outcome).toBe("essential_entity");
    expect(trust.outcome).toBe("important_entity");
    expect(smallTelecom.outcome).toBe("important_entity");
  });

  it("uses the highest category across multiple entity types", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: facts({
        nis2_entity_types: ["de_bsig_postal_courier_provider", "de_bsig_qualified_trust_service_provider"],
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
        nis2_entity_types: ["de_bsig_domain_name_registry_service_provider"],
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
    expect(result.indirectExposure.reasonCodes).toHaveLength(2);
  });

  it("returns not in scope when there is no relevant EU activity", () => {
    const result = evaluateRuleSet(nis2ScopeRuleSet, {
      facts: { eu_activity: "no" },
    });

    expect(result.outcome).toBe("not_directly_in_scope");
  });
});
