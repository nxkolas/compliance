import {
  nis2EntityTypes,
  nis2Questions,
  nis2SectorGroups,
} from "./release-source";
import { buildGermanEntityCatalog } from "./de-profile";
import { buildGermanIncorporatedLegalInstruments } from "./legal-sources";
import type {
  FactDefinitionSource,
  FactOptionSource,
  Nis2ReleaseDefinition,
} from "../types";

const facts: FactDefinitionSource[] = [
  fact("eu_activity", "enum"),
  fact("jurisdiction_country", "enum"),
  fact("jurisdiction_basis", "enum"),
  fact("nis2_entity_types", "multi_enum"),
  fact("member_state_designation", "enum"),
  fact("employee_count_bucket", "enum"),
  fact("annual_revenue_bucket", "enum"),
  fact("balance_sheet_total_bucket", "enum"),
  fact("sme_figures_verified", "enum"),
];

function fact(
  key: string,
  dataType: FactDefinitionSource["dataType"],
): FactDefinitionSource {
  return {
    key,
    dataType,
    labelContentKey: `nis2.fact.${key}.label`,
    descriptionContentKey: `nis2.fact.${key}.description`,
    options: [],
  };
}

const sectors = nis2SectorGroups.map((sector) => ({
  code: sector.code,
  labelContentKey: `nis2.sector.${sector.code}.label`,
}));

const entityTypes = nis2EntityTypes.map((entity) => ({
  code: entity.code,
  sectorCode: entity.sectorCode,
  annex: entity.annex,
  rule: entity.rule,
  labelContentKey: `nis2.entity.${entity.code}.label`,
  descriptionContentKey: `nis2.entity.${entity.code}.description`,
  legalProvisionKeys: [entity.legalProvisionKey],
}));

const germanEntityCatalog = buildGermanEntityCatalog();

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
    return {
      stableValue: option.stableValue,
      labelContentKey: `nis2.question.${question.stableKey}.option.${option.stableValue}`,
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
          for (const value of mapped)
            registerFactOption(mapping.factKey, value);
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

const questions = nis2Questions.map((question) => {
  return {
    stableKey: question.stableKey,
    position: question.position,
    questionContentKey: `nis2.question.${question.stableKey}.text`,
    helpContentKey: `nis2.question.${question.stableKey}.help`,
    tooltipContentKey: `nis2.question.${question.stableKey}.tooltip`,
    answerType: question.answerType,
    required: question.required,
    factKey: question.factKey,
    config: question.config,
    factMappings: (
      question.factMappings ?? [{ factKey: question.factKey }]
    ).map((mapping) => ({
      factKey: mapping.factKey,
      ...(mapping.byOption ? { byOption: mapping.byOption } : {}),
    })),
    options: questionOptions(question).map((option, index) => ({
      stableValue: option.stableValue,
      labelContentKey: option.labelContentKey,
      factOptionValue: option.stableValue,
      position: index + 1,
      metadata: option.metadata,
    })),
  };
});

const annexProvisionKeys = [
  ...new Set(entityTypes.flatMap((entity) => entity.legalProvisionKeys)),
];
const nis2Provisions = [
  ...new Set([
    "article_2",
    "article_2_4",
    "article_3",
    "article_4",
    "article_26",
    "article_28",
    ...annexProvisionKeys.map((key) => key.replace("eu_nis2.", "")),
  ]),
].map((code) => ({
  code,
  officialSourceUrl: `https://eur-lex.europa.eu/eli/dir/2022/2555/oj#${code}`,
  citationContentKey: `nis2.legal.eu_nis2.${code}.citation`,
}));

const germanAnnexRowProvisions = [
  ...new Set(
    germanEntityCatalog.flatMap((entity) =>
      entity.legalProvisionKeys.filter((key) =>
        key.startsWith("de_bsig.annex_"),
      ),
    ),
  ),
].map((key) => {
  const code = key.replace("de_bsig.", "");
  const annex = code.startsWith("annex_1_") ? 1 : 2;
  return legalProvision(
    "de_bsig",
    code,
    `https://www.gesetze-im-internet.de/bsig_2025/anlage_${annex}.html`,
  );
});

const legalInstruments = [
  ...buildGermanIncorporatedLegalInstruments(),
  {
    code: "eu_nis2",
    jurisdictionCode: "EU",
    instrumentType: "directive",
    versionLabel: "2022-2555-oj",
    officialIdentifier: "Directive (EU) 2022/2555",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    effectiveFrom: "2023-01-16",
    titleContentKey: "nis2.legal.eu_nis2.title",
    provisions: nis2Provisions,
  },
  {
    code: "eu_sme_recommendation",
    jurisdictionCode: "EU",
    instrumentType: "recommendation",
    versionLabel: "2003-361",
    officialIdentifier: "Commission Recommendation 2003/361/EC",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/reco/2003/361/oj",
    titleContentKey: "nis2.legal.eu_sme.title",
    provisions: [
      legalProvision(
        "eu_sme_recommendation",
        "annex_article_2",
        "https://eur-lex.europa.eu/eli/reco/2003/361/oj",
      ),
    ],
  },
  {
    code: "eu_cer",
    jurisdictionCode: "EU",
    instrumentType: "directive",
    versionLabel: "2022-2557-oj",
    officialIdentifier: "Directive (EU) 2022/2557",
    officialSourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2557/oj",
    titleContentKey: "nis2.legal.eu_cer.title",
    provisions: [
      legalProvision(
        "eu_cer",
        "article_6",
        "https://eur-lex.europa.eu/eli/dir/2022/2557/oj",
      ),
    ],
  },
  {
    code: "de_bsig",
    jurisdictionCode: "DE",
    instrumentType: "statute",
    versionLabel: "2025-12-02-amended-2026-03-11",
    officialIdentifier: "BSIG",
    officialSourceUrl: "https://www.gesetze-im-internet.de/bsig_2025/",
    effectiveFrom: "2025-12-06",
    titleContentKey: "nis2.legal.de_bsig.title",
    provisions: [
      legalProvision(
        "de_bsig",
        "section_28",
        "https://www.gesetze-im-internet.de/bsig_2025/__28.html",
      ),
      legalProvision(
        "de_bsig",
        "section_28_1_1",
        "https://www.gesetze-im-internet.de/bsig_2025/__28.html",
      ),
      legalProvision(
        "de_bsig",
        "section_28_5",
        "https://www.gesetze-im-internet.de/bsig_2025/__28.html",
      ),
      legalProvision(
        "de_bsig",
        "section_28_6",
        "https://www.gesetze-im-internet.de/bsig_2025/__28.html",
      ),
      legalProvision(
        "de_bsig",
        "section_2",
        "https://www.gesetze-im-internet.de/bsig_2025/__2.html",
      ),
      legalProvision(
        "de_bsig",
        "section_29",
        "https://www.gesetze-im-internet.de/bsig_2025/__29.html",
      ),
      legalProvision(
        "de_bsig",
        "section_34",
        "https://www.gesetze-im-internet.de/bsig_2025/__34.html",
      ),
      legalProvision(
        "de_bsig",
        "section_59",
        "https://www.gesetze-im-internet.de/bsig_2025/__59.html",
      ),
      legalProvision(
        "de_bsig",
        "section_60",
        "https://www.gesetze-im-internet.de/bsig_2025/__60.html",
      ),
      legalProvision(
        "de_bsig",
        "section_66",
        "https://www.gesetze-im-internet.de/bsig_2025/__66.html",
      ),
      legalProvision(
        "de_bsig",
        "annex_1",
        "https://www.gesetze-im-internet.de/bsig_2025/anlage_1.html",
      ),
      legalProvision(
        "de_bsig",
        "annex_2",
        "https://www.gesetze-im-internet.de/bsig_2025/anlage_2.html",
      ),
      ...germanAnnexRowProvisions,
    ],
  },
  {
    code: "de_bsi_kritisv",
    jurisdictionCode: "DE",
    instrumentType: "regulation",
    versionLabel: "current-reviewed-2026-07-16",
    officialIdentifier: "BSI-Kritisverordnung",
    officialSourceUrl:
      "https://www.gesetze-im-internet.de/bsi-kritisv/BJNR095800016.html",
    titleContentKey: "nis2.legal.de_bsi_kritisv.title",
    provisions: [
      legalProvision(
        "de_bsi_kritisv",
        "section_12",
        "https://www.gesetze-im-internet.de/bsi-kritisv/__12.html",
      ),
    ],
  },
  {
    code: "de_kritisdachg",
    jurisdictionCode: "DE",
    instrumentType: "statute",
    versionLabel: "official-reviewed-2026-07-16",
    officialIdentifier: "KRITIS-Dachgesetz",
    officialSourceUrl:
      "https://www.gesetze-im-internet.de/kritisdachg/BJNR0420B0026.html",
    titleContentKey: "nis2.legal.de_kritisdachg.title",
    provisions: [
      legalProvision(
        "de_kritisdachg",
        "section_4",
        "https://www.gesetze-im-internet.de/kritisdachg/__4.html",
      ),
      legalProvision(
        "de_kritisdachg",
        "section_5",
        "https://www.gesetze-im-internet.de/kritisdachg/__5.html",
      ),
    ],
  },
];

function legalProvision(instrument: string, code: string, url: string) {
  return {
    code,
    officialSourceUrl: url,
    citationContentKey: `nis2.legal.${instrument}.${code}.citation`,
  };
}

const outcomeCodes = [
  "essential_entity",
  "important_entity",
  "not_directly_in_scope",
  "clarification_required",
] as const;

const outcomeContentKeys = Object.fromEntries(
  outcomeCodes.map((code) => [code, `nis2.outcome.${code}.label`]),
);

const reasonCodes = [
  "outside_eu_activity",
  "annex_i_large",
  "annex_i_medium",
  "annex_ii_medium_or_large",
  "below_size_cap",
  "size_independent_essential",
  "size_independent_important",
  "telecom_medium_or_large",
  "telecom_small",
  "de_size_independent_particularly_important",
  "de_size_independent_important",
  "de_telecom_medium_or_large",
  "de_telecom_small",
  "de_annex_1_large",
  "de_annex_1_medium",
  "de_annex_2_medium_or_large",
  "de_below_size_cap",
  "member_state_essential_designation",
  "member_state_important_designation",
  "cer_critical_designation",
  "de_critical_installation",
  "no_covered_entity_type",
  "domain_registration_obligations",
  "dora_lex_specialis",
  "de_telecom_energy_overlay",
  "other_sector_specific_regime",
  "sector_specific_regime_unknown",
  "unresolved_eu_activity",
  "unresolved_country",
  "unresolved_jurisdiction_basis",
  "unresolved_entity_type",
  "unresolved_regional_administration",
  "unresolved_designation",
  "unresolved_german_designation_country",
  "unresolved_size",
  "unresolved_size_aggregation",
  "unresolved_profile_jurisdiction",
  "unresolved_unsupported_profile",
  "unresolved_domain_registration_classification",
  "unresolved_negative_profile_required",
  "indirect_serves_regulated_customers",
  "indirect_security_evidence_requests",
  "indirect_unknown",
] as const;

const reasonContentKeys = Object.fromEntries(
  reasonCodes.map((code) => [code, `nis2.reason.${code}`]),
);

const disclaimerContentKey = "nis2.result.disclaimer";
const frameworkNameContentKey = "nis2.framework.name";
const frameworkDescriptionContentKey = "nis2.framework.description";
const moduleNameContentKey = "nis2.module.betroffenheitscheck.name";
const questionnaireTitleContentKey =
  "nis2.questionnaire.betroffenheitscheck.title";

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
      turnover: {
        medium: ["revenue_over_10m_to_50m", "revenue_over_50m"],
        large: "revenue_over_50m",
      },
      balanceSheet: {
        medium: ["balance_over_10m_to_43m", "balance_over_43m"],
        large: "balance_over_43m",
      },
    },
  },
  profiles: [
    {
      code: "de_nis2",
      countryCode: "DE",
      versionLabel: "de-bsig-2025-amended-2026-03",
      supported: true,
      allowNegativeConclusion: true,
      legalProvisionKeys: [
        "de_bsig.section_28",
        "de_bsig.annex_1",
        "de_bsig.annex_2",
      ],
      designations: [
        {
          code: "de_critical_installation",
          outcomeCode: "essential_entity",
          legalProvisionKey: "de_bsig.section_28_1_1",
        },
      ],
      entityCatalog: germanEntityCatalog,
      unmappedEuEntityCodes: ["chemical_article_producer"],
      thresholdPolicy: {
        employeeMeasure: "annual_work_units",
        publicBodyRule: "exclude_recommendation_annex_article_3_4",
        aggregationRule:
          "recommendation_articles_3_to_6_with_de_it_independence_exception",
        negligibleActivityRule: "may_disregard",
        legalProvisionKeys: [
          "de_bsig.section_28",
          "eu_sme_recommendation.annex_article_2",
        ],
      },
      jurisdictionRules: [
        {
          basisCode: "de_establishment",
          entityCodes: germanEntityCatalog
            .filter(
              (entity) =>
                ![
                  "de_bsig_dns_service_provider",
                  "de_bsig_tld_registry",
                  "de_bsig_domain_name_registry_service_provider",
                  "de_bsig_cloud_service_provider",
                  "de_bsig_data_centre_service_provider",
                  "de_bsig_content_delivery_network_operator",
                  "de_bsig_managed_service_provider",
                  "de_bsig_managed_security_service_provider",
                  "de_bsig_online_marketplace_provider",
                  "de_bsig_online_search_engine_provider",
                  "de_bsig_social_networking_platform_provider",
                  "de_bsig_federal_authority",
                  "de_bsig_federal_public_law_it_provider",
                  "de_bsig_other_designated_federal_public_body",
                  "de_bsig_regional_public_administration",
                ].includes(entity.code),
            )
            .map((entity) => entity.code),
          legalProvisionKey: "de_bsig.section_59",
        },
        {
          basisCode: "de_critical_installation_location",
          entityCodes: germanEntityCatalog
            .filter((entity) => entity.annex !== null)
            .map((entity) => entity.code),
          legalProvisionKey: "de_bsig.section_59",
        },
        {
          basisCode: "de_federal_administration",
          entityCodes: [
            "de_bsig_federal_authority",
            "de_bsig_federal_public_law_it_provider",
            "de_bsig_other_designated_federal_public_body",
          ],
          legalProvisionKey: "de_bsig.section_59",
        },
        {
          basisCode: "de_main_eu_establishment",
          entityCodes: germanEntityCatalog
            .filter((entity) =>
              [
                "de_bsig_dns_service_provider",
                "de_bsig_tld_registry",
                "de_bsig_domain_name_registry_service_provider",
                "de_bsig_cloud_service_provider",
                "de_bsig_data_centre_service_provider",
                "de_bsig_content_delivery_network_operator",
                "de_bsig_managed_service_provider",
                "de_bsig_managed_security_service_provider",
                "de_bsig_online_marketplace_provider",
                "de_bsig_online_search_engine_provider",
                "de_bsig_social_networking_platform_provider",
              ].includes(entity.code),
            )
            .map((entity) => entity.code),
          legalProvisionKey: "de_bsig.section_60",
        },
        {
          basisCode: "de_eu_representative",
          entityCodes: germanEntityCatalog
            .filter((entity) =>
              [
                "de_bsig_dns_service_provider",
                "de_bsig_tld_registry",
                "de_bsig_domain_name_registry_service_provider",
                "de_bsig_cloud_service_provider",
                "de_bsig_data_centre_service_provider",
                "de_bsig_content_delivery_network_operator",
                "de_bsig_managed_service_provider",
                "de_bsig_managed_security_service_provider",
                "de_bsig_online_marketplace_provider",
                "de_bsig_online_search_engine_provider",
                "de_bsig_social_networking_platform_provider",
              ].includes(entity.code),
            )
            .map((entity) => entity.code),
          legalProvisionKey: "de_bsig.section_60",
        },
        {
          basisCode: "de_bsi_discretion_absent_representative",
          entityCodes: germanEntityCatalog
            .filter((entity) =>
              [
                "de_bsig_dns_service_provider",
                "de_bsig_tld_registry",
                "de_bsig_domain_name_registry_service_provider",
                "de_bsig_cloud_service_provider",
                "de_bsig_data_centre_service_provider",
                "de_bsig_content_delivery_network_operator",
                "de_bsig_managed_service_provider",
                "de_bsig_managed_security_service_provider",
                "de_bsig_online_marketplace_provider",
                "de_bsig_online_search_engine_provider",
                "de_bsig_social_networking_platform_provider",
              ].includes(entity.code),
            )
            .map((entity) => entity.code),
          legalProvisionKey: "de_bsig.section_60",
          authorityDecisionRequired: true,
        },
        {
          basisCode: "nis2_telecom_service_location",
          entityCodes: [
            "de_bsig_public_telecom_network_operator",
            "de_bsig_publicly_available_telecom_service_provider",
          ],
          legalProvisionKey: "eu_nis2.article_26",
        },
        {
          basisCode: "de_regional_public_administration",
          entityCodes: ["de_bsig_regional_public_administration"],
          legalProvisionKey: "de_bsig.section_2",
          authorityDecisionRequired: true,
        },
      ],
      effectiveStates: [
        {
          code: "de_critical_installation_definition_regime",
          value: "pre_kritisdachg_regulation",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl:
            "https://www.gesetze-im-internet.de/bsig_2025/__66.html",
          legalProvisionKey: "de_bsig.section_66",
        },
        {
          code: "de_bsi_kritisv_section_12_repeal_trigger",
          value: "official_announcement_not_recorded_as_triggered",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl:
            "https://www.gesetze-im-internet.de/bsi-kritisv/__12.html",
          legalProvisionKey: "de_bsi_kritisv.section_12",
        },
        {
          code: "de_applicable_critical_installation_regulation",
          value: "bsi_kritisv_current_under_bsig_section_66",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl:
            "https://www.gesetze-im-internet.de/bsi-kritisv/BJNR095800016.html",
          legalProvisionKey: "de_bsig.section_66",
        },
        {
          code: "de_section_29_authority_order_evidence",
          value: "user_evidence_required_no_fixture_relies_on_individual_order",
          effectiveFrom: "2026-03-17",
          reviewedAt: "2026-07-16T00:00:00.000Z",
          officialSourceUrl:
            "https://www.gesetze-im-internet.de/bsig_2025/__29.html",
          legalProvisionKey: "de_bsig.section_29",
        },
      ],
    },
  ],
  outcomeContentKeys,
  reasonContentKeys,
  disclaimerContentKey,
  fixtures: [
    {
      name: "annex-i-large",
      facts: fixtureFacts({ employee_count_bucket: "250_plus" }),
      expectedOutcome: "essential_entity",
    },
    {
      name: "annex-i-medium",
      facts: fixtureFacts({ employee_count_bucket: "50_249" }),
      expectedOutcome: "important_entity",
    },
    {
      name: "below-threshold",
      facts: fixtureFacts(),
      expectedOutcome: "not_directly_in_scope",
    },
    {
      name: "unsupported-negative",
      facts: fixtureFacts({
        jurisdiction_country: "FR",
        nis2_entity_types: ["none_of_these"],
      }),
      expectedOutcome: "clarification_required",
    },
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
