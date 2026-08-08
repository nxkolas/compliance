import { describe, expect, it } from "vitest";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";
import {
  getNis2ReleaseMessage,
  getNis2ReleaseMessageKeys,
} from "@/lib/i18n/messages/nis2-release";

describe("immutable NIS2 release compiler", () => {
  it("publishes the eight guided-wizard questions with complete localized tooltips", () => {
    expect(nis2ReleaseDefinition.questions).toHaveLength(8);
    expect(
      nis2ReleaseDefinition.questions.map((question) => question.stableKey),
    ).toEqual([
      "bc.germany_connection",
      "bc.special_status",
      "bc.sector",
      "bc.activity",
      "bc.employee_count",
      "bc.annual_revenue",
      "bc.balance_sheet_total",
      "bc.aggregation",
    ]);

    for (const question of nis2ReleaseDefinition.questions) {
      expect(question.tooltipContentKey).toBe(
        `nis2.question.${question.stableKey}.tooltip`,
      );
      expect(
        getNis2ReleaseMessage("de", question.tooltipContentKey!)?.trim(),
      ).toBeTruthy();
      expect(
        getNis2ReleaseMessage("en", question.tooltipContentKey!)?.trim(),
      ).toBeTruthy();
    }
  });

  it("rejects a current NIS2 question without a tooltip", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    delete release.questions[0].tooltipContentKey;

    expect(() => compileRelease(release)).toThrow(
      /Missing tooltip content key for question bc\.germany_connection/,
    );
  });

  it("changes questionnaire identity for a message-key change while the evaluator stays unchanged", () => {
    const original = compileRelease(nis2ReleaseDefinition);
    const changed = structuredClone(nis2ReleaseDefinition);
    changed.questions[0].options[0].labelContentKey =
      changed.questions[0].options[1].labelContentKey;

    const compiled = compileRelease(changed);
    expect(compiled.hashes.questionnaire).not.toBe(
      original.hashes.questionnaire,
    );
    expect(compiled.hashes.aggregate).not.toBe(original.hashes.aggregate);
    expect(compiled.hashes.ruleSet).toBe(original.hashes.ruleSet);
    expect(compiled.artifact).toEqual(original.artifact);
  });

  it("offers the no-related-enterprises aggregation value", () => {
    const question = nis2ReleaseDefinition.questions.find(
      (candidate) => candidate.stableKey === "bc.aggregation",
    );

    expect(question?.options).toContainEqual(
      expect.objectContaining({
        stableValue: "not_applicable_no_partner_or_linked_enterprises",
        factOptionValue: "not_applicable_no_partner_or_linked_enterprises",
      }),
    );
    const fact = nis2ReleaseDefinition.facts.find(
      (candidate) => candidate.key === "sme_figures_verified",
    );
    expect(fact?.options.map((option) => option.stableValue)).toEqual(
      expect.arrayContaining([
        "verified_de_without_it_exception",
        "verified_de_with_it_exception",
        "not_applicable_no_partner_or_linked_enterprises",
      ]),
    );
  });

  it("compiles a separate German national catalog with explicit EU provenance", () => {
    const { artifact } = compileRelease(nis2ReleaseDefinition);
    if (artifact.kind !== "nis2_scope_v3")
      throw new Error("Expected v3 artifact");
    const germanProfile = artifact.countryProfiles.DE;

    expect(artifact.kind).toBe("nis2_scope_v3");
    expect(germanProfile.entityCatalog.map((entity) => entity.code)).toEqual(
      expect.arrayContaining([
        "de_bsig_electricity_supplier",
        "de_bsig_qualified_trust_service_provider",
        "de_bsig_non_qualified_trust_service_provider",
        "de_bsig_domain_name_registry_service_provider",
        "de_bsig_federal_authority",
        "de_bsig_regional_public_administration",
      ]),
    );
    expect(
      new Set(
        germanProfile.entityCatalog
          .map((entity) => entity.statutoryCategoryCode)
          .filter((code): code is string =>
            Boolean(code?.startsWith("de_bsig_annex_")),
          ),
      ).size,
    ).toBe(67);
    expect(
      germanProfile.entityCatalog.find(
        (entity) => entity.code === "de_bsig_qualified_trust_service_provider",
      )?.mappings,
    ).toContainEqual({
      euEntityCode: "qualified_trust_service_provider",
      relationship: "exact",
    });
    expect(
      germanProfile.entityCatalog.find(
        (entity) => entity.code === "de_bsig_electricity_supplier",
      )?.legalProvisionKeys,
    ).toEqual(
      expect.arrayContaining(["de_bsig.annex_1_1_1_1", "de_enwg.section_3"]),
    );
  });

  it("compiles deterministically without localized execution fields", () => {
    const first = compileRelease(nis2ReleaseDefinition);
    const second = compileRelease(structuredClone(nis2ReleaseDefinition));

    expect(second.hashes).toEqual(first.hashes);
    expect(first.artifact.entityTypes).toHaveLength(70);
    expect(first.artifact).not.toHaveProperty("outcomes");
    expect(first.artifact.entityTypes[0]).not.toHaveProperty("label");
    expect(first.artifact.entityTypes[0]).not.toHaveProperty("description");
  });

  it("publishes the guided wizard before the entity and size facts", () => {
    const orderedQuestions = [...nis2ReleaseDefinition.questions].sort(
      (left, right) => left.position - right.position,
    );
    const entityFact = nis2ReleaseDefinition.facts.find(
      (fact) => fact.key === "nis2_entity_types",
    );

    expect(orderedQuestions.map((question) => question.stableKey)).toEqual([
      "bc.germany_connection",
      "bc.special_status",
      "bc.sector",
      "bc.activity",
      "bc.employee_count",
      "bc.annual_revenue",
      "bc.balance_sheet_total",
      "bc.aggregation",
    ]);
    expect(
      entityFact?.options.find(
        (option) => option.stableValue === "de_bsig_electricity_supplier",
      ),
    ).toMatchObject({
      catalogCode: "country:DE",
      jurisdictionEntityTypeCode: "de_bsig_electricity_supplier",
    });
  });

  it("provides non-empty translations for every NIS2 release message", () => {
    for (const key of getNis2ReleaseMessageKeys()) {
      expect(getNis2ReleaseMessage("de", key)?.trim()).toBeTruthy();
      expect(getNis2ReleaseMessage("en", key)?.trim()).toBeTruthy();
    }
  });

  it("rejects missing metadata content references", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.framework.nameContentKey = "missing.framework.name";

    expect(() => compileRelease(release)).toThrow(
      /Unknown content key missing\.framework\.name/,
    );
  });

  it("resolves release metadata from the i18n catalog", () => {
    expect(
      getNis2ReleaseMessage(
        "de",
        nis2ReleaseDefinition.framework.descriptionContentKey,
      ),
    ).toBe("Rahmenwerk zur Prüfung der NIS2-Betroffenheit.");
    expect(
      getNis2ReleaseMessage("en", nis2ReleaseDefinition.module.nameContentKey),
    ).toBe("Applicability check");
  });

  it("changes aggregate identity for a metadata reference change", () => {
    const original = compileRelease(nis2ReleaseDefinition);
    const referenceChange = structuredClone(nis2ReleaseDefinition);
    referenceChange.module.nameContentKey =
      referenceChange.questionnaire.titleContentKey;

    expect(compileRelease(referenceChange).hashes.aggregate).not.toBe(
      original.hashes.aggregate,
    );
  });

  it("keeps entity descriptions publishable in both locales", () => {
    for (const entity of nis2ReleaseDefinition.entityTypes) {
      for (const locale of ["de", "en"] as const) {
        expect(
          getNis2ReleaseMessage(locale, entity.descriptionContentKey),
        ).not.toMatch(
          /^(Rechtlich definierte Einrichtungsart:|Legally defined entity type:)/i,
        );
      }
    }
  });

  it("rejects catalog ownership that disagrees with relational identity", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    const entityFact = release.facts.find(
      (fact) => fact.key === "nis2_entity_types",
    );
    const germanOption = entityFact?.options.find(
      (option) => option.stableValue === "de_bsig_electricity_supplier",
    );
    if (!germanOption) throw new Error("German fact option missing");
    germanOption.catalogCode = "eu_core";

    expect(() => compileRelease(release)).toThrow(/catalog ownership/i);
  });

  it("rejects a German release with an incomplete transition declaration", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.profiles[0].effectiveStates =
      release.profiles[0].effectiveStates.filter(
        (state) => state.code !== "de_bsi_kritisv_section_12_repeal_trigger",
      );

    expect(() => compileRelease(release)).toThrow(/required effective state/i);
  });

  it("rejects a transition declaration that is not effective for the release", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.profiles[0].effectiveStates[0].effectiveFrom = "2027-01-01";

    expect(() => compileRelease(release)).toThrow(
      /not effective on release date/i,
    );
  });

  it("rejects a question whose mapped fact value has no fact option", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    const activity = release.questions.find(
      (question) => question.stableKey === "bc.activity",
    );
    if (!activity) throw new Error("Activity question missing");
    const mapping = activity.factMappings.find(
      (candidate) => candidate.factKey === "nis2_entity_types",
    );
    if (!mapping?.byOption) throw new Error("Activity mapping missing");
    mapping.byOption.energy_supply_networks = ["not_a_german_entity"];

    expect(() => compileRelease(release)).toThrow(/has no fact option/);
  });

  it("emits language-neutral evidence tied to component versions", () => {
    const compiled = compileRelease(nis2ReleaseDefinition);
    const result = evaluateRuleSet(compiled.artifact, {
      facts: nis2ReleaseDefinition.fixtures[0].facts,
    });

    expect(result.schemaVersion).toBe(4);
    expect(result.releaseVersion).toBe("2026-v1");
    expect(result.evaluatorKind).toBe("nis2_scope_v3");
    expect(result.matchedEntityTypes[0]).toMatchObject({
      code: "electricity_supplier",
      versionKey: "2026-v1:electricity_supplier",
    });
    expect(result).not.toHaveProperty("label");
    expect(result).not.toHaveProperty("reasons");
  });
});
