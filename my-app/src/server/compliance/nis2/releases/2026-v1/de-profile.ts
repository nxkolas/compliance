import type { NationalEntityTypeSource } from "../types";

type Mapping = NationalEntityTypeSource["mappings"][number];
type ClassificationRule = NationalEntityTypeSource["classificationRule"];
type GermanAnnexRow = {
  annex: 1 | 2;
  locator: string;
  code: string;
  de: string;
  en: string;
  mappings: Mapping[];
  classificationRule?: ClassificationRule;
};

const exact = (euEntityCode: string): Mapping => ({ euEntityCode, relationship: "exact" });
const subset = (euEntityCode: string): Mapping => ({ euEntityCode, relationship: "subset" });
const aggregate = (euEntityCode: string): Mapping => ({ euEntityCode, relationship: "aggregate" });
const overlap = (euEntityCode: string): Mapping => ({ euEntityCode, relationship: "overlap" });

const annexRows: GermanAnnexRow[] = [
  row(1, "1.1.1", "de_bsig_electricity_supplier", "Stromlieferant", "Electricity supplier", [exact("electricity_supplier")]),
  row(1, "1.1.2", "de_bsig_electricity_distribution_operator", "Elektrizitätsverteilernetzbetreiber", "Electricity distribution operator", [exact("electricity_distribution_operator")]),
  row(1, "1.1.3", "de_bsig_electricity_transmission_operator", "Elektrizitätsübertragungsnetzbetreiber", "Electricity transmission operator", [exact("electricity_transmission_operator")]),
  row(1, "1.1.4", "de_bsig_electricity_generation_installation_operator", "Betreiber einer Stromerzeugungsanlage", "Electricity generation-installation operator", [exact("electricity_producer")]),
  row(1, "1.1.5", "de_bsig_nominated_electricity_market_operator", "Nominierter Strommarktbetreiber", "Nominated electricity market operator", [exact("electricity_market_operator")]),
  row(1, "1.1.6", "de_bsig_electricity_aggregator", "Aggregator im Elektrizitätsbereich", "Electricity aggregator", [subset("electricity_flexibility_provider")]),
  row(1, "1.1.7", "de_bsig_energy_storage_installation_operator", "Betreiber einer Energiespeicheranlage", "Energy-storage installation operator", [subset("electricity_flexibility_provider")]),
  row(1, "1.1.8", "de_bsig_balancing_service_provider", "Anbieter von Ausgleichsleistungen", "Balancing-service provider", [subset("electricity_flexibility_provider")]),
  row(1, "1.1.9", "de_bsig_recharging_point_operator", "Ladepunktbetreiber", "Recharging-point operator", [exact("recharging_point_operator")]),
  row(1, "1.2.1", "de_bsig_district_heating_cooling_operator", "Betreiber von Fernwärme- oder Fernkälteversorgung", "District-heating or district-cooling operator", [exact("district_heating_cooling_operator")]),
  row(1, "1.3.1", "de_bsig_oil_transmission_pipeline_operator", "Betreiber einer Erdölfernleitung", "Oil transmission-pipeline operator", [exact("oil_pipeline_operator")]),
  row(1, "1.3.2", "de_bsig_oil_facilities_operator", "Betreiber von Erdölproduktions-, Raffinations-, Aufbereitungs-, Lager- oder Fernleitungsanlagen", "Oil production, refining, treatment, storage or pipeline-facility operator", [aggregate("oil_facility_operator"), overlap("oil_pipeline_operator")]),
  row(1, "1.3.3", "de_bsig_central_oil_stockholding_entity", "Zentrale Erdölbevorratungsstelle", "Central oil-stockholding entity", [exact("central_oil_stockholding_entity")]),
  row(1, "1.4.1", "de_bsig_gas_distribution_operator", "Gasverteilernetzbetreiber", "Gas distribution operator", [exact("gas_distribution_operator")]),
  row(1, "1.4.2", "de_bsig_gas_transmission_operator", "Gasfernleitungsnetzbetreiber", "Gas transmission operator", [exact("gas_transmission_operator")]),
  row(1, "1.4.3", "de_bsig_gas_storage_operator", "Gasspeicheranlagenbetreiber", "Gas-storage operator", [exact("gas_storage_operator")]),
  row(1, "1.4.4", "de_bsig_lng_operator", "LNG-Anlagenbetreiber", "LNG operator", [exact("lng_operator")]),
  row(1, "1.4.5", "de_bsig_gas_supplier", "Gaslieferant", "Gas supplier", [exact("gas_supply_undertaking")]),
  row(1, "1.4.6", "de_bsig_natural_gas_extraction_operator", "Betreiber einer Anlage zur Erdgasgewinnung", "Natural-gas extraction-installation operator", [subset("natural_gas_undertaking")]),
  row(1, "1.4.7", "de_bsig_natural_gas_refining_treatment_operator", "Betreiber einer Erdgasraffinerie oder -aufbereitungsanlage", "Natural-gas refining or treatment operator", [exact("gas_refining_treatment_operator")]),
  row(1, "1.4.8", "de_bsig_hydrogen_operator", "Betreiber von Wasserstofferzeugungs-, Speicher- oder Fernleitungsanlagen", "Hydrogen production, storage or transmission operator", [aggregate("hydrogen_operator")]),
  row(1, "2.1.1", "de_bsig_commercial_air_carrier", "Gewerblich genutztes Luftfahrtunternehmen", "Commercial air carrier", [exact("air_carrier")]),
  row(1, "2.1.2", "de_bsig_airport_entity", "Flughafenleitungsorgan, Flughafen oder Betreiber einer zugehörigen Anlage", "Airport managing body, airport or ancillary-installation operator", [aggregate("airport_operator")]),
  row(1, "2.1.3", "de_bsig_atm_ans_provider", "Flugverkehrsmanagement- oder Flugsicherungsdiensteanbieter", "ATM or air-navigation-services provider", [overlap("air_traffic_management_provider")]),
  row(1, "2.2.1", "de_bsig_rail_infrastructure_operator", "Eisenbahninfrastrukturbetreiber", "Rail-infrastructure operator", [aggregate("rail_infrastructure_manager")]),
  row(1, "2.2.2", "de_bsig_railway_undertaking", "Eisenbahnverkehrsunternehmen einschließlich Serviceeinrichtungsbetreiber", "Railway undertaking including service-facility operators", [aggregate("railway_undertaking")]),
  row(1, "2.3.1", "de_bsig_water_transport_company", "Unternehmen der Binnen-, See- oder Küstenschifffahrt", "Inland, sea or coastal water-transport company", [exact("water_transport_company")]),
  row(1, "2.3.2", "de_bsig_port_entity", "Hafenleitungsorgan, Hafenanlage oder Betreiber von Hafenanlagen und -ausrüstung", "Port managing body, port facility or port works/equipment operator", [aggregate("port_operator")]),
  row(1, "2.3.3", "de_bsig_waterway_safe_operation_system_operator", "Betreiber einer Anlage oder eines Systems zum sicheren Wasserstraßenbetrieb", "Safe-waterway installation or system operator", [overlap("vessel_traffic_service")]),
  row(1, "2.4.1", "de_bsig_road_traffic_influence_system_operator", "Betreiber einer Anlage oder eines Systems zur Straßenverkehrsbeeinflussung", "Road traffic-influence installation or system operator", [overlap("road_authority")]),
  row(1, "2.4.2", "de_bsig_intelligent_transport_system_operator", "Betreiber eines intelligenten Verkehrssystems", "Intelligent-transport-system operator", [exact("intelligent_transport_system_operator")]),
  row(1, "3.1.1", "de_bsig_credit_institution", "Kreditinstitut", "Credit institution", [exact("credit_institution")]),
  row(1, "3.2.1", "de_bsig_trading_venue", "Handelsplatz", "Trading venue", [exact("trading_venue_operator")]),
  row(1, "3.2.2", "de_bsig_central_counterparty", "Zentrale Gegenpartei", "Central counterparty", [exact("central_counterparty")]),
  row(1, "4.1.1", "de_bsig_healthcare_provider", "Gesundheitsdienstleister", "Healthcare provider", [exact("healthcare_provider")]),
  row(1, "4.1.2", "de_bsig_eu_reference_laboratory", "EU-Referenzlaboratorium", "EU reference laboratory", [exact("eu_reference_laboratory")]),
  row(1, "4.1.3", "de_bsig_medicinal_product_researcher", "Unternehmen der Arzneimittelforschung und -entwicklung", "Medicinal-product research and development company", [exact("medicinal_product_researcher")]),
  row(1, "4.1.4", "de_bsig_pharmaceutical_manufacturer", "Hersteller pharmazeutischer Erzeugnisse", "Pharmaceutical manufacturer", [exact("pharmaceutical_manufacturer")]),
  row(1, "4.1.5", "de_bsig_emergency_critical_medical_device_manufacturer", "Hersteller eines notfallkritischen Medizinprodukts", "Emergency-critical medical-device manufacturer", [exact("critical_medical_device_manufacturer")]),
  row(1, "5.1.1", "de_bsig_drinking_water_supply_operator", "Betreiber einer Trinkwasserversorgungsanlage", "Drinking-water supply-installation operator", [exact("drinking_water_supplier")]),
  row(1, "5.2.1", "de_bsig_waste_water_undertaking", "Abwasserunternehmen", "Waste-water undertaking", [exact("waste_water_undertaking")]),
  row(1, "6.1.1", "de_bsig_internet_exchange_point_operator", "Betreiber eines Internetknotens", "Internet-exchange-point operator", [exact("internet_exchange_point")]),
  row(1, "6.1.2", "de_bsig_dns_service_provider", "DNS-Diensteanbieter", "DNS service provider", [exact("dns_service_provider")], "always_particularly_important"),
  row(1, "6.1.3", "de_bsig_tld_registry", "Top-Level-Domain-Namensregister", "Top-level-domain registry", [exact("tld_registry")], "always_particularly_important"),
  row(1, "6.1.4", "de_bsig_cloud_service_provider", "Cloud-Computing-Diensteanbieter", "Cloud-computing service provider", [exact("cloud_service_provider")]),
  row(1, "6.1.5", "de_bsig_data_centre_service_provider", "Rechenzentrumsdiensteanbieter", "Data-centre service provider", [exact("data_centre_service_provider")]),
  row(1, "6.1.6", "de_bsig_content_delivery_network_operator", "Betreiber eines Inhaltszustellnetzes", "Content-delivery-network operator", [exact("content_delivery_network_provider")]),
  row(1, "6.1.7", "de_bsig_trust_service_provider", "Vertrauensdiensteanbieter", "Trust-service provider", []),
  row(1, "6.1.8", "de_bsig_public_telecom_network_operator", "Betreiber eines öffentlichen Telekommunikationsnetzes", "Public telecommunications-network operator", [exact("public_electronic_communications_network")], "telecom"),
  row(1, "6.1.9", "de_bsig_publicly_available_telecom_service_provider", "Anbieter öffentlich zugänglicher Telekommunikationsdienste", "Publicly available telecommunications-service provider", [exact("public_electronic_communications_service")], "telecom"),
  row(1, "6.1.10", "de_bsig_managed_service_provider", "Anbieter verwalteter Dienste", "Managed-service provider", [exact("managed_service_provider")]),
  row(1, "6.1.11", "de_bsig_managed_security_service_provider", "Anbieter verwalteter Sicherheitsdienste", "Managed-security-service provider", [exact("managed_security_service_provider")]),
  row(1, "7.1.1", "de_bsig_space_ground_infrastructure_operator", "Betreiber bodengestützter Weltrauminfrastruktur", "Space ground-infrastructure operator", [exact("space_ground_infrastructure_operator")]),
  row(2, "1.1.1", "de_bsig_postal_courier_provider", "Post- oder Kurierdiensteanbieter", "Postal or courier-service provider", [exact("postal_courier_provider")]),
  row(2, "2.1.1", "de_bsig_waste_management_undertaking", "Unternehmen mit Abfallbewirtschaftung als Haupttätigkeit", "Undertaking with waste management as its principal activity", [exact("waste_management_undertaking")]),
  row(2, "3.1.1", "de_bsig_reach_registered_nace20_chemical_manufacturer_importer", "REACH-registrierungspflichtiger Chemikalienhersteller oder -importeur der NACE-Abteilung 20", "REACH-registered NACE-20 chemical manufacturer or importer", [subset("chemical_manufacturer_distributor")]),
  row(2, "4.1.1", "de_bsig_food_wholesale_industrial_business", "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung", "Food wholesale or industrial production/processing business", [exact("food_wholesale_industrial_business")]),
  row(2, "5.1.1", "de_bsig_medical_ivd_device_manufacturer", "Hersteller von Medizinprodukten oder In-vitro-Diagnostika", "Medical-device or in-vitro-diagnostic manufacturer", [exact("medical_device_manufacturer")]),
  row(2, "5.2.1", "de_bsig_nace26_computer_electronic_optical_manufacturer", "Hersteller nach NACE-Abteilung 26", "NACE division-26 computer, electronic or optical manufacturer", [exact("computer_electronic_optical_manufacturer")]),
  row(2, "5.3.1", "de_bsig_nace27_electrical_equipment_manufacturer", "Hersteller nach NACE-Abteilung 27", "NACE division-27 electrical-equipment manufacturer", [exact("electrical_equipment_manufacturer")]),
  row(2, "5.4.1", "de_bsig_nace28_machinery_manufacturer", "Hersteller nach NACE-Abteilung 28", "NACE division-28 machinery manufacturer", [exact("machinery_manufacturer")]),
  row(2, "5.5.1", "de_bsig_nace29_motor_vehicle_manufacturer", "Hersteller nach NACE-Abteilung 29", "NACE division-29 motor-vehicle manufacturer", [exact("motor_vehicle_manufacturer")]),
  row(2, "5.6.1", "de_bsig_nace30_other_transport_equipment_manufacturer", "Hersteller nach NACE-Abteilung 30", "NACE division-30 other-transport-equipment manufacturer", [exact("other_transport_equipment_manufacturer")]),
  row(2, "6.1.1", "de_bsig_online_marketplace_provider", "Anbieter eines Online-Marktplatzes", "Online-marketplace provider", [exact("online_marketplace_provider")]),
  row(2, "6.1.2", "de_bsig_online_search_engine_provider", "Anbieter einer Online-Suchmaschine", "Online-search-engine provider", [exact("online_search_engine_provider")]),
  row(2, "6.1.3", "de_bsig_social_networking_platform_provider", "Anbieter einer Plattform für soziale Netzwerkdienste", "Social-networking-platform provider", [exact("social_networking_platform_provider")]),
  row(2, "7.1.1", "de_bsig_research_organisation", "Forschungseinrichtung für kommerziell nutzbare angewandte Forschung oder experimentelle Entwicklung", "Research organisation conducting commercially exploitable applied research or experimental development", [exact("research_organisation")]),
];

const incorporatedProvisionKeysByEntityCode: Record<string, string[]> = {
  de_bsig_electricity_supplier: ["de_enwg.section_3"],
  de_bsig_electricity_distribution_operator: ["de_enwg.section_3"],
  de_bsig_electricity_transmission_operator: ["de_enwg.section_3"],
  de_bsig_electricity_generation_installation_operator: ["de_enwg.section_3"],
  de_bsig_nominated_electricity_market_operator: ["eu_reg_2019_943.article_2_8"],
  de_bsig_electricity_aggregator: ["de_enwg.section_3"],
  de_bsig_energy_storage_installation_operator: ["de_enwg.section_3"],
  de_bsig_balancing_service_provider: ["de_enwg.section_3"],
  de_bsig_recharging_point_operator: ["de_lsv.section_2"],
  de_bsig_district_heating_cooling_operator: ["de_geg.section_3"],
  de_bsig_central_oil_stockholding_entity: ["eu_dir_2009_119.article_2_f"],
  de_bsig_gas_distribution_operator: ["de_enwg.section_3"],
  de_bsig_gas_transmission_operator: ["de_enwg.section_3"],
  de_bsig_gas_storage_operator: ["de_enwg.section_3"],
  de_bsig_lng_operator: ["de_enwg.section_3"],
  de_bsig_gas_supplier: ["de_enwg.section_3"],
  de_bsig_commercial_air_carrier: ["eu_reg_300_2008.article_3_4"],
  de_bsig_atm_ans_provider: ["eu_reg_2017_373.article_2_2"],
  de_bsig_rail_infrastructure_operator: ["de_aeg.section_2"],
  de_bsig_railway_undertaking: ["de_aeg.section_2"],
  de_bsig_waterway_safe_operation_system_operator: ["de_wastrg.section_1_6_1"],
  de_bsig_road_traffic_influence_system_operator: ["de_fstrg.section_1"],
  de_bsig_intelligent_transport_system_operator: ["de_ivsg.section_2_1"],
  de_bsig_trading_venue: ["de_wphg.section_2_22"],
  de_bsig_healthcare_provider: ["eu_dir_2011_24.article_3_g"],
  de_bsig_eu_reference_laboratory: ["eu_reg_2022_2371.article_15"],
  de_bsig_medicinal_product_researcher: ["de_amg.section_2"],
  de_bsig_pharmaceutical_manufacturer: ["eu_nace_rev_2.division_21"],
  de_bsig_emergency_critical_medical_device_manufacturer: ["eu_reg_2022_123.article_22"],
  de_bsig_drinking_water_supply_operator: ["de_trinkwv.section_2_3"],
  de_bsig_waste_water_undertaking: ["de_whg.section_54_1"],
  de_bsig_internet_exchange_point_operator: ["de_bsig.section_2"],
  de_bsig_dns_service_provider: ["de_bsig.section_2"],
  de_bsig_cloud_service_provider: ["de_bsig.section_2"],
  de_bsig_data_centre_service_provider: ["de_bsig.section_2"],
  de_bsig_content_delivery_network_operator: ["de_bsig.section_2"],
  de_bsig_managed_service_provider: ["de_bsig.section_2"],
  de_bsig_managed_security_service_provider: ["de_bsig.section_2"],
  de_bsig_postal_courier_provider: ["de_postg.section_3_15"],
  de_bsig_waste_management_undertaking: ["de_krwg.section_3_14"],
  de_bsig_reach_registered_nace20_chemical_manufacturer_importer: ["eu_reach.article_3_9", "eu_reach.article_3_11", "eu_reach.article_6", "eu_nace_rev_2.division_20"],
  de_bsig_food_wholesale_industrial_business: ["eu_reg_178_2002.article_3_2"],
  de_bsig_medical_ivd_device_manufacturer: ["eu_reg_2017_745.article_2_30", "eu_reg_2017_746.article_2_23"],
  de_bsig_nace26_computer_electronic_optical_manufacturer: ["eu_nace_rev_2.division_26"],
  de_bsig_nace27_electrical_equipment_manufacturer: ["eu_nace_rev_2.division_27"],
  de_bsig_nace28_machinery_manufacturer: ["eu_nace_rev_2.division_28"],
  de_bsig_nace29_motor_vehicle_manufacturer: ["eu_nace_rev_2.division_29"],
  de_bsig_nace30_other_transport_equipment_manufacturer: ["eu_nace_rev_2.division_30"],
  de_bsig_online_marketplace_provider: ["de_bsig.section_2"],
  de_bsig_online_search_engine_provider: ["de_bsig.section_2"],
  de_bsig_social_networking_platform_provider: ["de_bsig.section_2"],
  de_bsig_research_organisation: ["de_bsig.section_2"],
};

function row(
  annex: 1 | 2,
  locator: string,
  code: string,
  de: string,
  en: string,
  mappings: Mapping[],
  classificationRule: ClassificationRule = annex === 1 ? "annex_1_standard" : "annex_2_standard",
): GermanAnnexRow {
  return { annex, locator, code, de, en, mappings, classificationRule };
}

type AddContent = (stableKey: string, de: string, en: string) => string;

export function buildGermanEntityCatalog(addContent: AddContent): NationalEntityTypeSource[] {
  return annexRows.flatMap((source) => {
    if (source.code === "de_bsig_trust_service_provider") {
      return [
        nationalEntity(source, "de_bsig_qualified_trust_service_provider", "Qualifizierter Vertrauensdiensteanbieter", "Qualified trust-service provider", "always_particularly_important", [exact("qualified_trust_service_provider")], addContent),
        nationalEntity(source, "de_bsig_non_qualified_trust_service_provider", "Nicht qualifizierter Vertrauensdiensteanbieter", "Non-qualified trust-service provider", "always_important", [exact("other_trust_service_provider")], addContent),
      ];
    }
    return [nationalEntity(source, source.code, source.de, source.en, source.classificationRule ?? "annex_1_standard", source.mappings, addContent)];
  }).concat([
    outOfAnnex("de_bsig_domain_name_registry_service_provider", "Domain-Name-Registrierungsdiensteanbieter", "Domain-name registration-service provider", "domain_registration_obligations", [exact("domain_name_registration_service")], "de_bsig.section_34", addContent),
    outOfAnnex("de_bsig_federal_authority", "Bundesbehörde", "Federal authority", "federal_administration", [overlap("central_public_administration")], "de_bsig.section_29", addContent),
    outOfAnnex("de_bsig_federal_public_law_it_provider", "Öffentlich-rechtlicher IT-Dienstleister des Bundes", "Public-law federal IT provider", "federal_administration", [overlap("central_public_administration")], "de_bsig.section_29", addContent),
    outOfAnnex("de_bsig_other_designated_federal_public_body", "Andere durch Anordnung erfasste öffentlich-rechtliche Bundesstelle", "Other designated federal public-law body", "federal_administration", [overlap("central_public_administration")], "de_bsig.section_29", addContent),
    outOfAnnex("de_bsig_regional_public_administration", "Regionale öffentliche Verwaltung mit Land-Rechtsgrundlage", "Regional public administration requiring Land-law basis", "requires_land_law", [overlap("regional_public_administration")], "de_bsig.section_2", addContent),
  ]);
}

function nationalEntity(
  source: GermanAnnexRow,
  code: string,
  de: string,
  en: string,
  classificationRule: ClassificationRule,
  mappings: Mapping[],
  addContent: AddContent,
): NationalEntityTypeSource {
  const statutoryCategoryCode = `de_bsig_annex_${source.annex}_${source.locator.replaceAll(".", "_")}`;
  const thresholdAssertionDe = ["annex_1_standard", "annex_2_standard"].includes(classificationRule)
    ? " Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden."
    : "";
  const thresholdAssertionEn = ["annex_1_standard", "annex_2_standard"].includes(classificationRule)
    ? " Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration."
    : "";
  return {
    code,
    statutoryCategoryCode,
    annex: source.annex,
    classificationRule,
    labelContentKey: addContent(`nis2.profile.de.entity.${code}.label`, de, en),
    descriptionContentKey: addContent(
      `nis2.profile.de.entity.${code}.description`,
      `${de} nach BSIG Anlage ${source.annex} Nummer ${source.locator}; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.${thresholdAssertionDe}`,
      `${en} under German BSIG Annex ${source.annex} point ${source.locator}; selection confirms that the incorporated definition is met.${thresholdAssertionEn}`,
    ),
    legalProvisionKeys: [
      `de_bsig.annex_${source.annex}_${source.locator.replaceAll(".", "_")}`,
      ...(incorporatedProvisionKeysByEntityCode[source.code] ?? []),
    ],
    mappings,
  };
}

function outOfAnnex(
  code: string,
  de: string,
  en: string,
  classificationRule: ClassificationRule,
  mappings: Mapping[],
  legalProvisionKey: string,
  addContent: AddContent,
): NationalEntityTypeSource {
  return {
    code,
    statutoryCategoryCode: null,
    annex: null,
    classificationRule,
    labelContentKey: addContent(`nis2.profile.de.entity.${code}.label`, de, en),
    descriptionContentKey: addContent(`nis2.profile.de.entity.${code}.description`, de, en),
    legalProvisionKeys: [legalProvisionKey],
    mappings,
  };
}

export const germanAnnexStatutoryCategoryCount = new Set(
  annexRows.map((source) => `de_bsig_annex_${source.annex}_${source.locator.replaceAll(".", "_")}`),
).size;
