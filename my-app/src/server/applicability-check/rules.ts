import type { RuleEvaluationResult } from "./rule-evaluation-schema";
import {
  parseRuleSetDocument,
  type Nis2EntityType,
  type Nis2Outcome,
} from "./rule-set-schema";

export type { RuleEvaluationResult } from "./rule-evaluation-schema";

export type RuleEvaluationContext = {
  facts: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

type ScopeBasis = RuleEvaluationResult["scopeBases"][number];

const ARTICLE_2_REFERENCE = "Directive (EU) 2022/2555, Article 2";
const ARTICLE_3_REFERENCE = "Directive (EU) 2022/2555, Article 3";
const ARTICLE_26_REFERENCE = "Directive (EU) 2022/2555, Article 26";
const SME_REFERENCE = "Recommendation 2003/361/EC, Annex, Article 2";

export function evaluateRuleSet(
  ruleSetRules: unknown,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const ruleSet = parseRuleSetDocument(ruleSetRules);
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
  const entityByCode = new Map(
    ruleSet.entityTypes.map((entityType) => [entityType.code, entityType]),
  );
  const matchedEntityTypes = selectedCodes
    .map((code) => entityByCode.get(code))
    .filter((entityType): entityType is Nis2EntityType => Boolean(entityType));
  const designation = readNullableString(
    context.facts.member_state_designation,
  );
  const isGermanCriticalInstallation =
    designation === "de_critical_installation" && countryCode === "DE";
  const sizeClassification = calculateSize(context.facts);
  const countryProfile = countryCode
    ? ruleSet.countryProfiles[countryCode]
    : undefined;
  const scopeBases: ScopeBasis[] = [];
  const obligationOverlays: ScopeBasis[] = [];
  const unresolvedFacts: string[] = [];
  const unresolvedFactsEn: string[] = [];

  const addUnresolved = (de: string, en: string) => {
    if (!unresolvedFacts.includes(de)) {
      unresolvedFacts.push(de);
      unresolvedFactsEn.push(en);
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

  const outcomeLabels = ruleSet.outcomes[outcome];
  const reasons =
    scopeBases.length > 0
      ? scopeBases.map((item) => item.description)
      : unresolvedFacts;
  const reasonsEn =
    scopeBases.length > 0
      ? scopeBases.map((item) => item.descriptionEn)
      : unresolvedFactsEn;

  return {
    schemaVersion: 2,
    outcome,
    label: outcomeLabels.label,
    labelEn: outcomeLabels.labelEn,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Die Angaben reichen für keine belastbare Einstufung aus."],
    reasonsEn:
      reasonsEn.length > 0
        ? reasonsEn
        : ["The supplied information is insufficient for a reliable classification."],
    ruleSetVersion: ruleSet.version,
    profileVersion: ruleSet.profileVersion,
    disclaimer: ruleSet.disclaimer,
    disclaimerEn: ruleSet.disclaimerEn,
    jurisdiction: {
      euActivity,
      countryCode:
        countryCode && countryCode !== "unsure" ? countryCode : null,
      basis:
        jurisdictionBasis && jurisdictionBasis !== "unsure"
          ? jurisdictionBasis
          : null,
      countryProfileVersion: countryProfile?.version ?? null,
    },
    sizeClassification,
    matchedEntityTypes: matchedEntityTypes.map((entityType) => ({
      code: entityType.code,
      sectorCode: entityType.sectorCode,
      annex: entityType.annex,
      label: entityType.label,
      labelEn: entityType.labelEn,
      legalReference: entityType.legalReference,
    })),
    scopeBases,
    unresolvedFacts,
    unresolvedFactsEn,
    obligationOverlays,
    indirectExposure: evaluateIndirectExposure(context.facts),
  };
}

function classifyEntityTypes(
  entityTypes: Nis2EntityType[],
  size: RuleEvaluationResult["sizeClassification"],
  scopeBases: ScopeBasis[],
): Nis2Outcome {
  const addEntityBasis = (
    entityType: Nis2EntityType,
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
): RuleEvaluationResult["sizeClassification"] {
  if (facts.sme_figures_verified !== "yes") {
    return "unknown";
  }

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
    employees === "250_plus" ||
    (revenue === "revenue_over_50m" && balance === "balance_over_43m");
  if (large) {
    return "large";
  }

  const medium =
    employees === "50_249" ||
    (revenue === "revenue_over_10m_to_50m" &&
      balance === "balance_over_10m_to_43m") ||
    (revenue === "revenue_over_10m_to_50m" &&
      balance === "balance_over_43m") ||
    (revenue === "revenue_over_50m" &&
      balance === "balance_over_10m_to_43m");

  return medium ? "medium" : "small";
}

function evaluateIndirectExposure(
  facts: Record<string, unknown>,
): RuleEvaluationResult["indirectExposure"] {
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
