import {
  ruleEvaluationResultSchema,
  type RuleEvaluationResult,
} from "./rule-evaluation-schema";
import {
  parseRuleSetDocument,
  type Nis2EntityType,
  type Nis2NationalEntityType,
  type Nis2Outcome,
  type Nis2ScopeRuleSetDocument,
} from "./rule-set-schema";

export type { RuleEvaluationResult } from "./rule-evaluation-schema";

export type RuleEvaluationContext = {
  facts: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

type Nis2ScopeV3Document = Extract<
  Nis2ScopeRuleSetDocument,
  { kind: "nis2_scope_v3" }
>;

type ScopeBasis = {
  code: string;
  description: string;
  descriptionEn: string;
  legalReference: string | null;
};
type InternalIndirectExposure = {
  status: "none" | "signals_present" | "unknown";
  reasons: string[];
  reasonsEn: string[];
};
type EvaluableEntityType = Nis2EntityType & {
  label: string;
  labelEn: string;
  legalReference: string;
};

const ARTICLE_2_REFERENCE = "Directive (EU) 2022/2555, Article 2";
const ARTICLE_3_REFERENCE = "Directive (EU) 2022/2555, Article 3";
const ARTICLE_26_REFERENCE = "Directive (EU) 2022/2555, Article 26";
const SME_REFERENCE = "Recommendation 2003/361/EC, Annex, Article 2";

export function evaluateRuleSet(
  ruleSetRules: unknown,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const ruleSet = parseRuleSetDocument(ruleSetRules);
  return ruleSet.kind === "nis2_scope_v3"
    ? evaluateV3RuleSet(ruleSet, context)
    : evaluateLegacyRuleSet(ruleSet, context);
}

function evaluateV3RuleSet(
  ruleSet: Nis2ScopeV3Document,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const euActivity = readSingle(context.facts.eu_activity, ["yes", "no", "unsure"]);
  const countryCode = readNullableString(context.facts.jurisdiction_country);
  const jurisdictionBasis = readNullableString(context.facts.jurisdiction_basis);
  const selectedCodes = readStringArray(context.facts.nis2_entity_types);
  const profile = countryCode ? ruleSet.countryProfiles[countryCode] : undefined;
  const nationalByCode = new Map(
    profile?.entityCatalog.map((entity) => [entity.code, entity]) ?? [],
  );
  const matchedNational = selectedCodes
    .map((code) => nationalByCode.get(code))
    .filter((entity): entity is Nis2NationalEntityType => Boolean(entity));
  const unresolvedFactCodes: string[] = [];
  const addUnresolved = (code: string) => {
    if (!unresolvedFactCodes.includes(code)) unresolvedFactCodes.push(code);
  };
  const scopeBases: Array<{ code: string; legalProvisionKeys: string[] }> = [];
  const obligationOverlays: Array<{ code: string; legalProvisionKeys: string[] }> = [];
  const designation = readNullableString(context.facts.member_state_designation);
  const sizeDependent = matchedNational.some((entity) =>
    ["annex_1_standard", "annex_2_standard", "telecom"].includes(
      entity.classificationRule,
    ),
  );
  const sizeClassification = calculateSizeWithVerification(
    context.facts,
    ruleSet.thresholds,
    profile?.countryCode === "DE"
      ? ["verified_de_without_it_exception", "verified_de_with_it_exception"]
      : ["yes"],
  );

  let outcome: Nis2Outcome = "clarification_required";

  if (euActivity === "no") {
    outcome = "not_directly_in_scope";
    scopeBases.push({
      code: "outside_eu_activity",
      legalProvisionKeys: ["eu_nis2.article_2"],
    });
  } else if (euActivity === "unsure") {
    addUnresolved("unresolved_eu_activity");
  } else if (!profile?.supported) {
    addUnresolved(countryCode ? "unresolved_unsupported_profile" : "unresolved_country");
  } else {
    const explicitNone = selectedCodes.includes("none_of_these");
    const invalidSelections = selectedCodes.filter(
      (code) => code !== "none_of_these" && code !== "unsure" && !nationalByCode.has(code),
    );

    if (!countryCode || countryCode === "unsure") addUnresolved("unresolved_country");
    if (!jurisdictionBasis || jurisdictionBasis === "unsure") {
      addUnresolved("unresolved_jurisdiction_basis");
    }
    if (
      selectedCodes.includes("unsure") ||
      invalidSelections.length > 0 ||
      (matchedNational.length === 0 && !explicitNone)
    ) {
      addUnresolved("unresolved_entity_type");
    }

    if (matchedNational.length > 0 && jurisdictionBasis && jurisdictionBasis !== "unsure") {
      const permittedEntityCodes = new Set(
        profile.jurisdictionRules
          .filter((rule) => rule.basisCode === jurisdictionBasis)
          .flatMap((rule) => rule.entityCodes),
      );
      if (matchedNational.some((entity) => !permittedEntityCodes.has(entity.code))) {
        addUnresolved("unresolved_profile_jurisdiction");
      }
    }

    if (sizeDependent && sizeClassification === "unknown") {
      addUnresolved("unresolved_size_aggregation");
    }

    const criticalInstallation =
      profile.countryCode === "DE" && designation === "de_critical_installation";
    if (
      criticalInstallation ||
      designation === "essential" ||
      designation === "cer_critical"
    ) {
      outcome = "essential_entity";
      scopeBases.push({
        code: criticalInstallation
          ? "de_critical_installation"
          : designation === "cer_critical"
            ? "cer_critical_designation"
            : "member_state_essential_designation",
        legalProvisionKeys: criticalInstallation
          ? ["de_bsig.section_28_1_1"]
          : ["eu_nis2.article_3"],
      });
    } else if (matchedNational.length > 0) {
      const classified = classifyNationalEntityTypes(matchedNational, sizeClassification);
      outcome = classified.outcome;
      if (classified.basisCode) {
        const classificationLegalProvisionKeys = new Set(
          matchedNational.flatMap((entity) => entity.legalProvisionKeys),
        );
        classificationLegalProvisionKeys.add("de_bsig.section_28");
        if (
          matchedNational.some(
            (entity) => entity.classificationRule === "federal_administration",
          )
        ) {
          classificationLegalProvisionKeys.add("de_bsig.section_29");
        }
        scopeBases.push({
          code: classified.basisCode,
          legalProvisionKeys: [...classificationLegalProvisionKeys],
        });
      }
    } else if (explicitNone) {
      outcome = profile.allowNegativeConclusion
        ? "not_directly_in_scope"
        : "clarification_required";
      if (outcome === "not_directly_in_scope") {
        scopeBases.push({
          code: "no_covered_entity_type",
          legalProvisionKeys: profile.legalProvisionKeys,
        });
      }
    }

    if (designation === "important" && outcome !== "essential_entity") {
      outcome = "important_entity";
      scopeBases.push({
        code: "member_state_important_designation",
        legalProvisionKeys: ["eu_nis2.article_3"],
      });
    }

    if (
      matchedNational.some(
        (entity) => entity.classificationRule === "domain_registration_obligations",
      )
    ) {
      obligationOverlays.push({
        code: "domain_registration_obligations",
        legalProvisionKeys: ["de_bsig.section_34"],
      });
      addUnresolved("unresolved_domain_registration_classification");
    }
    if (
      matchedNational.some((entity) => entity.classificationRule === "requires_land_law")
    ) {
      addUnresolved("unresolved_regional_administration");
    }

    if (unresolvedFactCodes.length > 0) outcome = "clarification_required";
  }

  const euEntityByCode = new Map(ruleSet.entityTypes.map((entity) => [entity.code, entity]));
  const nationalMappings = matchedNational.flatMap((entity) =>
    entity.mappings.map((mapping) => ({
      nationalEntityVersionKey: entity.versionKey,
      euEntityCode: mapping.euEntityCode,
      relationship: mapping.relationship,
    })),
  );
  const matchedEntityTypes = Array.from(
    new Set(nationalMappings.map((mapping) => mapping.euEntityCode)),
  )
    .map((code) => euEntityByCode.get(code))
    .filter((entity): entity is Nis2EntityType => Boolean(entity));
  const indirectExposure = evaluateIndirectExposure(context.facts);
  const appliedJurisdictionRules = profile && jurisdictionBasis
    ? profile.jurisdictionRules
        .filter((rule) => rule.basisCode === jurisdictionBasis)
        .map((rule) => ({
          basisCode: rule.basisCode,
          legalProvisionKey: rule.legalProvisionKey,
          authorityDecisionRequired: rule.authorityDecisionRequired ?? false,
        }))
    : [];

  return ruleEvaluationResultSchema.parse({
    schemaVersion: 4,
    evaluatorKind: "nis2_scope_v3",
    evaluatorVersion: 3,
    outcome,
    reasonCodes:
      unresolvedFactCodes.length > 0
        ? unresolvedFactCodes
        : scopeBases.map((item) => item.code),
    releaseVersion: ruleSet.releaseVersion,
    scopeModelVersion: ruleSet.scopeModelVersion,
    thresholdSetVersion: ruleSet.thresholdSetVersion,
    profileVersionKey: profile?.versionKey ?? null,
    jurisdiction: {
      euActivity,
      countryCode: countryCode && countryCode !== "unsure" ? countryCode : null,
      basisCode:
        jurisdictionBasis && jurisdictionBasis !== "unsure" ? jurisdictionBasis : null,
    },
    sizeClassification,
    matchedEntityTypes,
    scopeBases,
    unresolvedFactCodes,
    obligationOverlays,
    indirectExposure: {
      status: indirectExposure.status,
      reasonCodes: [
        context.facts.serves_critical_customers === "yes"
          ? "indirect_serves_regulated_customers"
          : null,
        context.facts.has_customer_security_evidence_requests === "yes"
          ? "indirect_security_evidence_requests"
          : null,
        indirectExposure.status === "unknown" ? "indirect_unknown" : null,
      ].filter((code): code is string => Boolean(code)),
    },
    decisiveFacts: context.facts,
    selectedCatalogCode: profile ? `country:${profile.countryCode}` : null,
    matchedNationalEntityTypes: matchedNational,
    nationalMappings,
    appliedProfilePolicyCodes: profile
      ? [profile.thresholdPolicy.aggregationRule, jurisdictionBasis]
          .filter((code): code is string => Boolean(code))
      : [],
    appliedProfileLegalProvisionKeys: profile?.thresholdPolicy.legalProvisionKeys ?? [],
    appliedJurisdictionRules,
    effectiveStateCodes: profile?.effectiveStates.map((state) => state.code) ?? [],
    effectiveStateDeclarations: profile?.effectiveStates ?? [],
  });
}

function classifyNationalEntityTypes(
  entityTypes: Nis2NationalEntityType[],
  size: RuleEvaluationResult["sizeClassification"],
): { outcome: Nis2Outcome; basisCode: string | null } {
  const rules = new Set(entityTypes.map((entity) => entity.classificationRule));
  if (rules.has("always_particularly_important") || rules.has("federal_administration")) {
    return { outcome: "essential_entity", basisCode: "de_size_independent_particularly_important" };
  }
  if (rules.has("always_important")) {
    return { outcome: "important_entity", basisCode: "de_size_independent_important" };
  }
  if (rules.has("telecom")) {
    if (size === "large" || size === "medium") {
      return { outcome: "essential_entity", basisCode: "de_telecom_medium_or_large" };
    }
    if (size === "small") {
      return { outcome: "important_entity", basisCode: "de_telecom_small" };
    }
  }
  if (rules.has("annex_1_standard")) {
    if (size === "large") return { outcome: "essential_entity", basisCode: "de_annex_1_large" };
    if (size === "medium") return { outcome: "important_entity", basisCode: "de_annex_1_medium" };
    if (size === "small") return { outcome: "not_directly_in_scope", basisCode: "de_below_size_cap" };
  }
  if (rules.has("annex_2_standard")) {
    if (size === "large" || size === "medium") {
      return { outcome: "important_entity", basisCode: "de_annex_2_medium_or_large" };
    }
    if (size === "small") return { outcome: "not_directly_in_scope", basisCode: "de_below_size_cap" };
  }
  return { outcome: "clarification_required", basisCode: null };
}

function calculateSizeWithVerification(
  facts: Record<string, unknown>,
  thresholds: Nis2ScopeRuleSetDocument["thresholds"],
  acceptedVerificationCodes: string[],
): RuleEvaluationResult["sizeClassification"] {
  if (!acceptedVerificationCodes.includes(readNullableString(facts.sme_figures_verified) ?? "")) {
    return "unknown";
  }
  return calculateSizeBuckets(facts, thresholds);
}

function evaluateLegacyRuleSet(
  ruleSet: Nis2ScopeRuleSetDocument,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const euActivity = readSingle(context.facts.eu_activity, [
    "yes",
    "no",
    "unsure",
  ]) as "yes" | "no" | "unsure";
  const countryCode = readNullableString(context.facts.jurisdiction_country);
  const jurisdictionBasis = readNullableString(
    context.facts.jurisdiction_basis,
  );
  const selectedCodes = readStringArray(context.facts.nis2_entity_types);
  const runtimeEntityTypes: EvaluableEntityType[] = ruleSet.entityTypes.map(
    (entityType) => ({
      ...entityType,
      label: entityType.code,
      labelEn: entityType.code,
      legalReference: entityType.legalProvisionKeys.join(", "),
    }),
  );
  const entityByCode = new Map(
    runtimeEntityTypes.map((entityType) => [entityType.code, entityType]),
  );
  const matchedEntityTypes = selectedCodes
    .map((code) => entityByCode.get(code))
    .filter((entityType): entityType is EvaluableEntityType => Boolean(entityType));
  const designation = readNullableString(
    context.facts.member_state_designation,
  );
  const isGermanCriticalInstallation =
    designation === "de_critical_installation" && countryCode === "DE";
  const sizeClassification = calculateSize(context.facts, ruleSet.thresholds);
  const countryProfile = countryCode
    ? ruleSet.countryProfiles[countryCode]
    : undefined;
  const v3CountryProfile = ruleSet.kind === "nis2_scope_v3" && countryCode
    ? ruleSet.countryProfiles[countryCode]
    : undefined;
  const scopeBases: ScopeBasis[] = [];
  const obligationOverlays: ScopeBasis[] = [];
  const unresolvedFacts: string[] = [];
  const unresolvedFactsEn: string[] = [];
  const unresolvedFactCodes: string[] = [];

  const addUnresolved = (de: string, en: string) => {
    if (!unresolvedFacts.includes(de)) {
      unresolvedFacts.push(de);
      unresolvedFactsEn.push(en);
      unresolvedFactCodes.push(unresolvedCode(en));
    }
  };

  let outcome: Nis2Outcome = "clarification_required";

  if (euActivity === "no") {
    outcome = "not_directly_in_scope";
    scopeBases.push(
      basis(
        "outside_eu_activity",
        "Die Organisation erbringt nach ihren Angaben keine relevanten Dienste und übt keine relevanten Tätigkeiten in der EU aus.",
        "According to the answers, the organization does not provide relevant services or carry out relevant activities in the EU.",
        ARTICLE_2_REFERENCE,
      ),
    );
  } else if (euActivity === "unsure") {
    addUnresolved(
      "Es ist unklar, ob relevante Dienste oder Tätigkeiten innerhalb der EU erbracht werden.",
      "It is unclear whether relevant services or activities are provided within the EU.",
    );
  } else {
    if (!countryCode || countryCode === "unsure") {
      addUnresolved(
        "Der zuständige Mitgliedstaat konnte nicht bestimmt werden.",
        "The competent Member State could not be determined.",
      );
    }

    if (!jurisdictionBasis || jurisdictionBasis === "unsure") {
      addUnresolved(
        "Die Grundlage der EU-Zuständigkeit ist unklar.",
        "The basis for EU jurisdiction is unclear.",
      );
    }

    if (selectedCodes.includes("unsure")) {
      addUnresolved(
        "Die konkrete Einrichtungsart nach Anhang I oder II ist unklar.",
        "The exact entity type under Annex I or II is unclear.",
      );
    }
    if (
      matchedEntityTypes.some(
        (entityType) => entityType.rule === "regional_public_administration",
      ) &&
      !["essential", "important", "cer_critical"].includes(
        designation ?? "",
      )
    ) {
      addUnresolved(
        "Bei einer regionalen Verwaltungseinrichtung muss die nationale risikobasierte Einstufung geprüft werden.",
        "For a regional public-administration entity, the national risk-based classification must be checked.",
      );
    }

    if (designation === "unsure") {
      addUnresolved(
        "Eine mögliche behördliche Einstufung oder CER-Benennung muss geprüft werden.",
        "A possible authority classification or CER designation must be checked.",
      );
    }
    if (designation === "de_critical_installation" && countryCode !== "DE") {
      addUnresolved(
        "Die deutsche Einstufung als Betreiber einer kritischen Anlage passt nicht zum ausgewählten Mitgliedstaat.",
        "The German critical-installation classification does not match the selected Member State.",
      );
    }

    for (const entityType of matchedEntityTypes) {
      if (entityType.rule === "domain_registration") {
        obligationOverlays.push(
          basis(
            "domain_registration_obligations",
            "Für Anbieter von Domänennamenregistrierungsdiensten gelten eigenständige NIS2-Pflichten; die Einordnung als wesentliche oder wichtige Einrichtung folgt daraus nicht automatisch.",
            "Providers of domain-name registration services have specific NIS2 duties; this alone does not automatically classify them as essential or important entities.",
            "Directive (EU) 2022/2555, Articles 2(4), 3(3) and 28",
          ),
        );
      }
    }

    const sectorSpecificRegime = readNullableString(
      context.facts.sector_specific_regime,
    );
    if (sectorSpecificRegime === "dora") {
      obligationOverlays.push(
        basis(
          "dora_lex_specialis",
          "Für das Finanzunternehmen können DORA-Regelungen NIS2-Pflichten als sektorspezifischer Rechtsakt ersetzen.",
          "For the financial entity, DORA may replace NIS2 duties as a sector-specific Union legal act.",
          "Directive (EU) 2022/2555, Article 4; German BSIG § 28(6)",
        ),
      );
    } else if (sectorSpecificRegime === "de_telecom_energy") {
      obligationOverlays.push(
        basis(
          "de_telecom_energy_overlay",
          "Für deutsche Telekommunikations- oder Energieunternehmen können sektorspezifische Vorschriften einzelne BSIG-Pflichten ersetzen.",
          "For German telecom or energy entities, sector-specific provisions may replace individual BSIG duties.",
          "German BSIG § 28(5)",
        ),
      );
    } else if (sectorSpecificRegime === "other") {
      obligationOverlays.push(
        basis(
          "other_sector_specific_regime",
          "Ein weiteres sektorspezifisches Regelwerk wurde angegeben und muss bei der Pflichtenprüfung berücksichtigt werden.",
          "Another sector-specific regime was reported and must be considered when assessing duties.",
          "Directive (EU) 2022/2555, Article 4",
        ),
      );
    } else if (sectorSpecificRegime === "unsure") {
      obligationOverlays.push(
        basis(
          "sector_specific_regime_unknown",
          "Es ist unklar, ob ein sektorspezifisches Regelwerk einzelne Pflichten ersetzt.",
          "It is unclear whether a sector-specific regime replaces individual duties.",
          "Directive (EU) 2022/2555, Article 4",
        ),
      );
    }

    const sizeDependentEntities = matchedEntityTypes.filter((entityType) =>
      ["standard", "telecom"].includes(entityType.rule),
    );
    const hasSizeIndependentEssential =
      designation === "essential" ||
      designation === "cer_critical" ||
      isGermanCriticalInstallation ||
      matchedEntityTypes.some((entityType) =>
        [
          "always_essential",
          "central_public_administration",
        ].includes(entityType.rule),
      );

    if (
      sizeDependentEntities.length > 0 &&
      sizeClassification === "unknown" &&
      !hasSizeIndependentEssential
    ) {
      addUnresolved(
        "Die rechtlich maßgebliche Unternehmensgröße ist nicht verlässlich bestimmt.",
        "The legally relevant enterprise size has not been determined reliably.",
      );
    }

    if (
      designation === "essential" ||
      designation === "cer_critical" ||
      isGermanCriticalInstallation
    ) {
      outcome = "essential_entity";
      scopeBases.push(
        basis(
          designation === "cer_critical"
            ? "cer_critical_designation"
            : designation === "de_critical_installation"
              ? "de_critical_installation"
            : "member_state_essential_designation",
          designation === "cer_critical"
            ? "Die Organisation wurde als kritische Einrichtung nach der CER-Richtlinie benannt."
            : designation === "de_critical_installation"
              ? "Die Organisation betreibt eine kritische Anlage und gilt nach deutschem BSIG als besonders wichtige Einrichtung."
            : "Die Organisation wurde von einem Mitgliedstaat als wesentliche Einrichtung eingestuft.",
          designation === "cer_critical"
            ? "The organization has been designated as a critical entity under the CER Directive."
            : designation === "de_critical_installation"
              ? "The organization operates a critical installation and is a particularly important entity under the German BSIG."
            : "The organization has been classified as an essential entity by a Member State.",
          designation === "de_critical_installation"
            ? "German BSIG § 28(1)(1)"
            : ARTICLE_3_REFERENCE,
        ),
      );
    } else {
      outcome = classifyEntityTypes(
        matchedEntityTypes,
        sizeClassification,
        scopeBases,
      );

      if (designation === "important" && outcome !== "essential_entity") {
        outcome = "important_entity";
        scopeBases.push(
          basis(
            "member_state_important_designation",
            "Die Organisation wurde von einem Mitgliedstaat als wichtige Einrichtung eingestuft.",
            "The organization has been classified as an important entity by a Member State.",
            ARTICLE_3_REFERENCE,
          ),
        );
      }
    }

    const onlyDomainRegistration =
      matchedEntityTypes.length > 0 &&
      matchedEntityTypes.every(
        (entityType) => entityType.rule === "domain_registration",
      );
    const explicitlyNoEntityType = selectedCodes.includes("none_of_these");

    if (
      outcome === "clarification_required" &&
      unresolvedFacts.length === 0 &&
      !onlyDomainRegistration &&
      (explicitlyNoEntityType || matchedEntityTypes.length === 0)
    ) {
      if (countryProfile?.allowNegativeConclusion) {
        outcome = "not_directly_in_scope";
        scopeBases.push(
          basis(
            "no_covered_entity_type",
            "Es wurde keine erfasste Einrichtungsart und keine besondere Benennung angegeben.",
            "No covered entity type or special designation was reported.",
            ARTICLE_2_REFERENCE,
          ),
        );
      } else {
        addUnresolved(
          "Für diesen Mitgliedstaat ist noch kein unterstütztes nationales Profil vorhanden; nationale Erweiterungen müssen geprüft werden.",
          "No supported national profile exists for this Member State yet; national additions must be checked.",
        );
      }
    }

    if (onlyDomainRegistration && outcome === "clarification_required") {
      addUnresolved(
        "Die speziellen Pflichten für Domänennamenregistrierungsdienste sind anwendbar; eine zusätzliche nationale Einordnung muss geprüft werden.",
        "The specific duties for domain-name registration services apply; any additional national classification must be checked.",
      );
    }

    if (
      unresolvedFacts.length > 0 &&
      outcome !== "essential_entity"
    ) {
      outcome = "clarification_required";
    }

    if (
      outcome === "not_directly_in_scope" &&
      !countryProfile?.allowNegativeConclusion
    ) {
      outcome = "clarification_required";
      addUnresolved(
        "Ein negatives Ergebnis ist erst mit einem unterstützten nationalen Profil möglich.",
        "A negative conclusion requires a supported national profile.",
      );
    }
  }

  const indirectExposure = evaluateIndirectExposure(context.facts);
  const reasons: string[] = [];
  const reasonsEn: string[] = [];

  return ruleEvaluationResultSchema.parse({
    schemaVersion: ruleSet.kind === "nis2_scope_v3" ? 4 : 3,
    outcome,
    reasonCodes: scopeBases.length > 0 ? scopeBases.map((item) => item.code) : unresolvedFactCodes,
    releaseVersion: ruleSet.releaseVersion,
    evaluatorKind: ruleSet.kind,
    evaluatorVersion: ruleSet.evaluatorSchemaVersion,
    scopeModelVersion: ruleSet.scopeModelVersion,
    thresholdSetVersion: ruleSet.thresholdSetVersion,
    profileVersionKey: countryProfile?.versionKey ?? null,
    label: outcome,
    labelEn: outcome,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Die Angaben reichen für keine belastbare Einstufung aus."],
    reasonsEn:
      reasonsEn.length > 0
        ? reasonsEn
        : ["The supplied information is insufficient for a reliable classification."],
    ruleSetVersion: ruleSet.evaluatorSchemaVersion,
    profileVersion: ruleSet.scopeModelVersion,
    disclaimer: ruleSet.disclaimerContentKey,
    disclaimerEn: ruleSet.disclaimerContentKey,
    jurisdiction: {
      euActivity,
      countryCode:
        countryCode && countryCode !== "unsure" ? countryCode : null,
      basis:
        jurisdictionBasis && jurisdictionBasis !== "unsure"
          ? jurisdictionBasis
          : null,
      basisCode:
        jurisdictionBasis && jurisdictionBasis !== "unsure"
          ? jurisdictionBasis
          : null,
      countryProfileVersion: countryProfile?.versionKey ?? null,
    },
    sizeClassification,
    matchedEntityTypes: matchedEntityTypes.map((entityType) => ({
      code: entityType.code,
      versionKey: entityType.versionKey,
      sectorCode: entityType.sectorCode,
      annex: entityType.annex,
      legalProvisionKeys: entityType.legalProvisionKeys,
      label: entityType.label,
      labelEn: entityType.labelEn,
      legalReference: entityType.legalReference,
    })),
    scopeBases: scopeBases.map(toEvidenceBasis),
    unresolvedFactCodes,
    unresolvedFacts,
    unresolvedFactsEn,
    obligationOverlays: obligationOverlays.map(toEvidenceBasis),
    indirectExposure: {
      status: indirectExposure.status,
      reasonCodes: [
        context.facts.serves_critical_customers === "yes" ? "indirect_serves_regulated_customers" : null,
        context.facts.has_customer_security_evidence_requests === "yes" ? "indirect_security_evidence_requests" : null,
        indirectExposure.status === "unknown" ? "indirect_unknown" : null,
      ].filter((code): code is string => Boolean(code)),
    },
    decisiveFacts: context.facts,
    ...(ruleSet.kind === "nis2_scope_v3"
      ? {
          selectedCatalogCode: countryProfile ? `country:${countryProfile.countryCode}` : "eu_core",
          matchedNationalEntityTypes: [],
          nationalMappings: [],
          appliedProfilePolicyCodes: v3CountryProfile
            ? [v3CountryProfile.thresholdPolicy.aggregationRule]
            : [],
          effectiveStateCodes: v3CountryProfile?.effectiveStates.map((state) => state.code) ?? [],
        }
      : {}),
  });
}

function classifyEntityTypes(
  entityTypes: EvaluableEntityType[],
  size: RuleEvaluationResult["sizeClassification"],
  scopeBases: ScopeBasis[],
): Nis2Outcome {
  const addEntityBasis = (
    entityType: EvaluableEntityType,
    code: string,
    description: string,
    descriptionEn: string,
  ) => {
    scopeBases.push(
      basis(code, description, descriptionEn, entityType.legalReference),
    );
  };

  const alwaysEssential = entityTypes.find((entityType) =>
    ["always_essential", "central_public_administration"].includes(
      entityType.rule,
    ),
  );
  if (alwaysEssential) {
    addEntityBasis(
      alwaysEssential,
      "size_independent_essential",
      `${alwaysEssential.label} ist unabhängig von der Unternehmensgröße als wesentliche Einrichtung erfasst.`,
      `${alwaysEssential.labelEn} is covered as an essential entity regardless of enterprise size.`,
    );
    return "essential_entity";
  }

  const annexOneLarge = entityTypes.find(
    (entityType) =>
      entityType.annex === 1 &&
      entityType.rule === "standard" &&
      size === "large",
  );
  if (annexOneLarge) {
    addEntityBasis(
      annexOneLarge,
      "annex_i_large",
      `${annexOneLarge.label} fällt in Anhang I und überschreitet die Schwellen für mittlere Unternehmen.`,
      `${annexOneLarge.labelEn} falls under Annex I and exceeds the medium-enterprise ceilings.`,
    );
    return "essential_entity";
  }

  const telecom = entityTypes.find(
    (entityType) => entityType.rule === "telecom",
  );
  if (telecom && (size === "medium" || size === "large")) {
    addEntityBasis(
      telecom,
      "telecom_medium_or_large",
      `${telecom.label} ist bei mittlerer oder großer Unternehmensgröße eine wesentliche Einrichtung.`,
      `${telecom.labelEn} is an essential entity when medium-sized or large.`,
    );
    return "essential_entity";
  }

  const alwaysImportant = entityTypes.find(
    (entityType) => entityType.rule === "always_important",
  );
  if (alwaysImportant) {
    addEntityBasis(
      alwaysImportant,
      "size_independent_important",
      `${alwaysImportant.label} ist unabhängig von der Unternehmensgröße als wichtige Einrichtung erfasst.`,
      `${alwaysImportant.labelEn} is covered as an important entity regardless of enterprise size.`,
    );
    return "important_entity";
  }

  if (telecom && size === "small") {
    addEntityBasis(
      telecom,
      "telecom_small",
      `${telecom.label} ist auch unterhalb der mittleren Unternehmensgröße als wichtige Einrichtung erfasst.`,
      `${telecom.labelEn} remains an important entity below the medium-enterprise threshold.`,
    );
    return "important_entity";
  }

  const annexMedium = entityTypes.find(
    (entityType) =>
      entityType.rule === "standard" &&
      entityType.annex !== null &&
      (size === "medium" || size === "large"),
  );
  if (annexMedium) {
    addEntityBasis(
      annexMedium,
      annexMedium.annex === 1 ? "annex_i_medium" : "annex_ii_medium_or_large",
      `${annexMedium.label} fällt in Anhang ${annexMedium.annex} und erreicht die maßgebliche Unternehmensgröße.`,
      `${annexMedium.labelEn} falls under Annex ${annexMedium.annex} and reaches the relevant enterprise size.`,
    );
    return "important_entity";
  }

  const regionalPublicAdministration = entityTypes.find(
    (entityType) => entityType.rule === "regional_public_administration",
  );
  if (regionalPublicAdministration) {
    return "clarification_required";
  }

  const smallEntity = entityTypes.find(
    (entityType) =>
      entityType.rule === "standard" &&
      entityType.annex !== null &&
      size === "small",
  );
  if (smallEntity) {
    addEntityBasis(
      smallEntity,
      "below_size_cap",
      `${smallEntity.label} fällt zwar unter Anhang ${smallEntity.annex}, erreicht aber nicht die allgemeine Größenschwelle.`,
      `${smallEntity.labelEn} falls under Annex ${smallEntity.annex} but does not reach the general size threshold.`,
    );
    return "not_directly_in_scope";
  }

  if (entityTypes.some((entityType) => entityType.rule !== "domain_registration")) {
    return "clarification_required";
  }

  return "clarification_required";
}

function calculateSize(
  facts: Record<string, unknown>,
  thresholds: ReturnType<typeof parseRuleSetDocument>["thresholds"],
): RuleEvaluationResult["sizeClassification"] {
  if (facts.sme_figures_verified !== "yes") {
    return "unknown";
  }

  return calculateSizeBuckets(facts, thresholds);
}

function calculateSizeBuckets(
  facts: Record<string, unknown>,
  thresholds: Nis2ScopeRuleSetDocument["thresholds"],
): RuleEvaluationResult["sizeClassification"] {

  const employees = readNullableString(facts.employee_count_bucket);
  const revenue = readNullableString(facts.annual_revenue_bucket);
  const balance = readNullableString(facts.balance_sheet_total_bucket);

  if (
    !employees ||
    !revenue ||
    !balance ||
    [employees, revenue, balance].includes("unsure")
  ) {
    return "unknown";
  }

  const large =
    employees === thresholds.buckets.employees.large ||
    (revenue === thresholds.buckets.turnover.large &&
      balance === thresholds.buckets.balanceSheet.large);
  if (large) {
    return "large";
  }

  const medium =
    employees === thresholds.buckets.employees.medium ||
    (thresholds.buckets.turnover.medium.includes(revenue) &&
      thresholds.buckets.balanceSheet.medium.includes(balance));

  return medium ? "medium" : "small";
}

function evaluateIndirectExposure(
  facts: Record<string, unknown>,
): InternalIndirectExposure {
  const criticalCustomers = readNullableString(facts.serves_critical_customers);
  const evidenceRequests = readNullableString(
    facts.has_customer_security_evidence_requests,
  );
  const reasons: string[] = [];
  const reasonsEn: string[] = [];

  if (criticalCustomers === "yes") {
    reasons.push(
      "Die Organisation erbringt Leistungen für Kunden in NIS2-relevanten Bereichen.",
    );
    reasonsEn.push(
      "The organization provides services to customers in NIS2-relevant sectors.",
    );
  }
  if (evidenceRequests === "yes") {
    reasons.push(
      "Kunden fordern bereits Nachweise zur Informationssicherheit an.",
    );
    reasonsEn.push(
      "Customers already request information-security evidence.",
    );
  }

  if (reasons.length > 0) {
    return { status: "signals_present", reasons, reasonsEn };
  }

  if (criticalCustomers === "unsure" || evidenceRequests === "unsure") {
    return {
      status: "unknown",
      reasons: ["Die indirekte Lieferkettenbetroffenheit ist unklar."],
      reasonsEn: ["Indirect supply-chain exposure is unclear."],
    };
  }

  return { status: "none", reasons: [], reasonsEn: [] };
}

function basis(
  code: string,
  description: string,
  descriptionEn: string,
  legalReference: string | null,
): ScopeBasis {
  return { code, description, descriptionEn, legalReference };
}

function toEvidenceBasis(item: ScopeBasis) {
  return {
    code: item.code,
    legalProvisionKeys: item.legalReference
      ? item.legalReference.split(",").map((value) => normalizeLegalProvisionKey(value.trim())).filter(Boolean)
      : [],
  };
}

function normalizeLegalProvisionKey(reference: string) {
  if (reference.startsWith("eu_") || reference.startsWith("de_")) return reference;
  if (reference.includes("Article 26")) return "eu_nis2.article_26";
  if (reference.includes("Article 28")) return "eu_nis2.article_28";
  if (reference.includes("Article 2(4)")) return "eu_nis2.article_2_4";
  if (reference.includes("Article 2")) return "eu_nis2.article_2";
  if (reference.includes("Article 3")) return "eu_nis2.article_3";
  if (reference.includes("Article 4")) return "eu_nis2.article_4";
  if (reference.includes("2003/361")) return "eu_sme_recommendation.annex_article_2";
  if (reference.includes("28(1)(1)")) return "de_bsig.section_28_1_1";
  if (reference.includes("28(5)")) return "de_bsig.section_28_5";
  if (reference.includes("28(6)")) return "de_bsig.section_28_6";
  return `reference.${toStableCode(reference)}`;
}

function toStableCode(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_|_$/g, "");
}

function unresolvedCode(value: string) {
  if (value.includes("relevant services or activities")) return "unresolved_eu_activity";
  if (value.includes("competent Member State")) return "unresolved_country";
  if (value.includes("basis for EU jurisdiction")) return "unresolved_jurisdiction_basis";
  if (value.includes("exact entity type")) return "unresolved_entity_type";
  if (value.includes("regional public-administration")) return "unresolved_regional_administration";
  if (value.includes("authority classification or CER")) return "unresolved_designation";
  if (value.includes("German critical-installation")) return "unresolved_german_designation_country";
  if (value.includes("enterprise size")) return "unresolved_size";
  if (value.includes("No supported national profile")) return "unresolved_unsupported_profile";
  if (value.includes("domain-name registration")) return "unresolved_domain_registration_classification";
  if (value.includes("negative conclusion")) return "unresolved_negative_profile_required";
  return `unresolved_${toStableCode(value)}`;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSingle(value: unknown, allowed: string[]): string {
  return typeof value === "string" && allowed.includes(value) ? value : "unsure";
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return typeof value === "string" && value.length > 0 ? [value] : [];
}

export const nis2LegalReferences = {
  article2: ARTICLE_2_REFERENCE,
  article3: ARTICLE_3_REFERENCE,
  article26: ARTICLE_26_REFERENCE,
  sme: SME_REFERENCE,
};
