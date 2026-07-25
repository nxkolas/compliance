import { describe, expect, it } from "vitest";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";

describe("immutable NIS2 release compiler", () => {
  it("publishes all twelve stable questions with complete localized tooltips", () => {
    expect(nis2ReleaseDefinition.questions).toHaveLength(12);
    expect(
      nis2ReleaseDefinition.questions.map((question) => question.stableKey),
    ).toEqual([
      "bc.eu_activity",
      "bc.entity_types",
      "bc.jurisdiction_country",
      "bc.jurisdiction_basis",
      "bc.member_state_designation",
      "bc.employee_count",
      "bc.annual_revenue",
      "bc.balance_sheet_total",
      "bc.sme_figures_verified",
      "bc.sector_specific_regime",
      "bc.critical_customers",
      "bc.security_evidence_requested",
    ]);

    for (const question of nis2ReleaseDefinition.questions) {
      expect(question.tooltipContentKey).toBe(
        `nis2.question.${question.stableKey}.tooltip`,
      );
      const tooltip = nis2ReleaseDefinition.content.find(
        (item) => item.stableKey === question.tooltipContentKey,
      );
      expect(tooltip?.translations.de.trim()).toBeTruthy();
      expect(tooltip?.translations.en.trim()).toBeTruthy();
    }
  });

  it("rejects a current NIS2 question without a tooltip", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    delete release.questions[0].tooltipContentKey;

    expect(() => compileRelease(release)).toThrow(
      /Missing tooltip content key for question bc\.eu_activity/,
    );
  });

  it("changes questionnaire and aggregate identities when tooltip copy changes", () => {
    const original = compileRelease(nis2ReleaseDefinition);
    const changed = structuredClone(nis2ReleaseDefinition);
    const tooltipKey = changed.questions[0].tooltipContentKey;
    const tooltip = changed.content.find(
      (item) => item.stableKey === tooltipKey,
    );
    if (!tooltip) throw new Error("Tooltip fixture is missing");
    tooltip.translations.en += " Updated.";

    const compiled = compileRelease(changed);
    expect(compiled.hashes.questionnaire).not.toBe(
      original.hashes.questionnaire,
    );
    expect(compiled.hashes.aggregate).not.toBe(original.hashes.aggregate);
  });

  it("offers the no-related-enterprises value for question 9", () => {
    const question = nis2ReleaseDefinition.questions.find(
      (candidate) => candidate.stableKey === "bc.sme_figures_verified",
    );

    expect(question?.options).toContainEqual(
      expect.objectContaining({
        stableValue: "not_applicable_no_partner_or_linked_enterprises",
        factOptionValue:
          "not_applicable_no_partner_or_linked_enterprises",
      }),
    );
  });

  it("compiles a separate German national catalog with explicit EU provenance", () => {
    const { artifact } = compileRelease(nis2ReleaseDefinition);
    if (artifact.kind !== "nis2_scope_v3") throw new Error("Expected v3 artifact");
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
          .filter((code): code is string => Boolean(code?.startsWith("de_bsig_annex_"))),
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
      expect.arrayContaining([
        "de_bsig.annex_1_1_1_1",
        "de_enwg.section_3",
      ]),
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

  it("publishes country selection before a profile-driven entity catalog", () => {
    const orderedQuestions = [...nis2ReleaseDefinition.questions].sort(
      (left, right) => left.position - right.position,
    );
    const entityQuestion = orderedQuestions.find(
      (question) => question.factKey === "nis2_entity_types",
    );
    const entityFact = nis2ReleaseDefinition.facts.find(
      (fact) => fact.key === "nis2_entity_types",
    );

    expect(orderedQuestions.slice(0, 3).map((question) => question.factKey)).toEqual([
      "eu_activity",
      "jurisdiction_country",
      "nis2_entity_types",
    ]);
    expect(entityQuestion).toBeDefined();
    expect(
      entityFact?.options.find(
        (option) => option.stableValue === "de_bsig_electricity_supplier",
      ),
    ).toMatchObject({
      catalogCode: "country:DE",
      jurisdictionEntityTypeCode: "de_bsig_electricity_supplier",
    });
  });

  it("rejects incomplete translations", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.content[0].translations.en = "";
    expect(() => compileRelease(release)).toThrow(/Missing en translation/);
  });

  it("rejects missing metadata content references", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.framework.nameContentKey = "missing.framework.name";

    expect(() => compileRelease(release)).toThrow(
      /Unknown content key missing\.framework\.name/,
    );
  });

  it("rejects blank metadata translations in either required locale", () => {
    for (const [key, locale] of [
      [nis2ReleaseDefinition.framework.descriptionContentKey, "de"],
      [nis2ReleaseDefinition.module.nameContentKey, "en"],
      [nis2ReleaseDefinition.questionnaire.titleContentKey, "de"],
    ] as const) {
      const release = structuredClone(nis2ReleaseDefinition);
      const item = release.content.find((candidate) => candidate.stableKey === key);
      if (!item) throw new Error(`Metadata fixture ${key} is missing`);
      item.translations[locale] = " ";

      expect(() => compileRelease(release)).toThrow(
        new RegExp(`Missing ${locale} translation`),
      );
    }
  });

  it("changes aggregate identity for metadata wording or reference changes", () => {
    const original = compileRelease(nis2ReleaseDefinition);
    const wordingChange = structuredClone(nis2ReleaseDefinition);
    const moduleName = wordingChange.content.find(
      (item) => item.stableKey === wordingChange.module.nameContentKey,
    );
    if (!moduleName) throw new Error("Module metadata fixture is missing");
    moduleName.translations.en += " updated";

    const referenceChange = structuredClone(nis2ReleaseDefinition);
    referenceChange.module.nameContentKey =
      referenceChange.questionnaire.titleContentKey;

    expect(compileRelease(wordingChange).hashes.aggregate).not.toBe(
      original.hashes.aggregate,
    );
    expect(compileRelease(referenceChange).hashes.aggregate).not.toBe(
      original.hashes.aggregate,
    );
  });

  it("rejects generic entity-description placeholders", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    const descriptionKey = release.entityTypes[0].descriptionContentKey;
    const description = release.content.find((item) => item.stableKey === descriptionKey);
    if (!description) throw new Error("Fixture description missing");
    description.translations.en = "Legally defined entity type: example";
    expect(() => compileRelease(release)).toThrow(/Generic entity description/);
  });

  it("rejects catalog ownership that disagrees with relational identity", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    const entityFact = release.facts.find((fact) => fact.key === "nis2_entity_types");
    const germanOption = entityFact?.options.find(
      (option) => option.stableValue === "de_bsig_electricity_supplier",
    );
    if (!germanOption) throw new Error("German fact option missing");
    germanOption.catalogCode = "eu_core";

    expect(() => compileRelease(release)).toThrow(/catalog ownership/i);
  });

  it("rejects a German release with an incomplete transition declaration", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.profiles[0].effectiveStates = release.profiles[0].effectiveStates.filter(
      (state) => state.code !== "de_bsi_kritisv_section_12_repeal_trigger",
    );

    expect(() => compileRelease(release)).toThrow(/required effective state/i);
  });

  it("rejects a transition declaration that is not effective for the release", () => {
    const release = structuredClone(nis2ReleaseDefinition);
    release.profiles[0].effectiveStates[0].effectiveFrom = "2027-01-01";

    expect(() => compileRelease(release)).toThrow(/not effective on release date/i);
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
