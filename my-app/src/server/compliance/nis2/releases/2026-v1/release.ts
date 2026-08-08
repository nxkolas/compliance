import {
  nis2EntityTypes,
  nis2Questions,
  nis2ScopeRuleSet as legacyRuleSetSource,
  nis2SectorGroups,
} from "./release-source";
import { entityDefinitions } from "./entity-definitions";
import { buildGermanEntityCatalog } from "./de-profile";
import { buildGermanIncorporatedLegalInstruments } from "./legal-sources";
import type {
  FactDefinitionSource,
  FactOptionSource,
  LocalizedContentSource,
  Nis2ReleaseDefinition,
} from "../types";

const content = new Map<string, LocalizedContentSource>();

function addContent(stableKey: string, de: string, en: string) {
  content.set(stableKey, {
    stableKey,
    format: "plain_text",
    translations: { de, en },
  });
  return stableKey;
}

const facts: FactDefinitionSource[] = [
  fact("eu_activity", "enum", "Tätigkeit in der EU", "Activity in the EU", "Ob relevante Dienste oder Tätigkeiten innerhalb der EU erbracht werden.", "Whether relevant services or activities are provided within the EU."),
  fact("jurisdiction_country", "enum", "Zuständiger Mitgliedstaat", "Competent Member State", "Mitgliedstaat, dessen Zuständigkeit nach Artikel 26 geprüft wird.", "Member State whose jurisdiction is assessed under Article 26."),
  fact("jurisdiction_basis", "enum", "Grundlage der Zuständigkeit", "Jurisdiction basis", "Niederlassung, Dienstleistungsort, Hauptniederlassung oder EU-Vertreter.", "Establishment, service location, main establishment or EU representative."),
  fact("nis2_entity_types", "multi_enum", "NIS2-Einrichtungsarten", "NIS2 entity types", "Ausgewählte Tätigkeitsidentitäten, die auf die NIS2-Anhänge und Sonderfälle abgebildet werden.", "Selected activity identities mapped to NIS2 annex categories and special cases."),
  fact("member_state_designation", "enum", "Behördliche Einstufung", "Authority classification", "Formale Einstufung oder Benennung durch einen Mitgliedstaat.", "Formal classification or designation by a Member State."),
  fact("employee_count_bucket", "enum", "Mitarbeiterzahl", "Employee count", "Mitarbeiterzahl nach der KMU-Empfehlung.", "Employee count under the SME Recommendation."),
  fact("annual_revenue_bucket", "enum", "Jahresumsatz", "Annual turnover", "Jahresumsatz mit rechtlich exakten Schwellenwerten.", "Annual turnover using the exact legal thresholds."),
  fact("balance_sheet_total_bucket", "enum", "Jahresbilanzsumme", "Annual balance-sheet total", "Jahresbilanzsumme mit rechtlich exakten Schwellenwerten.", "Annual balance-sheet total using the exact legal thresholds."),
  fact("sme_figures_verified", "enum", "KMU-Größenwerte geprüft", "SME figures verified", "Ob die Größenwerte korrekt berechnet wurden oder keine Partner- oder verbundenen Unternehmen bestehen.", "Whether the size figures were calculated correctly or there are no partner or linked enterprises."),
];

function fact(
  key: string,
  dataType: FactDefinitionSource["dataType"],
  labelDe: string,
  labelEn: string,
  descriptionDe: string,
  descriptionEn: string,
): FactDefinitionSource {
  return {
    key,
    dataType,
    labelContentKey: addContent(`nis2.fact.${key}.label`, labelDe, labelEn),
    descriptionContentKey: addContent(`nis2.fact.${key}.description`, descriptionDe, descriptionEn),
    options: [],
  };
}

const sectors = nis2SectorGroups.map((sector) => ({
  code: sector.code,
  labelContentKey: addContent(
    `nis2.sector.${sector.code}.label`,
    sector.label,
    sector.labelEn,
  ),
}));

function entityProvisionKey(annex: 1 | 2 | null, reference: string) {
  if (annex === null) return "eu_nis2.article_2_4";
  return `eu_nis2.annex_${annex === 1 ? "i" : "ii"}_${reference
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_|_$/g, "")}`;
}

const entityTypes = nis2EntityTypes.map((entity) => {
  const definition = entityDefinitions[entity.code];
  if (!definition) throw new Error(`Missing reviewed entity definition ${entity.code}`);
  return ({
  code: entity.code,
  sectorCode: entity.sectorCode,
  annex: entity.annex,
  rule: entity.rule,
  labelContentKey: addContent(
    `nis2.entity.${entity.code}.label`,
    entity.label,
    entity.labelEn,
  ),
  descriptionContentKey: addContent(
    `nis2.entity.${entity.code}.description`,
    definition.de,
    definition.en,
  ),
  legalProvisionKeys: [
    entityProvisionKey(
      entity.annex,
      entity.legalReference.split(", ").at(-1) ?? "",
    ),
  ],
  });
});

const germanEntityCatalog = buildGermanEntityCatalog(addContent);

const questionOptionAuxContent: Record<string, { de: string; en: string }> = {
  "nis2.question.bc.activity.option.digital_msp.helper": {
    de: "Verwaltete IT-Dienste: kontinuierliche Verwaltung oder Betrieb der IKT-Systeme von Kunden. Einmalige Beratung oder reine Softwareentwicklung allein zählt für diese Option nicht.",
    en: "Managed IT services: ongoing management or operation of customers' ICT systems. One-off consulting or software development alone does not count for this option.",
  },
  "nis2.question.bc.activity.option.digital_mssp.helper": {
    de: "Verwaltete Sicherheitsdienste: kontinuierliche Verwaltung oder Betrieb von Cybersicherheitsdiensten für Kunden. Einmalige Beratung oder reine Softwareentwicklung allein zählt für diese Option nicht.",
    en: "Managed security services: ongoing management or operation of customers' cybersecurity services. One-off consulting or software development alone does not count for this option.",
  },
  "nis2.question.bc.activity.option.chemicals_manufacture_import.definition": {
    de: "Die Kategorie erfasst Hersteller oder Importeure chemischer Stoffe oder Gemische, die nach der REACH-Verordnung registrierungspflichtig sind und der NACE-Abteilung 20 zuzuordnen sind.",
    en: "This category covers manufacturers or importers of chemical substances or mixtures that are subject to registration under the REACH Regulation and fall under NACE division 20.",
  },
};

type BuiltQuestionOption = {
  stableValue: string;
  labelContentKey: string;
  metadata: Record<string, unknown>;
};

function questionOptions(
  question: (typeof nis2Questions)[number],
): BuiltQuestionOption[] {
  return question.options.map((option) => {
    const metadata = { ...(option.metadata ?? {}) } as Record<string, unknown>;
    for (const key of ["helperContentKey", "definitionContentKey"]) {
      const contentKey = metadata[key];
      if (typeof contentKey === "string" && !content.has(contentKey)) {
        const aux = questionOptionAuxContent[contentKey];
        if (!aux) throw new Error(`Missing auxiliary content ${contentKey}`);
        addContent(contentKey, aux.de, aux.en);
      }
    }
    return {
      stableValue: option.stableValue,
      labelContentKey: addContent(
        `nis2.question.${question.stableKey}.option.${option.stableValue}`,
        option.label,
        option.labelEn,
      ),
      metadata,
    };
  });
}

type RegisteredFactOption = {
  catalogCode: FactOptionSource["catalogCode"];
  scopeEntityTypeCode?: string;
  jurisdictionEntityTypeCode?: string;
};

const factOptionRegistry = new Map<string, Map<string, RegisteredFactOption>>();

function registerFactOption(factKey: string, value: unknown) {
  if (typeof value !== "string" || value.length === 0) return;
  const options =
    factOptionRegistry.get(factKey) ?? new Map<string, RegisteredFactOption>();
  if (!options.has(value)) {
    let registered: RegisteredFactOption = { catalogCode: "all" };
    if (
      factKey === "nis2_entity_types" &&
      germanEntityCatalog.some((entity) => entity.code === value)
    ) {
      registered = {
        catalogCode: "country:DE",
        jurisdictionEntityTypeCode: value,
      };
    }
    options.set(value, registered);
  }
  factOptionRegistry.set(factKey, options);
}

for (const question of nis2Questions) {
  const mappings = question.factMappings ?? [{ factKey: question.factKey }];
  for (const mapping of mappings) {
    for (const option of question.options) {
      if (mapping.byOption) {
        const mapped = mapping.byOption[option.stableValue];
        if (Array.isArray(mapped)) {
          for (const value of mapped) registerFactOption(mapping.factKey, value);
        } else {
          registerFactOption(mapping.factKey, mapped);
        }
      } else {
        registerFactOption(mapping.factKey, option.stableValue);
      }
    }
  }
}

for (const fact of facts) {
  const registered = factOptionRegistry.get(fact.key);
  if (!registered || registered.size === 0) {
    throw new Error(`Release fact ${fact.key} has no options`);
  }
  fact.options = [...registered.entries()].map(([stableValue, option]) => ({
    stableValue,
    catalogCode: option.catalogCode,
    scopeEntityTypeCode: option.scopeEntityTypeCode,
    jurisdictionEntityTypeCode: option.jurisdictionEntityTypeCode,
  }));
}

const questions = nis2Questions.map((question) => ({
  stableKey: question.stableKey,
  position: question.position,
  questionContentKey: addContent(
    `nis2.question.${question.stableKey}.text`,
    question.questionText,
    question.questionTextEn,
  ),
  helpContentKey:
    question.helpText && question.helpTextEn
      ? addContent(
          `nis2.question.${question.stableKey}.help`,
          question.helpText,
          question.helpTextEn,
        )
      : undefined,
  tooltipContentKey: addContent(
    `nis2.question.${question.stableKey}.tooltip`,
    question.tooltipText,
    question.tooltipTextEn,
  ),
  answerType: question.answerType,
  required: question.required,
  factKey: question.factKey,
  config: question.config,
  factMappings: (question.factMappings ?? [{ factKey: question.factKey }]).map(
    (mapping) => ({
      factKey: mapping.factKey,
      ...(mapping.byOption ? { byOption: mapping.byOption } : {}),
    }),
  ),
  options: questionOptions(question).map((option, index) => ({
    stableValue: option.stableValue,
    labelContentKey: option.labelContentKey,
    factOptionValue: option.stableValue,
    position: index + 1,
    metadata: option.metadata,
  })),
}));

const annexProvisionKeys = [...new Set(entityTypes.flatMap((entity) => entity.legalProvisionKeys))];
const nis2Provisions = [...new Set([
  "article_2",
  "article_2_4",
  "article_3",
  "article_4",
  "article_26",
  "article_28",
  ...annexProvisionKeys.map((key) => key.replace("eu_nis2.", "")),
])].map((code) => ({
  code,
  officialSourceUrl: `https://eur-lex.europa.eu/eli/dir/2022/2555/oj#${code}`,
  citationContentKey: addContent(
    `nis2.legal.eu_nis2.${code}.citation`,
    `Richtlinie (EU) 2022/2555, ${formatProvision(code, "de")}`,
    `Directive (EU) 2022/2555, ${formatProvision(code, "en")}`,
  ),
}));

const germanAnnexRowProvisions = [
  ...new Set(
    germanEntityCatalog.flatMap((entity) =>
      entity.legalProvisionKeys.filter((key) => key.startsWith("de_bsig.annex_")),
    ),
  ),
].map((key) => {
  const code = key.replace("de_bsig.", "");
  const annex = code.startsWith("annex_1_") ? 1 : 2;
  const locator = code.replace(`annex_${annex}_`, "").replaceAll("_", ".");
  return legalProvision(
    "de_bsig",
    code,
    `https://www.gesetze-im-internet.de/bsig_2025/anlage_${annex}.html`,
    `Anlage ${annex} Nummer ${locator}`,
    `Annex ${annex} point ${locator}`,
  );
});

function formatProvision(code: string, locale: "de" | "en") {
  if (code.startsWith("article_")) {
    const article = code.replace("article_", "").replaceAll("_", "(") + (code.split("_").length > 2 ? ")" : "");
    return `${locale === "de" ? "Artikel" : "Article"} ${article}`;
  }
  const [annex, ...point] = code.replace("annex_", "").split("_");
  return `${locale === "de" ? "Anhang" : "Annex"} ${annex.toUpperCase()}, ${point.join("(").replace(/$/, point.length > 1 ? ")" : "")}`;
}

const legalInstruments = [
  ...buildGermanIncorporatedLegalInstruments(addContent),
  {
    code: "eu_nis2",
    jurisdictionCode: "EU",
    instrumentType: "directive",
    versionLabel: "2022-2555-oj",
    officialIdentifier: "Directive (EU) 2022/2555",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    effectiveFrom: "2023-01-16",
    titleContentKey: addContent("nis2.legal.eu_nis2.title", "NIS2-Richtlinie", "NIS2 Directive"),
    provisions: nis2Provisions,
  },
  {
    code: "eu_sme_recommendation",
    jurisdictionCode: "EU",
    instrumentType: "recommendation",
    versionLabel: "2003-361",
    officialIdentifier: "Commission Recommendation 2003/361/EC",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/reco/2003/361/oj",
    titleContentKey: addContent("nis2.legal.eu_sme.title", "EU-KMU-Empfehlung", "EU SME Recommendation"),
    provisions: [legalProvision("eu_sme_recommendation", "annex_article_2", "https://eur-lex.europa.eu/eli/reco/2003/361/oj", "Anhang, Artikel 2", "Annex, Article 2")],
  },
  {
    code: "eu_cer",
    jurisdictionCode: "EU",
    instrumentType: "directive",
    versionLabel: "2022-2557-oj",
    officialIdentifier: "Directive (EU) 2022/2557",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2557/oj",
    titleContentKey: addContent("nis2.legal.eu_cer.title", "CER-Richtlinie", "CER Directive"),
    provisions: [legalProvision("eu_cer", "article_6", "https://eur-lex.europa.eu/eli/dir/2022/2557/oj", "Artikel 6", "Article 6")],
  },
  {
    code: "de_bsig",
    jurisdictionCode: "DE",
    instrumentType: "statute",
    versionLabel: "2025-12-02-amended-2026-03-11",
    officialIdentifier: "BSIG",
    officialSourceUrl: "https://www.gesetze-im-internet.de/bsig_2025/",
    effectiveFrom: "2025-12-06",
    titleContentKey: addContent("nis2.legal.de_bsig.title", "BSI-Gesetz", "German BSI Act"),
    provisions: [
      legalProvision("de_bsig", "section_28", "https://www.gesetze-im-internet.de/bsig_2025/__28.html", "§ 28", "Section 28"),
      legalProvision("de_bsig", "section_28_1_1", "https://www.gesetze-im-internet.de/bsig_2025/__28.html", "§ 28 Absatz 1 Nummer 1", "Section 28(1)(1)"),
      legalProvision("de_bsig", "section_28_5", "https://www.gesetze-im-internet.de/bsig_2025/__28.html", "§ 28 Absatz 5", "Section 28(5)"),
      legalProvision("de_bsig", "section_28_6", "https://www.gesetze-im-internet.de/bsig_2025/__28.html", "§ 28 Absatz 6", "Section 28(6)"),
      legalProvision("de_bsig", "section_2", "https://www.gesetze-im-internet.de/bsig_2025/__2.html", "§ 2", "Section 2"),
      legalProvision("de_bsig", "section_29", "https://www.gesetze-im-internet.de/bsig_2025/__29.html", "§ 29", "Section 29"),
      legalProvision("de_bsig", "section_34", "https://www.gesetze-im-internet.de/bsig_2025/__34.html", "§ 34", "Section 34"),
      legalProvision("de_bsig", "section_59", "https://www.gesetze-im-internet.de/bsig_2025/__59.html", "§ 59", "Section 59"),
      legalProvision("de_bsig", "section_60", "https://www.gesetze-im-internet.de/bsig_2025/__60.html", "§ 60", "Section 60"),
      legalProvision("de_bsig", "section_66", "https://www.gesetze-im-internet.de/bsig_2025/__66.html", "§ 66", "Section 66"),
      legalProvision("de_bsig", "annex_1", "https://www.gesetze-im-internet.de/bsig_2025/anlage_1.html", "Anlage 1", "Annex 1"),
      legalProvision("de_bsig", "annex_2", "https://www.gesetze-im-internet.de/bsig_2025/anlage_2.html", "Anlage 2", "Annex 2"),
      ...germanAnnexRowProvisions,
    ],
  },
  {
    code: "de_bsi_kritisv",
    jurisdictionCode: "DE",
    instrumentType: "regulation",
    versionLabel: "current-reviewed-2026-07-16",
    officialIdentifier: "BSI-Kritisverordnung",
    officialSourceUrl: "https://www.gesetze-im-internet.de/bsi-kritisv/BJNR095800016.html",
    titleContentKey: addContent("nis2.legal.de_bsi_kritisv.title", "BSI-Kritisverordnung", "German BSI Critical Infrastructure Regulation"),
    provisions: [
      legalProvision("de_bsi_kritisv", "section_12", "https://www.gesetze-im-internet.de/bsi-kritisv/__12.html", "§ 12", "Section 12"),
    ],
  },
  {
    code: "de_kritisdachg",
    jurisdictionCode: "DE",
    instrumentType: "statute",
    versionLabel: "official-reviewed-2026-07-16",
    officialIdentifier: "KRITIS-Dachgesetz",
    officialSourceUrl: "https://www.gesetze-im-internet.de/kritisdachg/BJNR0420B0026.html",
    titleContentKey: addContent("nis2.legal.de_kritisdachg.title", "KRITIS-Dachgesetz", "German Critical Infrastructure Umbrella Act"),
    provisions: [
      legalProvision("de_kritisdachg", "section_4", "https://www.gesetze-im-internet.de/kritisdachg/__4.html", "§ 4", "Section 4"),
      legalProvision("de_kritisdachg", "section_5", "https://www.gesetze-im-internet.de/kritisdachg/__5.html", "§ 5", "Section 5"),
    ],
  },
];

function legalProvision(instrument: string, code: string, url: string, de: string, en: string) {
  return {
    code,
    officialSourceUrl: url,
    citationContentKey: addContent(`nis2.legal.${instrument}.${code}.citation`, de, en),
  };
}

const outcomeContentKeys = Object.fromEntries(
  Object.entries(legacyRuleSetSource.outcomes).map(([code, labels]) => [
    code,
    addContent(`nis2.outcome.${code}.label`, labels.label, labels.labelEn),
  ]),
);

const reasonContentKeys = Object.fromEntries(
  [
    ["outside_eu_activity", "Keine relevante Tätigkeit in der EU.", "No relevant activity in the EU."],
    ["annex_i_large", "Tätigkeit nach Anhang I oberhalb der Schwelle für mittlere Unternehmen.", "Annex I activity above the medium-enterprise ceiling."],
    ["annex_i_medium", "Tätigkeit nach Anhang I mit mittlerer Unternehmensgröße.", "Annex I activity with medium enterprise size."],
    ["annex_ii_medium_or_large", "Tätigkeit nach Anhang II mit mittlerer oder großer Unternehmensgröße.", "Annex II activity with medium or large enterprise size."],
    ["below_size_cap", "Erfasste Tätigkeit unterhalb der allgemeinen Größenschwelle.", "Covered activity below the general size threshold."],
    ["size_independent_essential", "Größenunabhängig wesentliche Einrichtung.", "Essential entity irrespective of size."],
    ["size_independent_important", "Größenunabhängig wichtige Einrichtung.", "Important entity irrespective of size."],
    ["telecom_medium_or_large", "Telekommunikationsanbieter mittlerer oder großer Größe.", "Medium or large telecommunications provider."],
    ["telecom_small", "Telekommunikationsanbieter unterhalb der mittleren Größe.", "Telecommunications provider below medium size."],
    ["de_size_independent_particularly_important", "Nach deutschem BSIG größenunabhängig besonders wichtige Einrichtung.", "Particularly important entity under the German BSI Act irrespective of size."],
    ["de_size_independent_important", "Nach deutschem BSIG größenunabhängig wichtige Einrichtung.", "Important entity under the German BSI Act irrespective of size."],
    ["de_telecom_medium_or_large", "Deutscher Telekommunikationsanbieter oberhalb der mittleren Größenschwelle.", "German telecommunications provider at or above the medium-size threshold."],
    ["de_telecom_small", "Deutscher Telekommunikationsanbieter unterhalb der mittleren Größenschwelle.", "German telecommunications provider below the medium-size threshold."],
    ["de_annex_1_large", "Deutsche Anlage-1-Identität oberhalb der Schwelle für besonders wichtige Einrichtungen.", "German Annex-1 identity above the particularly-important-entity threshold."],
    ["de_annex_1_medium", "Deutsche Anlage-1-Identität mit mittlerer Unternehmensgröße.", "German Annex-1 identity with medium enterprise size."],
    ["de_annex_2_medium_or_large", "Deutsche Anlage-2-Identität mit mittlerer oder großer Unternehmensgröße.", "German Annex-2 identity with medium or large enterprise size."],
    ["de_below_size_cap", "Deutsche Annex-Identität unterhalb der allgemeinen Größenschwelle.", "German Annex identity below the general size threshold."],
    ["member_state_essential_designation", "Behördlich als wesentliche Einrichtung eingestuft.", "Classified by an authority as an essential entity."],
    ["member_state_important_designation", "Behördlich als wichtige Einrichtung eingestuft.", "Classified by an authority as an important entity."],
    ["cer_critical_designation", "Als kritische Einrichtung nach CER benannt.", "Designated as a critical entity under CER."],
    ["de_critical_installation", "Betreiber einer kritischen Anlage nach deutschem BSIG.", "Operator of a critical installation under the German BSI Act."],
    ["no_covered_entity_type", "Keine erfasste Einrichtungsart angegeben.", "No covered entity type reported."],
    ["domain_registration_obligations", "Besondere Pflichten für Domänennamenregistrierungsdienste.", "Specific duties for domain-name registration services."],
    ["dora_lex_specialis", "DORA kann als sektorspezifischer Rechtsakt vorgehen.", "DORA may prevail as a sector-specific act."],
    ["de_telecom_energy_overlay", "Sektorspezifische deutsche Vorschriften können einzelne Pflichten ersetzen.", "German sector rules may replace individual duties."],
    ["other_sector_specific_regime", "Ein weiteres sektorspezifisches Regelwerk ist zu berücksichtigen.", "Another sector-specific regime must be considered."],
    ["sector_specific_regime_unknown", "Das sektorspezifische Regelwerk ist unklar.", "The sector-specific regime is unclear."],
    ["unresolved_eu_activity", "Es ist unklar, ob relevante Tätigkeiten in der EU erbracht werden.", "It is unclear whether relevant activities are provided in the EU."],
    ["unresolved_country", "Der zuständige Mitgliedstaat ist unklar.", "The competent Member State is unclear."],
    ["unresolved_jurisdiction_basis", "Die Grundlage der EU-Zuständigkeit ist unklar.", "The basis for EU jurisdiction is unclear."],
    ["unresolved_entity_type", "Die konkrete Einrichtungsart ist unklar.", "The exact entity type is unclear."],
    ["unresolved_regional_administration", "Die nationale Risikoeinstufung der regionalen Verwaltung muss geprüft werden.", "The national risk classification for regional administration must be checked."],
    ["unresolved_designation", "Eine behördliche oder CER-Einstufung muss geprüft werden.", "An authority or CER designation must be checked."],
    ["unresolved_german_designation_country", "Die deutsche Einstufung passt nicht zum ausgewählten Mitgliedstaat.", "The German classification does not match the selected Member State."],
    ["unresolved_size", "Die rechtlich maßgebliche Unternehmensgröße ist unklar.", "The legally relevant enterprise size is unclear."],
    ["unresolved_size_aggregation", "Die deutschen Größen- und Aggregationsregeln wurden nicht belastbar bestätigt.", "The German size and aggregation rules were not confirmed reliably."],
    ["unresolved_profile_jurisdiction", "Die gewählte deutsche Zuständigkeitsgrundlage passt nicht zu allen ausgewählten Einrichtungsarten.", "The selected German jurisdiction basis does not apply to every selected entity identity."],
    ["unresolved_unsupported_profile", "Für diesen Mitgliedstaat fehlt ein unterstütztes nationales Profil.", "No supported national profile exists for this Member State."],
    ["unresolved_domain_registration_classification", "Die zusätzliche nationale Einordnung des Registrierungsdienstes muss geprüft werden.", "The additional national classification of the registration service must be checked."],
    ["unresolved_negative_profile_required", "Ein negatives Ergebnis erfordert ein unterstütztes nationales Profil.", "A negative conclusion requires a supported national profile."],
    ["indirect_serves_regulated_customers", "Die Organisation erbringt Leistungen für NIS2-relevante Kunden.", "The organization serves customers in NIS2-relevant sectors."],
    ["indirect_security_evidence_requests", "Kunden fordern Informationssicherheitsnachweise.", "Customers request information-security evidence."],
    ["indirect_unknown", "Die indirekte Lieferkettenbetroffenheit ist unklar.", "Indirect supply-chain exposure is unclear."],
  ].map(([code, de, en]) => [code, addContent(`nis2.reason.${code}`, de, en)]),
);

const disclaimerContentKey = addContent(
  "nis2.result.disclaimer",
  legacyRuleSetSource.disclaimer,
  legacyRuleSetSource.disclaimerEn,
);

const frameworkNameContentKey = addContent(
  "nis2.framework.name",
  "NIS2",
  "NIS2",
);
const frameworkDescriptionContentKey = addContent(
  "nis2.framework.description",
  "Rahmenwerk zur Prüfung der NIS2-Betroffenheit.",
  "Framework for assessing NIS2 applicability.",
);
const moduleNameContentKey = addContent(
  "nis2.module.betroffenheitscheck.name",
  "Betroffenheitscheck",
  "Applicability check",
);
const questionnaireTitleContentKey = addContent(
  "nis2.questionnaire.betroffenheitscheck.title",
  "NIS2-Betroffenheitscheck",
  "NIS2 applicability check",
);

export const nis2ReleaseDefinition: Nis2ReleaseDefinition = {
  checkCode: "nis2_applicability",
  versionLabel: "2026-v1",
  evaluatorKind: "nis2_scope_v3",
  evaluatorVersion: 3,
  defaultLocale: "de",
  effectiveFrom: "2026-03-17",
  requiredCorpusFamilies: ["nis2-eu-primary", "nis2-de-primary"],
  framework: {
    code: "nis2",
    nameContentKey: frameworkNameContentKey,
    descriptionContentKey: frameworkDescriptionContentKey,
  },
  module: {
    code: "betroffenheitscheck",
    nameContentKey: moduleNameContentKey,
    moduleType: "questionnaire",
    position: 10,
  },
  questionnaire: {
    code: "betroffenheitscheck",
    titleContentKey: questionnaireTitleContentKey,
  },
  content: [...content.values()],
  legalInstruments,
  sectors,
  entityTypes,
  facts,
  questions,
  thresholds: {
    code: "eu_sme_nis2",
    versionLabel: "2003-361-v1",
    mediumEmployeeThreshold: 50,
    mediumTurnoverThreshold: 10_000_000,
    mediumBalanceSheetThreshold: 10_000_000,
    largeEmployeeThreshold: 250,
    largeTurnoverThreshold: 50_000_000,
    largeBalanceSheetThreshold: 43_000_000,
    employeeComparison: "at_least",
    financialComparison: "both_above",
    legalProvisionKeys: ["eu_sme_recommendation.annex_article_2"],
    buckets: {
      employees: { medium: "50_249", large: "250_plus" },
      turnover: { medium: ["revenue_over_10m_to_50m", "revenue_over_50m"], large: "revenue_over_50m" },
      balanceSheet: { medium: ["balance_over_10m_to_43m", "balance_over_43m"], large: "balance_over_43m" },
    },
  },
  profiles: [
    {
      code: "de_nis2",
      countryCode: "DE",
      versionLabel: "de-bsig-2025-amended-2026-03",
      supported: true,
      allowNegativeConclusion: true,
      legalProvisionKeys: ["de_bsig.section_28", "de_bsig.annex_1", "de_bsig.annex_2"],
      designations: [
        { code: "de_critical_installation", outcomeCode: "essential_entity", legalProvisionKey: "de_bsig.section_28_1_1" },
      ],
      entityCatalog: germanEntityCatalog,
      unmappedEuEntityCodes: ["chemical_article_producer"],
      thresholdPolicy: {
        employeeMeasure: "annual_work_units",
        publicBodyRule: "exclude_recommendation_annex_article_3_4",
        aggregationRule: "recommendation_articles_3_to_6_with_de_it_independence_exception",
        negligibleActivityRule: "may_disregard",
        legalProvisionKeys: ["de_bsig.section_28", "eu_sme_recommendation.annex_article_2"],
      },
      jurisdictionRules: [
        { basisCode: "de_establishment", entityCodes: germanEntityCatalog.filter((entity) => !["de_bsig_dns_service_provider", "de_bsig_tld_registry", "de_bsig_domain_name_registry_service_provider", "de_bsig_cloud_service_provider", "de_bsig_data_centre_service_provider", "de_bsig_content_delivery_network_operator", "de_bsig_managed_service_provider", "de_bsig_managed_security_service_provider", "de_bsig_online_marketplace_provider", "de_bsig_online_search_engine_provider", "de_bsig_social_networking_platform_provider", "de_bsig_federal_authority", "de_bsig_federal_public_law_it_provider", "de_bsig_other_designated_federal_public_body", "de_bsig_regional_public_administration"].includes(entity.code)).map((entity) => entity.code), legalProvisionKey: "de_bsig.section_59" },
        { basisCode: "de_critical_installation_location", entityCodes: germanEntityCatalog.filter((entity) => entity.annex !== null).map((entity) => entity.code), legalProvisionKey: "de_bsig.section_59" },
        { basisCode: "de_federal_administration", entityCodes: ["de_bsig_federal_authority", "de_bsig_federal_public_law_it_provider", "de_bsig_other_designated_federal_public_body"], legalProvisionKey: "de_bsig.section_59" },
        { basisCode: "de_main_eu_establishment", entityCodes: germanEntityCatalog.filter((entity) => ["de_bsig_dns_service_provider", "de_bsig_tld_registry", "de_bsig_domain_name_registry_service_provider", "de_bsig_cloud_service_provider", "de_bsig_data_centre_service_provider", "de_bsig_content_delivery_network_operator", "de_bsig_managed_service_provider", "de_bsig_managed_security_service_provider", "de_bsig_online_marketplace_provider", "de_bsig_online_search_engine_provider", "de_bsig_social_networking_platform_provider"].includes(entity.code)).map((entity) => entity.code), legalProvisionKey: "de_bsig.section_60" },
        { basisCode: "de_eu_representative", entityCodes: germanEntityCatalog.filter((entity) => ["de_bsig_dns_service_provider", "de_bsig_tld_registry", "de_bsig_domain_name_registry_service_provider", "de_bsig_cloud_service_provider", "de_bsig_data_centre_service_provider", "de_bsig_content_delivery_network_operator", "de_bsig_managed_service_provider", "de_bsig_managed_security_service_provider", "de_bsig_online_marketplace_provider", "de_bsig_online_search_engine_provider", "de_bsig_social_networking_platform_provider"].includes(entity.code)).map((entity) => entity.code), legalProvisionKey: "de_bsig.section_60" },
        { basisCode: "de_bsi_discretion_absent_representative", entityCodes: germanEntityCatalog.filter((entity) => ["de_bsig_dns_service_provider", "de_bsig_tld_registry", "de_bsig_domain_name_registry_service_provider", "de_bsig_cloud_service_provider", "de_bsig_data_centre_service_provider", "de_bsig_content_delivery_network_operator", "de_bsig_managed_service_provider", "de_bsig_managed_security_service_provider", "de_bsig_online_marketplace_provider", "de_bsig_online_search_engine_provider", "de_bsig_social_networking_platform_provider"].includes(entity.code)).map((entity) => entity.code), legalProvisionKey: "de_bsig.section_60", authorityDecisionRequired: true },
        { basisCode: "nis2_telecom_service_location", entityCodes: ["de_bsig_public_telecom_network_operator", "de_bsig_publicly_available_telecom_service_provider"], legalProvisionKey: "eu_nis2.article_26" },
        { basisCode: "de_regional_public_administration", entityCodes: ["de_bsig_regional_public_administration"], legalProvisionKey: "de_bsig.section_2", authorityDecisionRequired: true },
      ],
      effectiveStates: [
        {
          code: "de_critical_installation_definition_regime",
          value: "pre_kritisdachg_regulation",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl: "https://www.gesetze-im-internet.de/bsig_2025/__66.html",
          legalProvisionKey: "de_bsig.section_66",
        },
        {
          code: "de_bsi_kritisv_section_12_repeal_trigger",
          value: "official_announcement_not_recorded_as_triggered",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl: "https://www.gesetze-im-internet.de/bsi-kritisv/__12.html",
          legalProvisionKey: "de_bsi_kritisv.section_12",
        },
        {
          code: "de_applicable_critical_installation_regulation",
          value: "bsi_kritisv_current_under_bsig_section_66",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl: "https://www.gesetze-im-internet.de/bsi-kritisv/BJNR095800016.html",
          legalProvisionKey: "de_bsig.section_66",
        },
        {
          code: "de_section_29_authority_order_evidence",
          value: "user_evidence_required_no_fixture_relies_on_individual_order",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl: "https://www.gesetze-im-internet.de/bsig_2025/__29.html",
          legalProvisionKey: "de_bsig.section_29",
        },
      ],
    },
  ],
  outcomeContentKeys,
  reasonContentKeys,
  disclaimerContentKey,
  fixtures: [
    { name: "annex-i-large", facts: fixtureFacts({ employee_count_bucket: "250_plus" }), expectedOutcome: "essential_entity" },
    { name: "annex-i-medium", facts: fixtureFacts({ employee_count_bucket: "50_249" }), expectedOutcome: "important_entity" },
    { name: "below-threshold", facts: fixtureFacts(), expectedOutcome: "not_directly_in_scope" },
    { name: "unsupported-negative", facts: fixtureFacts({ jurisdiction_country: "FR", nis2_entity_types: ["none_of_these"] }), expectedOutcome: "clarification_required" },
  ],
};

function fixtureFacts(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

export { nis2EntityTypes, nis2Questions } from "./release-source";
