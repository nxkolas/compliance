import type { NationalEntityTypeSource } from "../types";

const germanEntityCatalog: NationalEntityTypeSource[] = [
  {
    code: "de_bsig_electricity_supplier",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_supplier.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_supplier.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_1", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_supplier",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_electricity_distribution_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_2", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_distribution_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_electricity_transmission_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_3", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_transmission_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_electricity_generation_installation_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_4",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_4", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_producer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nominated_electricity_market_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_5",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.description",
    legalProvisionKeys: [
      "de_bsig.annex_1_1_1_5",
      "eu_reg_2019_943.article_2_8",
    ],
    mappings: [
      {
        euEntityCode: "electricity_market_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_electricity_aggregator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_6",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_6", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_flexibility_provider",
        relationship: "subset",
      },
    ],
  },
  {
    code: "de_bsig_energy_storage_installation_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_7",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_7", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_flexibility_provider",
        relationship: "subset",
      },
    ],
  },
  {
    code: "de_bsig_balancing_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_8",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_8", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "electricity_flexibility_provider",
        relationship: "subset",
      },
    ],
  },
  {
    code: "de_bsig_recharging_point_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_1_9",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_1_9", "de_lsv.section_2"],
    mappings: [
      {
        euEntityCode: "recharging_point_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_district_heating_cooling_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_2_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_2_1", "de_geg.section_3"],
    mappings: [
      {
        euEntityCode: "district_heating_cooling_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_oil_transmission_pipeline_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_3_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_3_1"],
    mappings: [
      {
        euEntityCode: "oil_pipeline_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_oil_facilities_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_3_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_3_2"],
    mappings: [
      {
        euEntityCode: "oil_facility_operator",
        relationship: "aggregate",
      },
      {
        euEntityCode: "oil_pipeline_operator",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_central_oil_stockholding_entity",
    statutoryCategoryCode: "de_bsig_annex_1_1_3_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.description",
    legalProvisionKeys: [
      "de_bsig.annex_1_1_3_3",
      "eu_dir_2009_119.article_2_f",
    ],
    mappings: [
      {
        euEntityCode: "central_oil_stockholding_entity",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_gas_distribution_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_1", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "gas_distribution_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_gas_transmission_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_2", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "gas_transmission_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_gas_storage_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_3", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "gas_storage_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_lng_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_4",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_lng_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_lng_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_4", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "lng_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_gas_supplier",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_5",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_gas_supplier.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_gas_supplier.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_5", "de_enwg.section_3"],
    mappings: [
      {
        euEntityCode: "gas_supply_undertaking",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_natural_gas_extraction_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_6",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_6"],
    mappings: [
      {
        euEntityCode: "natural_gas_undertaking",
        relationship: "subset",
      },
    ],
  },
  {
    code: "de_bsig_natural_gas_refining_treatment_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_7",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_7"],
    mappings: [
      {
        euEntityCode: "gas_refining_treatment_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_hydrogen_operator",
    statutoryCategoryCode: "de_bsig_annex_1_1_4_8",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_hydrogen_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_hydrogen_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_1_4_8"],
    mappings: [
      {
        euEntityCode: "hydrogen_operator",
        relationship: "aggregate",
      },
    ],
  },
  {
    code: "de_bsig_commercial_air_carrier",
    statutoryCategoryCode: "de_bsig_annex_1_2_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.description",
    legalProvisionKeys: [
      "de_bsig.annex_1_2_1_1",
      "eu_reg_300_2008.article_3_4",
    ],
    mappings: [
      {
        euEntityCode: "air_carrier",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_airport_entity",
    statutoryCategoryCode: "de_bsig_annex_1_2_1_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_airport_entity.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_airport_entity.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_1_2"],
    mappings: [
      {
        euEntityCode: "airport_operator",
        relationship: "aggregate",
      },
    ],
  },
  {
    code: "de_bsig_atm_ans_provider",
    statutoryCategoryCode: "de_bsig_annex_1_2_1_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_atm_ans_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_atm_ans_provider.description",
    legalProvisionKeys: [
      "de_bsig.annex_1_2_1_3",
      "eu_reg_2017_373.article_2_2",
    ],
    mappings: [
      {
        euEntityCode: "air_traffic_management_provider",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_rail_infrastructure_operator",
    statutoryCategoryCode: "de_bsig_annex_1_2_2_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_2_1", "de_aeg.section_2"],
    mappings: [
      {
        euEntityCode: "rail_infrastructure_manager",
        relationship: "aggregate",
      },
    ],
  },
  {
    code: "de_bsig_railway_undertaking",
    statutoryCategoryCode: "de_bsig_annex_1_2_2_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_railway_undertaking.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_railway_undertaking.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_2_2", "de_aeg.section_2"],
    mappings: [
      {
        euEntityCode: "railway_undertaking",
        relationship: "aggregate",
      },
    ],
  },
  {
    code: "de_bsig_water_transport_company",
    statutoryCategoryCode: "de_bsig_annex_1_2_3_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_water_transport_company.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_water_transport_company.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_3_1"],
    mappings: [
      {
        euEntityCode: "water_transport_company",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_port_entity",
    statutoryCategoryCode: "de_bsig_annex_1_2_3_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_port_entity.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_port_entity.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_3_2"],
    mappings: [
      {
        euEntityCode: "port_operator",
        relationship: "aggregate",
      },
    ],
  },
  {
    code: "de_bsig_waterway_safe_operation_system_operator",
    statutoryCategoryCode: "de_bsig_annex_1_2_3_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_3_3", "de_wastrg.section_1_6_1"],
    mappings: [
      {
        euEntityCode: "vessel_traffic_service",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_road_traffic_influence_system_operator",
    statutoryCategoryCode: "de_bsig_annex_1_2_4_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_4_1", "de_fstrg.section_1"],
    mappings: [
      {
        euEntityCode: "road_authority",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_intelligent_transport_system_operator",
    statutoryCategoryCode: "de_bsig_annex_1_2_4_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_2_4_2", "de_ivsg.section_2_1"],
    mappings: [
      {
        euEntityCode: "intelligent_transport_system_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_credit_institution",
    statutoryCategoryCode: "de_bsig_annex_1_3_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_credit_institution.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_credit_institution.description",
    legalProvisionKeys: ["de_bsig.annex_1_3_1_1"],
    mappings: [
      {
        euEntityCode: "credit_institution",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_trading_venue",
    statutoryCategoryCode: "de_bsig_annex_1_3_2_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_trading_venue.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_trading_venue.description",
    legalProvisionKeys: ["de_bsig.annex_1_3_2_1", "de_wphg.section_2_22"],
    mappings: [
      {
        euEntityCode: "trading_venue_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_central_counterparty",
    statutoryCategoryCode: "de_bsig_annex_1_3_2_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_central_counterparty.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_central_counterparty.description",
    legalProvisionKeys: ["de_bsig.annex_1_3_2_2"],
    mappings: [
      {
        euEntityCode: "central_counterparty",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_healthcare_provider",
    statutoryCategoryCode: "de_bsig_annex_1_4_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey: "nis2.profile.de.entity.de_bsig_healthcare_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_healthcare_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_4_1_1", "eu_dir_2011_24.article_3_g"],
    mappings: [
      {
        euEntityCode: "healthcare_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_eu_reference_laboratory",
    statutoryCategoryCode: "de_bsig_annex_1_4_1_2",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.description",
    legalProvisionKeys: [
      "de_bsig.annex_1_4_1_2",
      "eu_reg_2022_2371.article_15",
    ],
    mappings: [
      {
        euEntityCode: "eu_reference_laboratory",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_medicinal_product_researcher",
    statutoryCategoryCode: "de_bsig_annex_1_4_1_3",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.description",
    legalProvisionKeys: ["de_bsig.annex_1_4_1_3", "de_amg.section_2"],
    mappings: [
      {
        euEntityCode: "medicinal_product_researcher",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_pharmaceutical_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_1_4_1_4",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_1_4_1_4", "eu_nace_rev_2.division_21"],
    mappings: [
      {
        euEntityCode: "pharmaceutical_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_emergency_critical_medical_device_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_1_4_1_5",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_1_4_1_5", "eu_reg_2022_123.article_22"],
    mappings: [
      {
        euEntityCode: "critical_medical_device_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_drinking_water_supply_operator",
    statutoryCategoryCode: "de_bsig_annex_1_5_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_5_1_1", "de_trinkwv.section_2_3"],
    mappings: [
      {
        euEntityCode: "drinking_water_supplier",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_waste_water_undertaking",
    statutoryCategoryCode: "de_bsig_annex_1_5_2_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.description",
    legalProvisionKeys: ["de_bsig.annex_1_5_2_1", "de_whg.section_54_1"],
    mappings: [
      {
        euEntityCode: "waste_water_undertaking",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_internet_exchange_point_operator",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_1", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "internet_exchange_point",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_dns_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_2",
    annex: 1,
    classificationRule: "always_particularly_important",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_dns_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_dns_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_2", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "dns_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_tld_registry",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_3",
    annex: 1,
    classificationRule: "always_particularly_important",
    labelContentKey: "nis2.profile.de.entity.de_bsig_tld_registry.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_tld_registry.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_3"],
    mappings: [
      {
        euEntityCode: "tld_registry",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_cloud_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_4",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_4", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "cloud_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_data_centre_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_5",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_5", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "data_centre_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_content_delivery_network_operator",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_6",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_6", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "content_delivery_network_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_qualified_trust_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_7",
    annex: 1,
    classificationRule: "always_particularly_important",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_7"],
    mappings: [
      {
        euEntityCode: "qualified_trust_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_non_qualified_trust_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_7",
    annex: 1,
    classificationRule: "always_important",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_7"],
    mappings: [
      {
        euEntityCode: "other_trust_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_public_telecom_network_operator",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_8",
    annex: 1,
    classificationRule: "telecom",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_8"],
    mappings: [
      {
        euEntityCode: "public_electronic_communications_network",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_publicly_available_telecom_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_9",
    annex: 1,
    classificationRule: "telecom",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_9"],
    mappings: [
      {
        euEntityCode: "public_electronic_communications_service",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_managed_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_10",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_managed_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_managed_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_10", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "managed_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_managed_security_service_provider",
    statutoryCategoryCode: "de_bsig_annex_1_6_1_11",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.description",
    legalProvisionKeys: ["de_bsig.annex_1_6_1_11", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "managed_security_service_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_space_ground_infrastructure_operator",
    statutoryCategoryCode: "de_bsig_annex_1_7_1_1",
    annex: 1,
    classificationRule: "annex_1_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.description",
    legalProvisionKeys: ["de_bsig.annex_1_7_1_1"],
    mappings: [
      {
        euEntityCode: "space_ground_infrastructure_operator",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_postal_courier_provider",
    statutoryCategoryCode: "de_bsig_annex_2_1_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.description",
    legalProvisionKeys: ["de_bsig.annex_2_1_1_1", "de_postg.section_3_15"],
    mappings: [
      {
        euEntityCode: "postal_courier_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_waste_management_undertaking",
    statutoryCategoryCode: "de_bsig_annex_2_2_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.description",
    legalProvisionKeys: ["de_bsig.annex_2_2_1_1", "de_krwg.section_3_14"],
    mappings: [
      {
        euEntityCode: "waste_management_undertaking",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_reach_registered_nace20_chemical_manufacturer_importer",
    statutoryCategoryCode: "de_bsig_annex_2_3_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.description",
    legalProvisionKeys: [
      "de_bsig.annex_2_3_1_1",
      "eu_reach.article_3_9",
      "eu_reach.article_3_11",
      "eu_reach.article_6",
      "eu_nace_rev_2.division_20",
    ],
    mappings: [
      {
        euEntityCode: "chemical_manufacturer_distributor",
        relationship: "subset",
      },
    ],
  },
  {
    code: "de_bsig_food_wholesale_industrial_business",
    statutoryCategoryCode: "de_bsig_annex_2_4_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.description",
    legalProvisionKeys: [
      "de_bsig.annex_2_4_1_1",
      "eu_reg_178_2002.article_3_2",
    ],
    mappings: [
      {
        euEntityCode: "food_wholesale_industrial_business",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_medical_ivd_device_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.description",
    legalProvisionKeys: [
      "de_bsig.annex_2_5_1_1",
      "eu_reg_2017_745.article_2_30",
      "eu_reg_2017_746.article_2_23",
    ],
    mappings: [
      {
        euEntityCode: "medical_device_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nace26_computer_electronic_optical_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_2_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_2_5_2_1", "eu_nace_rev_2.division_26"],
    mappings: [
      {
        euEntityCode: "computer_electronic_optical_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nace27_electrical_equipment_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_3_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_2_5_3_1", "eu_nace_rev_2.division_27"],
    mappings: [
      {
        euEntityCode: "electrical_equipment_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nace28_machinery_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_4_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_2_5_4_1", "eu_nace_rev_2.division_28"],
    mappings: [
      {
        euEntityCode: "machinery_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nace29_motor_vehicle_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_5_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_2_5_5_1", "eu_nace_rev_2.division_29"],
    mappings: [
      {
        euEntityCode: "motor_vehicle_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_nace30_other_transport_equipment_manufacturer",
    statutoryCategoryCode: "de_bsig_annex_2_5_6_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.description",
    legalProvisionKeys: ["de_bsig.annex_2_5_6_1", "eu_nace_rev_2.division_30"],
    mappings: [
      {
        euEntityCode: "other_transport_equipment_manufacturer",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_online_marketplace_provider",
    statutoryCategoryCode: "de_bsig_annex_2_6_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.description",
    legalProvisionKeys: ["de_bsig.annex_2_6_1_1", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "online_marketplace_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_online_search_engine_provider",
    statutoryCategoryCode: "de_bsig_annex_2_6_1_2",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.description",
    legalProvisionKeys: ["de_bsig.annex_2_6_1_2", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "online_search_engine_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_social_networking_platform_provider",
    statutoryCategoryCode: "de_bsig_annex_2_6_1_3",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.description",
    legalProvisionKeys: ["de_bsig.annex_2_6_1_3", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "social_networking_platform_provider",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_research_organisation",
    statutoryCategoryCode: "de_bsig_annex_2_7_1_1",
    annex: 2,
    classificationRule: "annex_2_standard",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_research_organisation.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_research_organisation.description",
    legalProvisionKeys: ["de_bsig.annex_2_7_1_1", "de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "research_organisation",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_domain_name_registry_service_provider",
    statutoryCategoryCode: null,
    annex: null,
    classificationRule: "domain_registration_obligations",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.description",
    legalProvisionKeys: ["de_bsig.section_34"],
    mappings: [
      {
        euEntityCode: "domain_name_registration_service",
        relationship: "exact",
      },
    ],
  },
  {
    code: "de_bsig_federal_authority",
    statutoryCategoryCode: null,
    annex: null,
    classificationRule: "federal_administration",
    labelContentKey: "nis2.profile.de.entity.de_bsig_federal_authority.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_federal_authority.description",
    legalProvisionKeys: ["de_bsig.section_29"],
    mappings: [
      {
        euEntityCode: "central_public_administration",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_federal_public_law_it_provider",
    statutoryCategoryCode: null,
    annex: null,
    classificationRule: "federal_administration",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.description",
    legalProvisionKeys: ["de_bsig.section_29"],
    mappings: [
      {
        euEntityCode: "central_public_administration",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_other_designated_federal_public_body",
    statutoryCategoryCode: null,
    annex: null,
    classificationRule: "federal_administration",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.description",
    legalProvisionKeys: ["de_bsig.section_29"],
    mappings: [
      {
        euEntityCode: "central_public_administration",
        relationship: "overlap",
      },
    ],
  },
  {
    code: "de_bsig_regional_public_administration",
    statutoryCategoryCode: null,
    annex: null,
    classificationRule: "requires_land_law",
    labelContentKey:
      "nis2.profile.de.entity.de_bsig_regional_public_administration.label",
    descriptionContentKey:
      "nis2.profile.de.entity.de_bsig_regional_public_administration.description",
    legalProvisionKeys: ["de_bsig.section_2"],
    mappings: [
      {
        euEntityCode: "regional_public_administration",
        relationship: "overlap",
      },
    ],
  },
];

export function buildGermanEntityCatalog(): NationalEntityTypeSource[] {
  return germanEntityCatalog;
}

export const germanAnnexStatutoryCategoryCount = new Set(
  germanEntityCatalog.flatMap((entity) =>
    entity.statutoryCategoryCode ? [entity.statutoryCategoryCode] : [],
  ),
).size;
