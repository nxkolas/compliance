import { getVisibilityCondition } from "../../applicability-check/question-visibility";
import type { Nis2ReleaseDefinition } from "../nis2/releases/types";

const REQUIRED_LOCALES = ["de", "en"] as const;
const GENERIC_DESCRIPTION_PATTERNS = [
  /^Rechtlich definierte Einrichtungsart:/i,
  /^Legally defined entity type:/i,
];

export function validateReleaseDefinition(release: Nis2ReleaseDefinition) {
  const errors: string[] = [];
  if (release.requiredCorpusFamilies.length === 0) errors.push("At least one corpus family is required");
  if (new Set(release.requiredCorpusFamilies).size !== release.requiredCorpusFamilies.length) errors.push("Required corpus families must be unique");
  const contentByKey = uniqueMap(release.content, (item) => item.stableKey, "content", errors);
  const legalProvisionKeys = new Set<string>();
  const entityCodes = uniqueSet(release.entityTypes.map((item) => item.code), "entity type", errors);
  const factKeys = uniqueSet(release.facts.map((item) => item.key), "fact", errors);
  const questionKeys = uniqueSet(release.questions.map((item) => item.stableKey), "question", errors);
  const nationalCatalogByEntityCode = new Map<string, string>();
  for (const profile of release.profiles) {
    for (const entity of profile.entityCatalog) {
      if (nationalCatalogByEntityCode.has(entity.code)) {
        errors.push(`Duplicate national entity identity ${entity.code}`);
      }
      nationalCatalogByEntityCode.set(entity.code, `country:${profile.countryCode}`);
    }
  }

  if (release.questions.length !== 12) errors.push(`Expected 12 questions, found ${release.questions.length}`);
  if (release.entityTypes.length !== 70) errors.push(`Expected 70 application entity identities, found ${release.entityTypes.length}`);

  for (const item of release.content) {
    for (const locale of REQUIRED_LOCALES) {
      if (!item.translations[locale]?.trim()) errors.push(`Missing ${locale} translation for ${item.stableKey}`);
    }
  }

  for (const instrument of release.legalInstruments) {
    validateOfficialUrl(instrument.officialSourceUrl, `instrument ${instrument.code}`, errors);
    requireContent(contentByKey, instrument.titleContentKey, errors);
    for (const provision of instrument.provisions) {
      const key = `${instrument.code}.${provision.code}`;
      if (legalProvisionKeys.has(key)) errors.push(`Duplicate legal provision ${key}`);
      legalProvisionKeys.add(key);
      validateOfficialUrl(provision.officialSourceUrl, `provision ${key}`, errors);
      requireContent(contentByKey, provision.citationContentKey, errors);
    }
  }

  for (const entity of release.entityTypes) {
    requireContent(contentByKey, entity.labelContentKey, errors);
    const description = requireContent(contentByKey, entity.descriptionContentKey, errors);
    if (description && REQUIRED_LOCALES.some((locale) => GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description.translations[locale])))) {
      errors.push(`Generic entity description is not publishable: ${entity.code}`);
    }
    for (const key of entity.legalProvisionKeys) {
      if (!legalProvisionKeys.has(key)) errors.push(`Unknown legal provision ${key} for ${entity.code}`);
    }
  }

  for (const fact of release.facts) {
    requireContent(contentByKey, fact.labelContentKey, errors);
    requireContent(contentByKey, fact.descriptionContentKey, errors);
    uniqueSet(fact.options.map((option) => option.stableValue), `option for fact ${fact.key}`, errors);
    for (const option of fact.options) {
      if (option.scopeEntityTypeCode && !entityCodes.has(option.scopeEntityTypeCode)) errors.push(`Unknown entity ${option.scopeEntityTypeCode} for fact ${fact.key}`);
      if (option.scopeEntityTypeCode && option.jurisdictionEntityTypeCode) errors.push(`Fact option ${fact.key}.${option.stableValue} references two catalog identities`);
      if (option.scopeEntityTypeCode && option.catalogCode !== "eu_core") errors.push(`Invalid catalog ownership for EU fact option ${fact.key}.${option.stableValue}`);
      if (option.jurisdictionEntityTypeCode) {
        const expectedCatalog = nationalCatalogByEntityCode.get(option.jurisdictionEntityTypeCode);
        if (!expectedCatalog) errors.push(`Unknown national entity ${option.jurisdictionEntityTypeCode} for fact ${fact.key}`);
        if (expectedCatalog && option.catalogCode !== expectedCatalog) errors.push(`Invalid catalog ownership for national fact option ${fact.key}.${option.stableValue}`);
      }
    }
  }

  const seenQuestionKeys = new Set<string>();
  for (const question of [...release.questions].sort((left, right) => left.position - right.position)) {
    if (!factKeys.has(question.factKey)) errors.push(`Unknown fact ${question.factKey} for question ${question.stableKey}`);
    requireContent(contentByKey, question.questionContentKey, errors);
    if (question.helpContentKey) requireContent(contentByKey, question.helpContentKey, errors);
    const condition = getVisibilityCondition(question.config);
    if (condition && !seenQuestionKeys.has(condition.questionStableKey)) errors.push(`Question ${question.stableKey} references a non-prior visibility question ${condition.questionStableKey}`);
    seenQuestionKeys.add(question.stableKey);
    const fact = release.facts.find((candidate) => candidate.key === question.factKey);
    for (const option of question.options) {
      requireContent(contentByKey, option.labelContentKey, errors);
      if (!fact?.options.some((candidate) => candidate.stableValue === option.factOptionValue)) errors.push(`Question option ${question.stableKey}.${option.stableValue} has no fact option`);
      if (option.metadata && typeof option.metadata === "object" && "catalogCode" in option.metadata) errors.push(`Question option ${question.stableKey}.${option.stableValue} stores catalog ownership in metadata`);
    }
  }

  for (const profile of release.profiles) {
    for (const key of profile.legalProvisionKeys) if (!legalProvisionKeys.has(key)) errors.push(`Unknown legal provision ${key} for profile ${profile.code}`);
    for (const designation of profile.designations) if (!legalProvisionKeys.has(designation.legalProvisionKey)) errors.push(`Unknown designation provision ${designation.legalProvisionKey}`);
    uniqueSet(profile.entityCatalog.map((entity) => entity.code), `national entity for ${profile.code}`, errors);
    const mappedEuCodes = new Set<string>();
    for (const entity of profile.entityCatalog) {
      requireContent(contentByKey, entity.labelContentKey, errors);
      requireContent(contentByKey, entity.descriptionContentKey, errors);
      for (const key of entity.legalProvisionKeys) {
        if (!legalProvisionKeys.has(key)) errors.push(`Unknown national entity provision ${key} for ${entity.code}`);
      }
      uniqueSet(entity.mappings.map((mapping) => mapping.euEntityCode), `EU mapping for ${entity.code}`, errors);
      for (const mapping of entity.mappings) {
        mappedEuCodes.add(mapping.euEntityCode);
        if (!entityCodes.has(mapping.euEntityCode)) errors.push(`Unknown EU entity ${mapping.euEntityCode} mapped from ${entity.code}`);
      }
    }
    uniqueSet(profile.unmappedEuEntityCodes, `unmapped EU entity for ${profile.code}`, errors);
    for (const code of profile.unmappedEuEntityCodes) {
      if (!entityCodes.has(code)) errors.push(`Unknown unmapped EU entity ${code} for ${profile.code}`);
      if (mappedEuCodes.has(code)) errors.push(`EU entity ${code} is both mapped and unmapped for ${profile.code}`);
    }
    for (const code of entityCodes) {
      if (!mappedEuCodes.has(code) && !profile.unmappedEuEntityCodes.includes(code)) errors.push(`EU entity ${code} has no mapping coverage for ${profile.code}`);
    }
    if (profile.countryCode === "DE") {
      const statutoryCategories = new Set(profile.entityCatalog.flatMap((entity) => entity.statutoryCategoryCode?.startsWith("de_bsig_annex_") ? [entity.statutoryCategoryCode] : []));
      if (statutoryCategories.size !== 67) errors.push(`German profile must cover 67 Annex statutory categories, found ${statutoryCategories.size}`);
      for (const entity of profile.entityCatalog.filter((candidate) => candidate.statutoryCategoryCode?.startsWith("de_bsig_annex_"))) {
        if (!entity.legalProvisionKeys.some((key) => key === entity.statutoryCategoryCode?.replace("de_bsig_annex_", "de_bsig.annex_"))) {
          errors.push(`German entity ${entity.code} lacks its exact Annex-row provision`);
        }
      }
      const supportedOutOfAnnex = profile.entityCatalog.filter(
        (entity) => entity.annex === null && entity.classificationRule !== "requires_land_law",
      );
      if (supportedOutOfAnnex.length !== 4) errors.push(`German profile must contain four supported out-of-Annex identities, found ${supportedOutOfAnnex.length}`);
    }
    for (const key of profile.thresholdPolicy.legalProvisionKeys) {
      if (!legalProvisionKeys.has(key)) errors.push(`Unknown threshold-policy provision ${key} for ${profile.code}`);
    }
    const nationalEntityCodes = new Set(profile.entityCatalog.map((entity) => entity.code));
    for (const rule of profile.jurisdictionRules) {
      if (!legalProvisionKeys.has(rule.legalProvisionKey)) errors.push(`Unknown jurisdiction provision ${rule.legalProvisionKey} for ${profile.code}`);
      for (const code of rule.entityCodes) if (!nationalEntityCodes.has(code)) errors.push(`Unknown national entity ${code} in jurisdiction rule ${rule.basisCode}`);
    }
    uniqueSet(profile.effectiveStates.map((state) => state.code), `effective-state declaration for ${profile.code}`, errors);
    for (const state of profile.effectiveStates) {
      validateOfficialUrl(state.officialSourceUrl, `effective state ${profile.code}.${state.code}`, errors);
      if (!legalProvisionKeys.has(state.legalProvisionKey)) errors.push(`Unknown effective-state provision ${state.legalProvisionKey} for ${profile.code}`);
      if (state.effectiveFrom > release.effectiveFrom || (state.effectiveTo && state.effectiveTo < release.effectiveFrom)) {
        errors.push(`Effective state ${profile.code}.${state.code} is not effective on release date ${release.effectiveFrom}`);
      }
      if (state.reviewedAt.slice(0, 10) < state.effectiveFrom) {
        errors.push(`Effective state ${profile.code}.${state.code} was reviewed before it became effective`);
      }
    }
    if (profile.countryCode === "DE") {
      const requiredEffectiveStateCodes = [
        "de_critical_installation_definition_regime",
        "de_bsi_kritisv_section_12_repeal_trigger",
        "de_applicable_critical_installation_regulation",
        "de_section_29_authority_order_evidence",
      ];
      const effectiveStateCodes = new Set(profile.effectiveStates.map((state) => state.code));
      for (const code of requiredEffectiveStateCodes) {
        if (!effectiveStateCodes.has(code)) errors.push(`German profile is missing required effective state ${code}`);
      }
      const requiredJurisdictionBasisCodes = [
        "de_establishment",
        "de_critical_installation_location",
        "de_federal_administration",
        "de_main_eu_establishment",
        "de_eu_representative",
        "de_bsi_discretion_absent_representative",
        "nis2_telecom_service_location",
        "de_regional_public_administration",
      ];
      const jurisdictionBasisCodes = new Set(profile.jurisdictionRules.map((rule) => rule.basisCode));
      for (const code of requiredJurisdictionBasisCodes) {
        if (!jurisdictionBasisCodes.has(code)) errors.push(`German profile is missing required jurisdiction basis ${code}`);
      }
    }
  }

  if (!questionKeys.has("bc.eu_activity")) errors.push("Missing first jurisdiction question");
  const orderedFactKeys = [...release.questions]
    .sort((left, right) => left.position - right.position)
    .slice(0, 3)
    .map((question) => question.factKey);
  if (orderedFactKeys.join(",") !== "eu_activity,jurisdiction_country,nis2_entity_types") {
    errors.push("Country selection must precede entity selection");
  }
  for (const key of Object.values(release.outcomeContentKeys)) requireContent(contentByKey, key, errors);
  for (const key of Object.values(release.reasonContentKeys)) requireContent(contentByKey, key, errors);
  requireContent(contentByKey, release.disclaimerContentKey, errors);

  if (errors.length > 0) throw new Error(`Invalid compliance release:\n- ${errors.join("\n- ")}`);
}

function uniqueMap<T>(items: T[], key: (item: T) => string, label: string, errors: string[]) {
  const result = new Map<string, T>();
  for (const item of items) {
    const value = key(item);
    if (result.has(value)) errors.push(`Duplicate ${label} ${value}`);
    result.set(value, item);
  }
  return result;
}

function uniqueSet(values: string[], label: string, errors: string[]) {
  const result = new Set<string>();
  for (const value of values) {
    if (result.has(value)) errors.push(`Duplicate ${label} ${value}`);
    result.add(value);
  }
  return result;
}

function requireContent(content: Map<string, LocalizedContent>, key: string, errors: string[]) {
  const item = content.get(key);
  if (!item) errors.push(`Unknown content key ${key}`);
  return item;
}

type LocalizedContent = Nis2ReleaseDefinition["content"][number];

function validateOfficialUrl(value: string, label: string, errors: string[]) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`Official URL for ${label} must use HTTPS`);
  } catch {
    errors.push(`Invalid official URL for ${label}`);
  }
}
