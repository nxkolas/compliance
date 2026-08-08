import type { Nis2EntityRule } from "@/src/server/applicability-check/domain";

export type Nis2SourceEntityType = {
  code: string;
  sectorCode: string;
  annex: 1 | 2 | null;
  legalProvisionKey: string;
  rule: Nis2EntityRule;
};

export type Nis2QuestionOptionDefinition = {
  stableValue: string;
  metadata?: Record<string, unknown>;
};

export type Nis2QuestionFactMapping = {
  factKey: string;
  byOption?: Record<string, string | string[] | null>;
};

export type Nis2QuestionDefinition = {
  stableKey: string;
  position: number;
  answerType: "single_choice" | "multi_choice";
  required: boolean;
  options: Nis2QuestionOptionDefinition[];
  factKey: string;
  factMappings?: Nis2QuestionFactMapping[];
  config: Record<string, unknown>;
};

export const nis2SectorGroups = [
  {
    code: "energy",
  },
  {
    code: "transport",
  },
  {
    code: "banking",
  },
  {
    code: "financial_market_infrastructures",
  },
  {
    code: "health",
  },
  {
    code: "drinking_water",
  },
  {
    code: "waste_water",
  },
  {
    code: "digital_infrastructure",
  },
  {
    code: "ict_service_management",
  },
  {
    code: "public_administration",
  },
  {
    code: "space",
  },
  {
    code: "postal_courier",
  },
  {
    code: "waste_management",
  },
  {
    code: "chemicals",
  },
  {
    code: "food",
  },
  {
    code: "manufacturing",
  },
  {
    code: "digital_providers",
  },
  {
    code: "research",
  },
] as const;

export const nis2EntityTypes: Nis2SourceEntityType[] = [
  {
    code: "electricity_supplier",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "electricity_distribution_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "electricity_transmission_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "electricity_producer",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "electricity_market_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "electricity_flexibility_provider",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "recharging_point_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_a",
    rule: "standard",
  },
  {
    code: "district_heating_cooling_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_b",
    rule: "standard",
  },
  {
    code: "oil_pipeline_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_c",
    rule: "standard",
  },
  {
    code: "oil_facility_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_c",
    rule: "standard",
  },
  {
    code: "central_oil_stockholding_entity",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_c",
    rule: "standard",
  },
  {
    code: "gas_supply_undertaking",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "gas_distribution_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "gas_transmission_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "gas_storage_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "lng_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "natural_gas_undertaking",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "gas_refining_treatment_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_d",
    rule: "standard",
  },
  {
    code: "hydrogen_operator",
    sectorCode: "energy",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_1_e",
    rule: "standard",
  },
  {
    code: "air_carrier",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_a",
    rule: "standard",
  },
  {
    code: "airport_operator",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_a",
    rule: "standard",
  },
  {
    code: "air_traffic_management_provider",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_a",
    rule: "standard",
  },
  {
    code: "rail_infrastructure_manager",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_b",
    rule: "standard",
  },
  {
    code: "railway_undertaking",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_b",
    rule: "standard",
  },
  {
    code: "water_transport_company",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_c",
    rule: "standard",
  },
  {
    code: "port_operator",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_c",
    rule: "standard",
  },
  {
    code: "vessel_traffic_service",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_c",
    rule: "standard",
  },
  {
    code: "road_authority",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_d",
    rule: "standard",
  },
  {
    code: "intelligent_transport_system_operator",
    sectorCode: "transport",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_2_d",
    rule: "standard",
  },
  {
    code: "credit_institution",
    sectorCode: "banking",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_3",
    rule: "standard",
  },
  {
    code: "trading_venue_operator",
    sectorCode: "financial_market_infrastructures",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_4",
    rule: "standard",
  },
  {
    code: "central_counterparty",
    sectorCode: "financial_market_infrastructures",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_4",
    rule: "standard",
  },
  {
    code: "healthcare_provider",
    sectorCode: "health",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_5",
    rule: "standard",
  },
  {
    code: "eu_reference_laboratory",
    sectorCode: "health",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_5",
    rule: "standard",
  },
  {
    code: "medicinal_product_researcher",
    sectorCode: "health",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_5",
    rule: "standard",
  },
  {
    code: "pharmaceutical_manufacturer",
    sectorCode: "health",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_5",
    rule: "standard",
  },
  {
    code: "critical_medical_device_manufacturer",
    sectorCode: "health",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_5",
    rule: "standard",
  },
  {
    code: "drinking_water_supplier",
    sectorCode: "drinking_water",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_6",
    rule: "standard",
  },
  {
    code: "waste_water_undertaking",
    sectorCode: "waste_water",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_7",
    rule: "standard",
  },
  {
    code: "internet_exchange_point",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "standard",
  },
  {
    code: "dns_service_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "always_essential",
  },
  {
    code: "tld_registry",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "always_essential",
  },
  {
    code: "cloud_service_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "standard",
  },
  {
    code: "data_centre_service_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "standard",
  },
  {
    code: "content_delivery_network_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "standard",
  },
  {
    code: "qualified_trust_service_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "always_essential",
  },
  {
    code: "other_trust_service_provider",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "always_important",
  },
  {
    code: "public_electronic_communications_network",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "telecom",
  },
  {
    code: "public_electronic_communications_service",
    sectorCode: "digital_infrastructure",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_8",
    rule: "telecom",
  },
  {
    code: "domain_name_registration_service",
    sectorCode: "digital_infrastructure",
    annex: null,
    legalProvisionKey: "eu_nis2.article_2_4",
    rule: "domain_registration",
  },
  {
    code: "managed_service_provider",
    sectorCode: "ict_service_management",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_9",
    rule: "standard",
  },
  {
    code: "managed_security_service_provider",
    sectorCode: "ict_service_management",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_9",
    rule: "standard",
  },
  {
    code: "central_public_administration",
    sectorCode: "public_administration",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_10",
    rule: "central_public_administration",
  },
  {
    code: "regional_public_administration",
    sectorCode: "public_administration",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_10",
    rule: "regional_public_administration",
  },
  {
    code: "space_ground_infrastructure_operator",
    sectorCode: "space",
    annex: 1,
    legalProvisionKey: "eu_nis2.annex_i_11",
    rule: "standard",
  },
  {
    code: "postal_courier_provider",
    sectorCode: "postal_courier",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_1",
    rule: "standard",
  },
  {
    code: "waste_management_undertaking",
    sectorCode: "waste_management",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_2",
    rule: "standard",
  },
  {
    code: "chemical_manufacturer_distributor",
    sectorCode: "chemicals",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_3",
    rule: "standard",
  },
  {
    code: "chemical_article_producer",
    sectorCode: "chemicals",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_3",
    rule: "standard",
  },
  {
    code: "food_wholesale_industrial_business",
    sectorCode: "food",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_4",
    rule: "standard",
  },
  {
    code: "medical_device_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_a",
    rule: "standard",
  },
  {
    code: "computer_electronic_optical_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_b",
    rule: "standard",
  },
  {
    code: "electrical_equipment_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_c",
    rule: "standard",
  },
  {
    code: "machinery_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_d",
    rule: "standard",
  },
  {
    code: "motor_vehicle_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_e",
    rule: "standard",
  },
  {
    code: "other_transport_equipment_manufacturer",
    sectorCode: "manufacturing",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_5_f",
    rule: "standard",
  },
  {
    code: "online_marketplace_provider",
    sectorCode: "digital_providers",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_6",
    rule: "standard",
  },
  {
    code: "online_search_engine_provider",
    sectorCode: "digital_providers",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_6",
    rule: "standard",
  },
  {
    code: "social_networking_platform_provider",
    sectorCode: "digital_providers",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_6",
    rule: "standard",
  },
  {
    code: "research_organisation",
    sectorCode: "research",
    annex: 2,
    legalProvisionKey: "eu_nis2.annex_ii_7",
    rule: "standard",
  },
];

export const nis2Questions: Nis2QuestionDefinition[] = [
  {
    stableKey: "bc.germany_connection",
    position: 1,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "de_established",
      },
      {
        stableValue: "de_critical_installation",
      },
      {
        stableValue: "de_federal_administration",
      },
      {
        stableValue: "de_cross_border_digital_provider",
      },
      {
        stableValue: "de_telecom_provider",
      },
      {
        stableValue: "de_regional_administration",
      },
      {
        stableValue: "none",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "eu_activity",
    factMappings: [
      {
        factKey: "eu_activity",
        byOption: {
          de_established: "yes",
          de_critical_installation: "yes",
          de_federal_administration: "yes",
          de_cross_border_digital_provider: "yes",
          de_telecom_provider: "yes",
          de_regional_administration: "yes",
          none: "no",
          unsure: "unsure",
        },
      },
      {
        factKey: "jurisdiction_country",
        byOption: {
          de_established: "DE",
          de_critical_installation: "DE",
          de_federal_administration: "DE",
          de_cross_border_digital_provider: "DE",
          de_telecom_provider: "DE",
          de_regional_administration: "DE",
        },
      },
      {
        factKey: "jurisdiction_basis",
        byOption: {
          de_established: "de_establishment",
          de_critical_installation: "de_critical_installation_location",
          de_federal_administration: "de_federal_administration",
          de_cross_border_digital_provider: "de_main_eu_establishment",
          de_telecom_provider: "nis2_telecom_service_location",
          de_regional_administration: "de_regional_public_administration",
        },
      },
      {
        factKey: "member_state_designation",
        byOption: {
          de_critical_installation: "de_critical_installation",
        },
      },
      {
        factKey: "nis2_entity_types",
        byOption: {
          de_established: ["de_bsig_electricity_supplier"],
          de_critical_installation: ["de_bsig_electricity_supplier"],
          de_federal_administration: ["de_bsig_federal_authority"],
          de_cross_border_digital_provider: ["de_bsig_cloud_service_provider"],
          de_telecom_provider: [
            "de_bsig_public_telecom_network_operator",
            "de_bsig_publicly_available_telecom_service_provider",
          ],
          de_regional_administration: [
            "de_bsig_regional_public_administration",
          ],
        },
      },
      {
        factKey: "employee_count_bucket",
        byOption: {
          de_critical_installation: "under_50",
        },
      },
      {
        factKey: "annual_revenue_bucket",
        byOption: {
          de_critical_installation: "revenue_at_most_10m",
        },
      },
      {
        factKey: "balance_sheet_total_bucket",
        byOption: {
          de_critical_installation: "balance_at_most_10m",
        },
      },
      {
        factKey: "sme_figures_verified",
        byOption: {
          de_critical_installation: "verified_de_without_it_exception",
        },
      },
    ],
    config: {
      section: "jurisdiction",
      ui: {
        control: "wizard_choice",
      },
    },
  },
  {
    stableKey: "bc.special_status",
    position: 2,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "none",
      },
      {
        stableValue: "de_critical_installation",
      },
      {
        stableValue: "essential_or_cer",
      },
      {
        stableValue: "important",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "member_state_designation",
    factMappings: [
      {
        factKey: "member_state_designation",
        byOption: {
          none: "none",
          de_critical_installation: "de_critical_installation",
          essential_or_cer: "cer_critical",
          important: "important",
          unsure: "unsure",
        },
      },
      {
        factKey: "employee_count_bucket",
        byOption: {
          de_critical_installation: "under_50",
          essential_or_cer: "under_50",
        },
      },
      {
        factKey: "annual_revenue_bucket",
        byOption: {
          de_critical_installation: "revenue_at_most_10m",
          essential_or_cer: "revenue_at_most_10m",
        },
      },
      {
        factKey: "balance_sheet_total_bucket",
        byOption: {
          de_critical_installation: "balance_at_most_10m",
          essential_or_cer: "balance_at_most_10m",
        },
      },
      {
        factKey: "sme_figures_verified",
        byOption: {
          de_critical_installation: "verified_de_without_it_exception",
          essential_or_cer: "verified_de_without_it_exception",
        },
      },
    ],
    config: {
      section: "special_status",
      ui: {
        control: "wizard_choice",
      },
      visibleWhen: {
        questionStableKey: "bc.germany_connection",
        operator: "in",
        values: [
          "de_established",
          "de_cross_border_digital_provider",
          "de_telecom_provider",
        ],
      },
    },
  },
  {
    stableKey: "bc.sector",
    position: 3,
    answerType: "multi_choice",
    required: true,
    options: [
      {
        stableValue: "energy",
      },
      {
        stableValue: "transport",
      },
      {
        stableValue: "banking_financial",
      },
      {
        stableValue: "health",
      },
      {
        stableValue: "water",
      },
      {
        stableValue: "digital",
      },
      {
        stableValue: "space",
      },
      {
        stableValue: "waste",
      },
      {
        stableValue: "chemicals",
      },
      {
        stableValue: "food",
      },
      {
        stableValue: "manufacturing",
      },
      {
        stableValue: "research",
      },
      {
        stableValue: "none_of_these",
        metadata: {
          exclusive: true,
        },
      },
      {
        stableValue: "unsure",
        metadata: {
          exclusive: true,
        },
      },
    ],
    factKey: "nis2_entity_types",
    factMappings: [
      {
        factKey: "nis2_entity_types",
        byOption: {
          none_of_these: ["none_of_these"],
          unsure: ["unsure"],
        },
      },
    ],
    config: {
      section: "activity",
      ui: {
        control: "wizard_sections",
      },
      visibleWhen: {
        questionStableKey: "bc.germany_connection",
        operator: "equals",
        value: "de_established",
      },
    },
  },
  {
    stableKey: "bc.activity",
    position: 4,
    answerType: "multi_choice",
    required: true,
    options: [
      {
        stableValue: "energy_supply_networks",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_generation_storage_markets",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_district_heating_cooling",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_oil",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_gas_lng",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_hydrogen",
        metadata: {
          sectorCode: "energy",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "energy_none",
        metadata: {
          sectorCode: "energy",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "energy_unsure",
        metadata: {
          sectorCode: "energy",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "transport_air",
        metadata: {
          sectorCode: "transport",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "transport_rail",
        metadata: {
          sectorCode: "transport",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "transport_water",
        metadata: {
          sectorCode: "transport",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "transport_road_its",
        metadata: {
          sectorCode: "transport",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "transport_postal_courier",
        metadata: {
          sectorCode: "transport",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "transport_road_hitch",
        metadata: {
          sectorCode: "transport",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "transport_none",
        metadata: {
          sectorCode: "transport",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "transport_unsure",
        metadata: {
          sectorCode: "transport",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "banking_credit_institution",
        metadata: {
          sectorCode: "banking_financial",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "banking_trading_venue",
        metadata: {
          sectorCode: "banking_financial",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "banking_central_counterparty",
        metadata: {
          sectorCode: "banking_financial",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "banking_other_financial",
        metadata: {
          sectorCode: "banking_financial",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "banking_none",
        metadata: {
          sectorCode: "banking_financial",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "banking_unsure",
        metadata: {
          sectorCode: "banking_financial",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "health_patient_care",
        metadata: {
          sectorCode: "health",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_eu_reference_laboratory",
        metadata: {
          sectorCode: "health",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_pharma_research",
        metadata: {
          sectorCode: "health",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_pharma_manufacture",
        metadata: {
          sectorCode: "health",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_critical_medical_devices",
        metadata: {
          sectorCode: "health",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_other_medical_devices",
        metadata: {
          sectorCode: "health",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "health_none",
        metadata: {
          sectorCode: "health",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "health_unsure",
        metadata: {
          sectorCode: "health",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "water_drinking",
        metadata: {
          sectorCode: "water",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "water_wastewater",
        metadata: {
          sectorCode: "water",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "water_none",
        metadata: {
          sectorCode: "water",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "water_unsure",
        metadata: {
          sectorCode: "water",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "digital_ixp",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_cloud",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_data_centre",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_cdn",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_msp",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
          helperContentKey:
            "nis2.question.bc.activity.option.digital_msp.helper",
        },
      },
      {
        stableValue: "digital_mssp",
        metadata: {
          sectorCode: "digital",
          route: "A1",
          kind: "activity",
          exclusive: false,
          helperContentKey:
            "nis2.question.bc.activity.option.digital_mssp.helper",
        },
      },
      {
        stableValue: "digital_dns",
        metadata: {
          sectorCode: "digital",
          route: "E",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_tld_registry",
        metadata: {
          sectorCode: "digital",
          route: "E",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_qualified_trust",
        metadata: {
          sectorCode: "digital",
          route: "E",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_other_trust",
        metadata: {
          sectorCode: "digital",
          route: "I",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_telecom",
        metadata: {
          sectorCode: "digital",
          route: "T",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_marketplace",
        metadata: {
          sectorCode: "digital",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_search_engine",
        metadata: {
          sectorCode: "digital",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_social_network",
        metadata: {
          sectorCode: "digital",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_domain_registration",
        metadata: {
          sectorCode: "digital",
          route: "R",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "digital_software_only",
        metadata: {
          sectorCode: "digital",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "digital_none",
        metadata: {
          sectorCode: "digital",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "digital_unsure",
        metadata: {
          sectorCode: "digital",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "space_ground_infrastructure",
        metadata: {
          sectorCode: "space",
          route: "A1",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "space_manufacture",
        metadata: {
          sectorCode: "space",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "space_none",
        metadata: {
          sectorCode: "space",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "space_unsure",
        metadata: {
          sectorCode: "space",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "waste_main_activity",
        metadata: {
          sectorCode: "waste",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "waste_own_only",
        metadata: {
          sectorCode: "waste",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "waste_none",
        metadata: {
          sectorCode: "waste",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "waste_unsure",
        metadata: {
          sectorCode: "waste",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "chemicals_manufacture_import",
        metadata: {
          sectorCode: "chemicals",
          route: "A2",
          kind: "activity",
          exclusive: false,
          definitionContentKey:
            "nis2.question.bc.activity.option.chemicals_manufacture_import.definition",
        },
      },
      {
        stableValue: "chemicals_use_only",
        metadata: {
          sectorCode: "chemicals",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "chemicals_none",
        metadata: {
          sectorCode: "chemicals",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "chemicals_unsure",
        metadata: {
          sectorCode: "chemicals",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "food_wholesale",
        metadata: {
          sectorCode: "food",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "food_industrial",
        metadata: {
          sectorCode: "food",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "food_retail_only",
        metadata: {
          sectorCode: "food",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "food_none",
        metadata: {
          sectorCode: "food",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "food_unsure",
        metadata: {
          sectorCode: "food",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "manufacturing_medical_devices",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_computers",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_electrical",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_machinery",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_vehicles",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_other_transport",
        metadata: {
          sectorCode: "manufacturing",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "manufacturing_other_only",
        metadata: {
          sectorCode: "manufacturing",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "manufacturing_none",
        metadata: {
          sectorCode: "manufacturing",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "manufacturing_unsure",
        metadata: {
          sectorCode: "manufacturing",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
      {
        stableValue: "research_applied_commercial",
        metadata: {
          sectorCode: "research",
          route: "A2",
          kind: "activity",
          exclusive: false,
        },
      },
      {
        stableValue: "research_education_only",
        metadata: {
          sectorCode: "research",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "research_none",
        metadata: {
          sectorCode: "research",
          route: "NO",
          kind: "none",
          exclusive: true,
        },
      },
      {
        stableValue: "research_unsure",
        metadata: {
          sectorCode: "research",
          route: "NO",
          kind: "unsure",
          exclusive: true,
        },
      },
    ],
    factKey: "nis2_entity_types",
    factMappings: [
      {
        factKey: "nis2_entity_types",
        byOption: {
          energy_supply_networks: [
            "de_bsig_electricity_supplier",
            "de_bsig_electricity_distribution_operator",
            "de_bsig_electricity_transmission_operator",
          ],
          energy_generation_storage_markets: [
            "de_bsig_electricity_generation_installation_operator",
            "de_bsig_energy_storage_installation_operator",
            "de_bsig_electricity_aggregator",
            "de_bsig_balancing_service_provider",
            "de_bsig_nominated_electricity_market_operator",
            "de_bsig_recharging_point_operator",
          ],
          energy_district_heating_cooling: [
            "de_bsig_district_heating_cooling_operator",
          ],
          energy_oil: [
            "de_bsig_oil_transmission_pipeline_operator",
            "de_bsig_oil_facilities_operator",
            "de_bsig_central_oil_stockholding_entity",
          ],
          energy_gas_lng: [
            "de_bsig_gas_supplier",
            "de_bsig_gas_distribution_operator",
            "de_bsig_gas_transmission_operator",
            "de_bsig_gas_storage_operator",
            "de_bsig_lng_operator",
            "de_bsig_natural_gas_extraction_operator",
            "de_bsig_natural_gas_refining_treatment_operator",
          ],
          energy_hydrogen: ["de_bsig_hydrogen_operator"],
          energy_none: ["none_of_these"],
          energy_unsure: ["unsure"],
          transport_air: [
            "de_bsig_commercial_air_carrier",
            "de_bsig_airport_entity",
            "de_bsig_atm_ans_provider",
          ],
          transport_rail: [
            "de_bsig_rail_infrastructure_operator",
            "de_bsig_railway_undertaking",
          ],
          transport_water: [
            "de_bsig_water_transport_company",
            "de_bsig_port_entity",
            "de_bsig_waterway_safe_operation_system_operator",
          ],
          transport_road_its: [
            "de_bsig_road_traffic_influence_system_operator",
            "de_bsig_intelligent_transport_system_operator",
          ],
          transport_postal_courier: ["de_bsig_postal_courier_provider"],
          transport_road_hitch: null,
          transport_none: ["none_of_these"],
          transport_unsure: ["unsure"],
          banking_credit_institution: ["de_bsig_credit_institution"],
          banking_trading_venue: ["de_bsig_trading_venue"],
          banking_central_counterparty: ["de_bsig_central_counterparty"],
          banking_other_financial: null,
          banking_none: ["none_of_these"],
          banking_unsure: ["unsure"],
          health_patient_care: ["de_bsig_healthcare_provider"],
          health_eu_reference_laboratory: ["de_bsig_eu_reference_laboratory"],
          health_pharma_research: ["de_bsig_medicinal_product_researcher"],
          health_pharma_manufacture: ["de_bsig_pharmaceutical_manufacturer"],
          health_critical_medical_devices: [
            "de_bsig_emergency_critical_medical_device_manufacturer",
          ],
          health_other_medical_devices: [
            "de_bsig_medical_ivd_device_manufacturer",
          ],
          health_none: ["none_of_these"],
          health_unsure: ["unsure"],
          water_drinking: ["de_bsig_drinking_water_supply_operator"],
          water_wastewater: ["de_bsig_waste_water_undertaking"],
          water_none: ["none_of_these"],
          water_unsure: ["unsure"],
          digital_ixp: ["de_bsig_internet_exchange_point_operator"],
          digital_cloud: ["de_bsig_cloud_service_provider"],
          digital_data_centre: ["de_bsig_data_centre_service_provider"],
          digital_cdn: ["de_bsig_content_delivery_network_operator"],
          digital_msp: ["de_bsig_managed_service_provider"],
          digital_mssp: ["de_bsig_managed_security_service_provider"],
          digital_dns: ["de_bsig_dns_service_provider"],
          digital_tld_registry: ["de_bsig_tld_registry"],
          digital_qualified_trust: ["de_bsig_qualified_trust_service_provider"],
          digital_other_trust: ["de_bsig_non_qualified_trust_service_provider"],
          digital_telecom: [
            "de_bsig_public_telecom_network_operator",
            "de_bsig_publicly_available_telecom_service_provider",
          ],
          digital_marketplace: ["de_bsig_online_marketplace_provider"],
          digital_search_engine: ["de_bsig_online_search_engine_provider"],
          digital_social_network: [
            "de_bsig_social_networking_platform_provider",
          ],
          digital_domain_registration: [
            "de_bsig_domain_name_registry_service_provider",
          ],
          digital_software_only: null,
          digital_none: ["none_of_these"],
          digital_unsure: ["unsure"],
          space_ground_infrastructure: [
            "de_bsig_space_ground_infrastructure_operator",
          ],
          space_manufacture: [
            "de_bsig_nace30_other_transport_equipment_manufacturer",
          ],
          space_none: ["none_of_these"],
          space_unsure: ["unsure"],
          waste_main_activity: ["de_bsig_waste_management_undertaking"],
          waste_own_only: null,
          waste_none: ["none_of_these"],
          waste_unsure: ["unsure"],
          chemicals_manufacture_import: [
            "de_bsig_reach_registered_nace20_chemical_manufacturer_importer",
          ],
          chemicals_use_only: null,
          chemicals_none: ["none_of_these"],
          chemicals_unsure: ["unsure"],
          food_wholesale: ["de_bsig_food_wholesale_industrial_business"],
          food_industrial: ["de_bsig_food_wholesale_industrial_business"],
          food_retail_only: null,
          food_none: ["none_of_these"],
          food_unsure: ["unsure"],
          manufacturing_medical_devices: [
            "de_bsig_medical_ivd_device_manufacturer",
          ],
          manufacturing_computers: [
            "de_bsig_nace26_computer_electronic_optical_manufacturer",
          ],
          manufacturing_electrical: [
            "de_bsig_nace27_electrical_equipment_manufacturer",
          ],
          manufacturing_machinery: ["de_bsig_nace28_machinery_manufacturer"],
          manufacturing_vehicles: ["de_bsig_nace29_motor_vehicle_manufacturer"],
          manufacturing_other_transport: [
            "de_bsig_nace30_other_transport_equipment_manufacturer",
          ],
          manufacturing_other_only: null,
          manufacturing_none: ["none_of_these"],
          manufacturing_unsure: ["unsure"],
          research_applied_commercial: ["de_bsig_research_organisation"],
          research_education_only: null,
          research_none: ["none_of_these"],
          research_unsure: ["unsure"],
        },
      },
    ],
    config: {
      section: "activity",
      ui: {
        control: "wizard_sections",
      },
      visibleWhen: {
        any: [
          {
            questionStableKey: "bc.germany_connection",
            operator: "equals",
            value: "de_cross_border_digital_provider",
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_established",
              },
              {
                questionStableKey: "bc.sector",
                operator: "contains_any",
                values: [
                  "energy",
                  "transport",
                  "banking_financial",
                  "health",
                  "water",
                  "digital",
                  "space",
                  "waste",
                  "chemicals",
                  "food",
                  "manufacturing",
                  "research",
                ],
              },
            ],
          },
        ],
      },
      optionVisibility: {
        questionStableKey: "bc.sector",
        attribute: "sectorCode",
        fallbackValues: ["digital"],
      },
    },
  },
  {
    stableKey: "bc.employee_count",
    position: 5,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "under_50",
      },
      {
        stableValue: "50_249",
      },
      {
        stableValue: "250_plus",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "employee_count_bucket",
    config: {
      section: "size",
      ui: {
        control: "buttons",
      },
      visibleWhen: {
        any: [
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_telecom_provider",
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
            ],
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "in",
                values: ["de_established", "de_cross_border_digital_provider"],
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
              {
                questionStableKey: "bc.activity",
                operator: "route_in",
                values: ["T", "A1", "A2"],
              },
            ],
          },
        ],
      },
    },
  },
  {
    stableKey: "bc.annual_revenue",
    position: 6,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "revenue_at_most_10m",
      },
      {
        stableValue: "revenue_over_10m_to_50m",
      },
      {
        stableValue: "revenue_over_50m",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "annual_revenue_bucket",
    config: {
      section: "size",
      ui: {
        control: "buttons",
      },
      visibleWhen: {
        any: [
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_telecom_provider",
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
            ],
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "in",
                values: ["de_established", "de_cross_border_digital_provider"],
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
              {
                questionStableKey: "bc.activity",
                operator: "route_in",
                values: ["T", "A1", "A2"],
              },
            ],
          },
        ],
      },
    },
  },
  {
    stableKey: "bc.balance_sheet_total",
    position: 7,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "balance_at_most_10m",
      },
      {
        stableValue: "balance_over_10m_to_43m",
      },
      {
        stableValue: "balance_over_43m",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "balance_sheet_total_bucket",
    config: {
      section: "size",
      ui: {
        control: "buttons",
      },
      visibleWhen: {
        any: [
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_telecom_provider",
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
            ],
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "in",
                values: ["de_established", "de_cross_border_digital_provider"],
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
              {
                questionStableKey: "bc.activity",
                operator: "route_in",
                values: ["T", "A1", "A2"],
              },
            ],
          },
        ],
      },
    },
  },
  {
    stableKey: "bc.aggregation",
    position: 8,
    answerType: "single_choice",
    required: true,
    options: [
      {
        stableValue: "verified_de_without_it_exception",
      },
      {
        stableValue: "not_applicable_no_partner_or_linked_enterprises",
      },
      {
        stableValue: "verified_de_with_it_exception",
      },
      {
        stableValue: "no",
      },
      {
        stableValue: "unsure",
      },
    ],
    factKey: "sme_figures_verified",
    config: {
      section: "size",
      ui: {
        control: "buttons",
      },
      visibleWhen: {
        any: [
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_telecom_provider",
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
            ],
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "in",
                values: ["de_established", "de_cross_border_digital_provider"],
              },
              {
                questionStableKey: "bc.special_status",
                operator: "in",
                values: ["none", "important"],
              },
              {
                questionStableKey: "bc.activity",
                operator: "route_in",
                values: ["T", "A1", "A2"],
              },
            ],
          },
        ],
      },
    },
  },
];
