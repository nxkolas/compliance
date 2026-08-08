import type {
  Nis2EntityRule,
} from "@/src/server/applicability-check/domain";

export type Nis2SourceEntityType = {
  code: string;
  sectorCode: string;
  annex: 1 | 2 | null;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  legalReference: string;
  rule: Nis2EntityRule;
};

export type Nis2SeedOption = {
  stableValue: string;
  label: string;
  labelEn: string;
  metadata?: Record<string, unknown>;
};

export type Nis2SeedFactMapping = {
  factKey: string;
  byOption?: Record<string, string | string[] | null>;
};

export type Nis2SeedQuestion = {
  stableKey: string;
  position: number;
  questionText: string;
  questionTextEn: string;
  helpText?: string;
  helpTextEn?: string;
  tooltipText: string;
  tooltipTextEn: string;
  answerType: "single_choice" | "multi_choice";
  required: boolean;
  options: Nis2SeedOption[];
  factKey: string;
  factMappings?: Nis2SeedFactMapping[];
  config: Record<string, unknown>;
};

type SectorGroup = {
  code: string;
  label: string;
  labelEn: string;
};

export const nis2SectorGroups: SectorGroup[] = [
  { code: "energy", label: "Energie", labelEn: "Energy" },
  { code: "transport", label: "Verkehr", labelEn: "Transport" },
  { code: "banking", label: "Banken", labelEn: "Banking" },
  {
    code: "financial_market_infrastructures",
    label: "Finanzmarktinfrastrukturen",
    labelEn: "Financial market infrastructures",
  },
  { code: "health", label: "Gesundheit", labelEn: "Health" },
  {
    code: "drinking_water",
    label: "Trinkwasser",
    labelEn: "Drinking water",
  },
  { code: "waste_water", label: "Abwasser", labelEn: "Waste water" },
  {
    code: "digital_infrastructure",
    label: "Digitale Infrastruktur",
    labelEn: "Digital infrastructure",
  },
  {
    code: "ict_service_management",
    label: "Verwaltung von IKT-Diensten",
    labelEn: "ICT service management",
  },
  {
    code: "public_administration",
    label: "Öffentliche Verwaltung",
    labelEn: "Public administration",
  },
  { code: "space", label: "Weltraum", labelEn: "Space" },
  {
    code: "postal_courier",
    label: "Post- und Kurierdienste",
    labelEn: "Postal and courier services",
  },
  {
    code: "waste_management",
    label: "Abfallbewirtschaftung",
    labelEn: "Waste management",
  },
  { code: "chemicals", label: "Chemikalien", labelEn: "Chemicals" },
  { code: "food", label: "Lebensmittel", labelEn: "Food" },
  {
    code: "manufacturing",
    label: "Verarbeitendes Gewerbe",
    labelEn: "Manufacturing",
  },
  {
    code: "digital_providers",
    label: "Digitale Anbieter",
    labelEn: "Digital providers",
  },
  { code: "research", label: "Forschung", labelEn: "Research" },
];

function entity(
  code: string,
  sectorCode: string,
  annex: 1 | 2 | null,
  label: string,
  labelEn: string,
  section: string,
  rule: Nis2EntityRule = "standard",
): Nis2SourceEntityType {
  return {
    code,
    sectorCode,
    annex,
    label,
    labelEn,
    description:
      annex === null
        ? `${label} im Sinne von Artikel 2 Absatz 4 und Artikel 28 der NIS2-Richtlinie; erfasst ist die gewerbliche Verwaltung von Domänennamenregistrierungen.`
        : `${label} im Sinne der in NIS2 Anhang ${annex === 1 ? "I" : "II"}, Nummer ${section}, in Bezug genommenen sektorspezifischen Unionsrechtsdefinition.`,
    descriptionEn:
      annex === null
        ? `${labelEn} within Articles 2(4) and 28 of the NIS2 Directive, covering commercial management of domain-name registrations.`
        : `${labelEn} within the sector-specific Union-law definition referenced by NIS2 Annex ${annex === 1 ? "I" : "II"}, point ${section}.`,
    legalReference:
      annex === null
        ? "Directive (EU) 2022/2555, Articles 2(4) and 28"
        : `Directive (EU) 2022/2555, Annex ${annex === 1 ? "I" : "II"}, ${section}`,
    rule,
  };
}

export const nis2EntityTypes: Nis2SourceEntityType[] = [
  entity("electricity_supplier", "energy", 1, "Stromlieferant", "Electricity undertaking carrying out supply", "1(a)"),
  entity("electricity_distribution_operator", "energy", 1, "Elektrizitätsverteilernetzbetreiber", "Electricity distribution system operator", "1(a)"),
  entity("electricity_transmission_operator", "energy", 1, "Elektrizitätsübertragungsnetzbetreiber", "Electricity transmission system operator", "1(a)"),
  entity("electricity_producer", "energy", 1, "Stromerzeuger", "Electricity producer", "1(a)"),
  entity("electricity_market_operator", "energy", 1, "Nominierter Strommarktbetreiber", "Nominated electricity market operator", "1(a)"),
  entity("electricity_flexibility_provider", "energy", 1, "Anbieter von Aggregation, Laststeuerung oder Energiespeicherung", "Provider of aggregation, demand response or energy storage", "1(a)"),
  entity("recharging_point_operator", "energy", 1, "Betreiber öffentlich zugänglicher Ladepunkte", "Operator of publicly accessible recharging points", "1(a)"),
  entity("district_heating_cooling_operator", "energy", 1, "Betreiber von Fernwärme- oder Fernkälteversorgung", "District heating or cooling operator", "1(b)"),
  entity("oil_pipeline_operator", "energy", 1, "Betreiber von Erdöl-Fernleitungen", "Oil transmission pipeline operator", "1(c)"),
  entity("oil_facility_operator", "energy", 1, "Betreiber von Erdölgewinnungs-, Raffinerie-, Aufbereitungs-, Lager- oder Übertragungsanlagen", "Operator of oil production, refining, treatment, storage or transmission facilities", "1(c)"),
  entity("central_oil_stockholding_entity", "energy", 1, "Zentrale Erdölbevorratungsstelle", "Central oil stockholding entity", "1(c)"),
  entity("gas_supply_undertaking", "energy", 1, "Gasversorgungsunternehmen", "Gas supply undertaking", "1(d)"),
  entity("gas_distribution_operator", "energy", 1, "Gasverteilernetzbetreiber", "Gas distribution system operator", "1(d)"),
  entity("gas_transmission_operator", "energy", 1, "Gasfernleitungsnetzbetreiber", "Gas transmission system operator", "1(d)"),
  entity("gas_storage_operator", "energy", 1, "Gasspeicheranlagenbetreiber", "Gas storage system operator", "1(d)"),
  entity("lng_operator", "energy", 1, "Betreiber einer LNG-Anlage", "LNG system operator", "1(d)"),
  entity("natural_gas_undertaking", "energy", 1, "Erdgasunternehmen", "Natural gas undertaking", "1(d)"),
  entity("gas_refining_treatment_operator", "energy", 1, "Betreiber von Erdgasraffinerie- oder Aufbereitungsanlagen", "Operator of natural-gas refining or treatment facilities", "1(d)"),
  entity("hydrogen_operator", "energy", 1, "Betreiber für Wasserstofferzeugung, -speicherung oder -fernleitung", "Hydrogen production, storage or transmission operator", "1(e)"),
  entity("air_carrier", "transport", 1, "Luftfahrtunternehmen", "Air carrier", "2(a)"),
  entity("airport_operator", "transport", 1, "Flughafenleitungsorgan, Flughafen oder Betreiber zugehöriger Einrichtungen", "Airport managing body, airport or operator of ancillary installations", "2(a)"),
  entity("air_traffic_management_provider", "transport", 1, "Flugverkehrsmanagement- oder Flugsicherungsanbieter", "Air traffic management or air navigation services provider", "2(a)"),
  entity("rail_infrastructure_manager", "transport", 1, "Betreiber von Eisenbahninfrastruktur", "Railway infrastructure manager", "2(b)"),
  entity("railway_undertaking", "transport", 1, "Eisenbahnunternehmen", "Railway undertaking", "2(b)"),
  entity("water_transport_company", "transport", 1, "Binnen-, See- oder Küstenschifffahrtsunternehmen", "Inland, sea or coastal water transport company", "2(c)"),
  entity("port_operator", "transport", 1, "Leitungsorgan eines Hafens oder Betreiber einer Hafenanlage", "Managing body of a port or port-facility operator", "2(c)"),
  entity("vessel_traffic_service", "transport", 1, "Betreiber eines Schiffsverkehrsdienstes", "Vessel traffic service operator", "2(c)"),
  entity("road_authority", "transport", 1, "Straßenverkehrsbehörde", "Road authority", "2(d)"),
  entity("intelligent_transport_system_operator", "transport", 1, "Betreiber intelligenter Verkehrssysteme", "Operator of intelligent transport systems", "2(d)"),
  entity("credit_institution", "banking", 1, "Kreditinstitut", "Credit institution", "3"),
  entity("trading_venue_operator", "financial_market_infrastructures", 1, "Betreiber eines Handelsplatzes", "Operator of a trading venue", "4"),
  entity("central_counterparty", "financial_market_infrastructures", 1, "Zentrale Gegenpartei", "Central counterparty", "4"),
  entity("healthcare_provider", "health", 1, "Gesundheitsdienstleister", "Healthcare provider", "5"),
  entity("eu_reference_laboratory", "health", 1, "EU-Referenzlaboratorium", "EU reference laboratory", "5"),
  entity("medicinal_product_researcher", "health", 1, "Forschungs- und Entwicklungsunternehmen für Arzneimittel", "Entity carrying out research and development of medicinal products", "5"),
  entity("pharmaceutical_manufacturer", "health", 1, "Hersteller pharmazeutischer Grundstoffe oder Erzeugnisse", "Manufacturer of basic pharmaceutical products or preparations", "5"),
  entity("critical_medical_device_manufacturer", "health", 1, "Hersteller kritischer Medizinprodukte für Notlagen", "Manufacturer of critical medical devices during a public-health emergency", "5"),
  entity("drinking_water_supplier", "drinking_water", 1, "Lieferant oder Verteiler von Trinkwasser", "Supplier or distributor of drinking water", "6"),
  entity("waste_water_undertaking", "waste_water", 1, "Unternehmen der Abwassersammlung, -entsorgung oder -behandlung", "Undertaking collecting, disposing of or treating waste water", "7"),
  entity("internet_exchange_point", "digital_infrastructure", 1, "Betreiber eines Internetknotens", "Internet exchange point provider", "8"),
  entity("dns_service_provider", "digital_infrastructure", 1, "DNS-Diensteanbieter", "DNS service provider", "8", "always_essential"),
  entity("tld_registry", "digital_infrastructure", 1, "TLD-Namensregister", "TLD name registry", "8", "always_essential"),
  entity("cloud_service_provider", "digital_infrastructure", 1, "Cloud-Computing-Dienstleister", "Cloud computing service provider", "8"),
  entity("data_centre_service_provider", "digital_infrastructure", 1, "Rechenzentrumsdienstleister", "Data centre service provider", "8"),
  entity("content_delivery_network_provider", "digital_infrastructure", 1, "Content-Delivery-Network-Anbieter", "Content delivery network provider", "8"),
  entity("qualified_trust_service_provider", "digital_infrastructure", 1, "Qualifizierter Vertrauensdiensteanbieter", "Qualified trust service provider", "8", "always_essential"),
  entity("other_trust_service_provider", "digital_infrastructure", 1, "Nicht qualifizierter Vertrauensdiensteanbieter", "Non-qualified trust service provider", "8", "always_important"),
  entity("public_electronic_communications_network", "digital_infrastructure", 1, "Anbieter eines öffentlichen elektronischen Kommunikationsnetzes", "Provider of a public electronic communications network", "8", "telecom"),
  entity("public_electronic_communications_service", "digital_infrastructure", 1, "Anbieter eines öffentlich zugänglichen elektronischen Kommunikationsdienstes", "Provider of a publicly available electronic communications service", "8", "telecom"),
  entity("domain_name_registration_service", "digital_infrastructure", null, "Anbieter von Domänennamenregistrierungsdiensten", "Provider of domain-name registration services", "", "domain_registration"),
  entity("managed_service_provider", "ict_service_management", 1, "Managed Service Provider (MSP)", "Managed service provider (MSP)", "9"),
  entity("managed_security_service_provider", "ict_service_management", 1, "Managed Security Service Provider (MSSP)", "Managed security service provider (MSSP)", "9"),
  entity("central_public_administration", "public_administration", 1, "Einrichtung der Zentralverwaltung", "Central-government public administration entity", "10", "central_public_administration"),
  entity("regional_public_administration", "public_administration", 1, "Einrichtung der regionalen Verwaltung mit relevanter Risikoeinstufung", "Regional public administration entity with relevant risk classification", "10", "regional_public_administration"),
  entity("space_ground_infrastructure_operator", "space", 1, "Betreiber bodengestützter Weltrauminfrastruktur", "Operator of ground-based space infrastructure", "11"),
  entity("postal_courier_provider", "postal_courier", 2, "Post- oder Kurierdiensteanbieter", "Postal or courier service provider", "1"),
  entity("waste_management_undertaking", "waste_management", 2, "Unternehmen der Abfallbewirtschaftung als Haupttätigkeit", "Waste-management undertaking where waste management is a principal activity", "2"),
  entity("chemical_manufacturer_distributor", "chemicals", 2, "Hersteller oder Vertreiber chemischer Stoffe oder Gemische", "Manufacturer or distributor of chemical substances or mixtures", "3"),
  entity("chemical_article_producer", "chemicals", 2, "Produzent von Erzeugnissen aus chemischen Stoffen oder Gemischen", "Producer of articles from chemical substances or mixtures", "3"),
  entity("food_wholesale_industrial_business", "food", 2, "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung", "Food business engaged in wholesale or industrial production and processing", "4"),
  entity("medical_device_manufacturer", "manufacturing", 2, "Hersteller von Medizinprodukten oder In-vitro-Diagnostika", "Manufacturer of medical devices or in-vitro diagnostics", "5(a)"),
  entity("computer_electronic_optical_manufacturer", "manufacturing", 2, "Hersteller von Datenverarbeitungsgeräten, elektronischen oder optischen Erzeugnissen", "Manufacturer of computer, electronic or optical products", "5(b)"),
  entity("electrical_equipment_manufacturer", "manufacturing", 2, "Hersteller elektrischer Ausrüstungen", "Manufacturer of electrical equipment", "5(c)"),
  entity("machinery_manufacturer", "manufacturing", 2, "Maschinenbauunternehmen", "Manufacturer of machinery and equipment n.e.c.", "5(d)"),
  entity("motor_vehicle_manufacturer", "manufacturing", 2, "Hersteller von Kraftwagen, Anhängern oder Aufliegern", "Manufacturer of motor vehicles, trailers or semi-trailers", "5(e)"),
  entity("other_transport_equipment_manufacturer", "manufacturing", 2, "Hersteller sonstiger Fahrzeuge", "Manufacturer of other transport equipment", "5(f)"),
  entity("online_marketplace_provider", "digital_providers", 2, "Anbieter eines Online-Marktplatzes", "Provider of an online marketplace", "6"),
  entity("online_search_engine_provider", "digital_providers", 2, "Anbieter einer Online-Suchmaschine", "Provider of an online search engine", "6"),
  entity("social_networking_platform_provider", "digital_providers", 2, "Anbieter einer Plattform für soziale Netzwerke", "Provider of a social networking services platform", "6"),
  entity("research_organisation", "research", 2, "Forschungseinrichtung", "Research organisation", "7"),
];

const germanyConnectionOptions: Nis2SeedOption[] = [
  { stableValue: "de_established", label: "Die Organisation ist in Deutschland niedergelassen", labelEn: "The organisation is established in Germany" },
  { stableValue: "de_critical_installation", label: "Sie ist nicht in Deutschland niedergelassen, betreibt aber eine kritische Anlage in Deutschland", labelEn: "It is not established in Germany, but operates a critical installation in Germany" },
  { stableValue: "de_federal_administration", label: "Sie gehört zur deutschen Bundesverwaltung", labelEn: "It is part of the German federal administration" },
  { stableValue: "de_cross_border_digital_provider", label: "Sie ist ein grenzüberschreitender digitaler Anbieter, für den Deutschland zuständig ist", labelEn: "It is a cross-border digital provider for which Germany is the competent country" },
  { stableValue: "de_telecom_provider", label: "Sie erbringt einen öffentlichen Telekommunikationsdienst oder betreibt ein öffentliches Telekommunikationsnetz, für das Deutschland zuständig ist", labelEn: "It provides a public telecommunications service or operates a public telecommunications network for which Germany is competent" },
  { stableValue: "de_regional_administration", label: "Sie ist eine regionale oder Landesverwaltung, die deutschem Landesrecht unterliegt", labelEn: "It is regional or state administration subject to German Land law" },
  { stableValue: "none", label: "Keine dieser Aussagen", labelEn: "None of these" },
  { stableValue: "unsure", label: "Ich bin mir nicht sicher", labelEn: "I'm not sure" },
];

const specialStatusOptions: Nis2SeedOption[] = [
  { stableValue: "none", label: "Keine dieser Einstufungen", labelEn: "None of these" },
  { stableValue: "de_critical_installation", label: "Wir betreiben eine kritische Anlage", labelEn: "We operate a critical installation" },
  { stableValue: "essential_or_cer", label: "Eine Behörde hat uns als besonders wichtig eingestuft oder als kritische Einrichtung nach CER benannt", labelEn: "An authority has classified us as particularly important or designated us as critical under CER" },
  { stableValue: "important", label: "Eine Behörde hat uns formell als wichtig eingestuft", labelEn: "An authority has formally classified us as important" },
  { stableValue: "unsure", label: "Ich bin mir nicht sicher", labelEn: "I'm not sure" },
];

const activitySectorCodes = [
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
];

const sectorOptions: Nis2SeedOption[] = [
  { stableValue: "energy", label: "Energie", labelEn: "Energy" },
  { stableValue: "transport", label: "Verkehr, Transport, Post- oder Kurierdienste", labelEn: "Transport, traffic, postal or courier services" },
  { stableValue: "banking_financial", label: "Bankwesen oder Finanzmarktinfrastrukturen", labelEn: "Banking or financial-market infrastructure" },
  { stableValue: "health", label: "Gesundheitswesen, Pharmazie oder Medizinprodukte", labelEn: "Healthcare, pharmaceuticals or medical devices" },
  { stableValue: "water", label: "Trinkwasser oder Abwasser", labelEn: "Drinking water or wastewater" },
  { stableValue: "digital", label: "Digitale Infrastruktur, IT, Telekommunikation oder Online-Dienste", labelEn: "Digital infrastructure, IT, telecommunications or online services" },
  { stableValue: "space", label: "Weltraum oder Satellitendienste", labelEn: "Space or satellite services" },
  { stableValue: "waste", label: "Abfallbewirtschaftung", labelEn: "Waste management" },
  { stableValue: "chemicals", label: "Chemikalien", labelEn: "Chemicals" },
  { stableValue: "food", label: "Lebensmittel", labelEn: "Food" },
  { stableValue: "manufacturing", label: "Verarbeitendes Gewerbe / Fertigung", labelEn: "Manufacturing" },
  { stableValue: "research", label: "Forschung", labelEn: "Research" },
  { stableValue: "none_of_these", label: "Keine dieser Bereiche", labelEn: "None of these", metadata: { exclusive: true } },
  { stableValue: "unsure", label: "Ich bin mir nicht sicher", labelEn: "I'm not sure", metadata: { exclusive: true } },
];

type ActivityRoute = "E" | "I" | "T" | "A1" | "A2" | "R" | "NO";
type ActivityKind = "activity" | "none" | "unsure";

type ActivitySelection = {
  stableValue: string;
  sectorCode: string;
  route: ActivityRoute;
  kind: ActivityKind;
  de: string;
  en: string;
  codes: string[];
  helperContentKey?: string;
  definitionContentKey?: string;
};

const activitySelections: ActivitySelection[] = [
  { stableValue: "energy_supply_networks", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir liefern Strom oder betreiben Stromnetze", en: "We supply electricity or operate electricity networks", codes: ["de_bsig_electricity_supplier", "de_bsig_electricity_distribution_operator", "de_bsig_electricity_transmission_operator"] },
  { stableValue: "energy_generation_storage_markets", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir erzeugen oder speichern Strom, aggregieren Strom, betreiben Strommärkte, erbringen Ausgleichsleistungen oder betreiben Ladeinfrastruktur für Elektrofahrzeuge", en: "We generate or store electricity, aggregate electricity, operate electricity markets, provide balancing services or operate EV charging infrastructure", codes: ["de_bsig_electricity_generation_installation_operator", "de_bsig_energy_storage_installation_operator", "de_bsig_electricity_aggregator", "de_bsig_balancing_service_provider", "de_bsig_nominated_electricity_market_operator", "de_bsig_recharging_point_operator"] },
  { stableValue: "energy_district_heating_cooling", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir betreiben Fernwärme- oder Fernkälteversorgung", en: "We operate district heating or cooling", codes: ["de_bsig_district_heating_cooling_operator"] },
  { stableValue: "energy_oil", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir fördern, raffinieren, lagern oder transportieren Erdöl oder Erdölprodukte", en: "We produce, refine, store or transport oil or petroleum products", codes: ["de_bsig_oil_transmission_pipeline_operator", "de_bsig_oil_facilities_operator", "de_bsig_central_oil_stockholding_entity"] },
  { stableValue: "energy_gas_lng", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir liefern, erzeugen, verarbeiten, speichern oder transportieren Erdgas oder betreiben Gas- oder LNG-Infrastruktur", en: "We supply, produce, process, store or transport natural gas or operate gas or LNG infrastructure", codes: ["de_bsig_gas_supplier", "de_bsig_gas_distribution_operator", "de_bsig_gas_transmission_operator", "de_bsig_gas_storage_operator", "de_bsig_lng_operator", "de_bsig_natural_gas_extraction_operator", "de_bsig_natural_gas_refining_treatment_operator"] },
  { stableValue: "energy_hydrogen", sectorCode: "energy", route: "A1", kind: "activity", de: "Wir erzeugen, speichern oder transportieren Wasserstoff", en: "We produce, store or transport hydrogen", codes: ["de_bsig_hydrogen_operator"] },
  { stableValue: "energy_none", sectorCode: "energy", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "energy_unsure", sectorCode: "energy", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "transport_air", sectorCode: "transport", route: "A1", kind: "activity", de: "Wir betreiben gewerblichen Luftverkehr, einen Flughafen oder Flugverkehrs- bzw. Flugsicherungsdienste", en: "We operate commercial air transport, an airport or air-traffic or air-navigation services", codes: ["de_bsig_commercial_air_carrier", "de_bsig_airport_entity", "de_bsig_atm_ans_provider"] },
  { stableValue: "transport_rail", sectorCode: "transport", route: "A1", kind: "activity", de: "Wir betreiben Eisenbahninfrastruktur, Eisenbahnverkehr oder Serviceeinrichtungen", en: "We operate railway infrastructure, railway services or railway service facilities", codes: ["de_bsig_rail_infrastructure_operator", "de_bsig_railway_undertaking"] },
  { stableValue: "transport_water", sectorCode: "transport", route: "A1", kind: "activity", de: "Wir transportieren Personen oder Güter auf dem Wasser oder betreiben Häfen bzw. Hafeninfrastruktur", en: "We transport passengers or freight by water or operate ports or port infrastructure", codes: ["de_bsig_water_transport_company", "de_bsig_port_entity", "de_bsig_waterway_safe_operation_system_operator"] },
  { stableValue: "transport_road_its", sectorCode: "transport", route: "A1", kind: "activity", de: "Wir betreiben Straßenverkehrsmanagement oder intelligente Verkehrssysteme", en: "We operate road-traffic management or intelligent transport systems", codes: ["de_bsig_road_traffic_influence_system_operator", "de_bsig_intelligent_transport_system_operator"] },
  { stableValue: "transport_postal_courier", sectorCode: "transport", route: "A2", kind: "activity", de: "Wir erbringen Post- oder Kurierdienste", en: "We provide postal or courier services", codes: ["de_bsig_postal_courier_provider"] },
  { stableValue: "transport_road_hitch", sectorCode: "transport", route: "NO", kind: "none", de: "Wir erbringen nur gewöhnliche Straßengüterbeförderung, Spedition oder Logistik", en: "We only provide ordinary road haulage, freight forwarding or logistics", codes: [] },
  { stableValue: "transport_none", sectorCode: "transport", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "transport_unsure", sectorCode: "transport", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "banking_credit_institution", sectorCode: "banking_financial", route: "A1", kind: "activity", de: "Wir sind ein Kreditinstitut / eine Bank", en: "We are a credit institution / bank", codes: ["de_bsig_credit_institution"] },
  { stableValue: "banking_trading_venue", sectorCode: "banking_financial", route: "A1", kind: "activity", de: "Wir betreiben einen Handelsplatz", en: "We operate a trading venue", codes: ["de_bsig_trading_venue"] },
  { stableValue: "banking_central_counterparty", sectorCode: "banking_financial", route: "A1", kind: "activity", de: "Wir sind eine zentrale Gegenpartei (CCP)", en: "We are a central counterparty (CCP)", codes: ["de_bsig_central_counterparty"] },
  { stableValue: "banking_other_financial", sectorCode: "banking_financial", route: "NO", kind: "none", de: "Wir erbringen nur sonstige Finanzdienstleistungen", en: "We provide other financial services only", codes: [] },
  { stableValue: "banking_none", sectorCode: "banking_financial", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "banking_unsure", sectorCode: "banking_financial", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "health_patient_care", sectorCode: "health", route: "A1", kind: "activity", de: "Wir erbringen Gesundheitsdienstleistungen für Patienten", en: "We provide healthcare services to patients", codes: ["de_bsig_healthcare_provider"] },
  { stableValue: "health_eu_reference_laboratory", sectorCode: "health", route: "A1", kind: "activity", de: "Wir betreiben ein EU-Referenzlaboratorium", en: "We operate an EU reference laboratory", codes: ["de_bsig_eu_reference_laboratory"] },
  { stableValue: "health_pharma_research", sectorCode: "health", route: "A1", kind: "activity", de: "Wir forschen oder entwickeln pharmazeutische Produkte", en: "We research or develop pharmaceutical products", codes: ["de_bsig_medicinal_product_researcher"] },
  { stableValue: "health_pharma_manufacture", sectorCode: "health", route: "A1", kind: "activity", de: "Wir stellen pharmazeutische Produkte her", en: "We manufacture pharmaceutical products", codes: ["de_bsig_pharmaceutical_manufacturer"] },
  { stableValue: "health_critical_medical_devices", sectorCode: "health", route: "A1", kind: "activity", de: "Wir stellen Medizinprodukte her, die in einer gesundheitlichen Notlage als kritisch eingestuft sind", en: "We manufacture medical devices classified as critical during a public-health emergency", codes: ["de_bsig_emergency_critical_medical_device_manufacturer"] },
  { stableValue: "health_other_medical_devices", sectorCode: "health", route: "A2", kind: "activity", de: "Wir stellen andere Medizinprodukte oder In-vitro-Diagnostika her", en: "We manufacture other medical devices or in-vitro diagnostic devices", codes: ["de_bsig_medical_ivd_device_manufacturer"] },
  { stableValue: "health_none", sectorCode: "health", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "health_unsure", sectorCode: "health", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "water_drinking", sectorCode: "water", route: "A1", kind: "activity", de: "Wir versorgen mit Trinkwasser", en: "We supply drinking water", codes: ["de_bsig_drinking_water_supply_operator"] },
  { stableValue: "water_wastewater", sectorCode: "water", route: "A1", kind: "activity", de: "Wir sammeln, behandeln oder beseitigen Abwasser", en: "We collect, treat or dispose of wastewater", codes: ["de_bsig_waste_water_undertaking"] },
  { stableValue: "water_none", sectorCode: "water", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "water_unsure", sectorCode: "water", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "digital_ixp", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir betreiben einen Internet-Knoten (IXP)", en: "We operate an Internet Exchange Point (IXP)", codes: ["de_bsig_internet_exchange_point_operator"] },
  { stableValue: "digital_cloud", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir erbringen Cloud-Computing-Dienste", en: "We provide cloud-computing services", codes: ["de_bsig_cloud_service_provider"] },
  { stableValue: "digital_data_centre", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir erbringen Rechenzentrumsdienste", en: "We provide data-centre services", codes: ["de_bsig_data_centre_service_provider"] },
  { stableValue: "digital_cdn", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir betreiben ein Content-Delivery-Network (CDN)", en: "We operate a Content Delivery Network (CDN)", codes: ["de_bsig_content_delivery_network_operator"] },
  { stableValue: "digital_msp", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir verwalten oder betreiben kontinuierlich IT-Systeme von Kunden", en: "We continuously manage or operate customers' IT systems", codes: ["de_bsig_managed_service_provider"], helperContentKey: "nis2.question.bc.activity.option.digital_msp.helper" },
  { stableValue: "digital_mssp", sectorCode: "digital", route: "A1", kind: "activity", de: "Wir verwalten oder betreiben kontinuierlich Cybersicherheitsdienste für Kunden", en: "We continuously manage or operate cybersecurity services for customers", codes: ["de_bsig_managed_security_service_provider"], helperContentKey: "nis2.question.bc.activity.option.digital_mssp.helper" },
  { stableValue: "digital_dns", sectorCode: "digital", route: "E", kind: "activity", de: "Wir erbringen DNS-Dienste", en: "We provide DNS services", codes: ["de_bsig_dns_service_provider"] },
  { stableValue: "digital_tld_registry", sectorCode: "digital", route: "E", kind: "activity", de: "Wir betreiben ein Top-Level-Domain-Register", en: "We operate a top-level-domain registry", codes: ["de_bsig_tld_registry"] },
  { stableValue: "digital_qualified_trust", sectorCode: "digital", route: "E", kind: "activity", de: "Wir erbringen qualifizierte Vertrauensdienste", en: "We provide qualified trust services", codes: ["de_bsig_qualified_trust_service_provider"] },
  { stableValue: "digital_other_trust", sectorCode: "digital", route: "I", kind: "activity", de: "Wir erbringen sonstige (nicht qualifizierte) Vertrauensdienste", en: "We provide other or non-qualified trust services", codes: ["de_bsig_non_qualified_trust_service_provider"] },
  { stableValue: "digital_telecom", sectorCode: "digital", route: "T", kind: "activity", de: "Wir betreiben ein öffentliches Telekommunikationsnetz oder erbringen öffentlich zugängliche Telekommunikationsdienste", en: "We operate a public telecommunications network or provide publicly available telecommunications services", codes: ["de_bsig_public_telecom_network_operator", "de_bsig_publicly_available_telecom_service_provider"] },
  { stableValue: "digital_marketplace", sectorCode: "digital", route: "A2", kind: "activity", de: "Wir betreiben einen Online-Marktplatz", en: "We operate an online marketplace", codes: ["de_bsig_online_marketplace_provider"] },
  { stableValue: "digital_search_engine", sectorCode: "digital", route: "A2", kind: "activity", de: "Wir betreiben eine Online-Suchmaschine", en: "We operate an online search engine", codes: ["de_bsig_online_search_engine_provider"] },
  { stableValue: "digital_social_network", sectorCode: "digital", route: "A2", kind: "activity", de: "Wir betreiben eine Plattform für soziale Netzwerke", en: "We operate a social-network platform", codes: ["de_bsig_social_networking_platform_provider"] },
  { stableValue: "digital_domain_registration", sectorCode: "digital", route: "R", kind: "activity", de: "Wir erbringen Domänennamen-Registrierungsdienste", en: "We provide domain-name registration services", codes: ["de_bsig_domain_name_registry_service_provider"] },
  { stableValue: "digital_software_only", sectorCode: "digital", route: "NO", kind: "none", de: "Wir entwickeln nur Software, erbringen IT-Beratung oder betreiben unsere eigene interne IT", en: "We only develop software, provide IT consulting or operate our own internal IT", codes: [] },
  { stableValue: "digital_none", sectorCode: "digital", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "digital_unsure", sectorCode: "digital", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "space_ground_infrastructure", sectorCode: "space", route: "A1", kind: "activity", de: "Wir betreiben bodengestützte Infrastruktur für weltraumgestützte Dienste", en: "We operate ground infrastructure supporting space-based services", codes: ["de_bsig_space_ground_infrastructure_operator"] },
  { stableValue: "space_manufacture", sectorCode: "space", route: "A2", kind: "activity", de: "Wir stellen Satelliten, Raumfahrzeuge oder zugehörige Ausrüstung her", en: "We manufacture satellites, spacecraft or related equipment", codes: ["de_bsig_nace30_other_transport_equipment_manufacturer"] },
  { stableValue: "space_none", sectorCode: "space", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "space_unsure", sectorCode: "space", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "waste_main_activity", sectorCode: "waste", route: "A2", kind: "activity", de: "Abfallbewirtschaftung ist eine unserer Hauptgeschäftstätigkeiten", en: "Waste management is one of our main business activities", codes: ["de_bsig_waste_management_undertaking"] },
  { stableValue: "waste_own_only", sectorCode: "waste", route: "NO", kind: "none", de: "Wir behandeln nur Abfälle, die in unserer eigenen Organisation anfallen", en: "We only handle waste generated by our own organisation", codes: [] },
  { stableValue: "waste_none", sectorCode: "waste", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "waste_unsure", sectorCode: "waste", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "chemicals_manufacture_import", sectorCode: "chemicals", route: "A2", kind: "activity", de: "Wir stellen unter die einschlägige REACH- bzw. Chemikalienherstellungskategorie fallende Stoffe oder Gemische her oder importieren sie", en: "We manufacture or import covered chemical substances or mixtures under the relevant REACH or chemical-manufacturing category", codes: ["de_bsig_reach_registered_nace20_chemical_manufacturer_importer"], definitionContentKey: "nis2.question.bc.activity.option.chemicals_manufacture_import.definition" },
  { stableValue: "chemicals_use_only", sectorCode: "chemicals", route: "NO", kind: "none", de: "Wir verwenden nur von anderen Unternehmen gekaufte chemische Produkte", en: "We only use chemical products purchased from other companies", codes: [] },
  { stableValue: "chemicals_none", sectorCode: "chemicals", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "chemicals_unsure", sectorCode: "chemicals", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher, ob unsere Chemikalientätigkeit diese Definition erfüllt", en: "I'm not sure whether our chemicals activity meets this definition", codes: ["unsure"] },

  { stableValue: "food_wholesale", sectorCode: "food", route: "A2", kind: "activity", de: "Wir handeln im Großhandel mit Lebensmitteln", en: "We wholesale food products", codes: ["de_bsig_food_wholesale_industrial_business"] },
  { stableValue: "food_industrial", sectorCode: "food", route: "A2", kind: "activity", de: "Wir produzieren oder verarbeiten Lebensmittel industriell", en: "We industrially produce or process food products", codes: ["de_bsig_food_wholesale_industrial_business"] },
  { stableValue: "food_retail_only", sectorCode: "food", route: "NO", kind: "none", de: "Wir betreiben nur Einzelhandel, Restaurants oder Catering", en: "We only operate retail, restaurants or catering", codes: [] },
  { stableValue: "food_none", sectorCode: "food", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "food_unsure", sectorCode: "food", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "manufacturing_medical_devices", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen Medizinprodukte oder In-vitro-Diagnostika her", en: "We manufacture medical devices or in-vitro diagnostic devices", codes: ["de_bsig_medical_ivd_device_manufacturer"] },
  { stableValue: "manufacturing_computers", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen Computer, elektronische oder optische Erzeugnisse her", en: "We manufacture computers, electronic or optical products", codes: ["de_bsig_nace26_computer_electronic_optical_manufacturer"] },
  { stableValue: "manufacturing_electrical", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen elektrische Ausrüstungen her", en: "We manufacture electrical equipment", codes: ["de_bsig_nace27_electrical_equipment_manufacturer"] },
  { stableValue: "manufacturing_machinery", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen Maschinen her", en: "We manufacture machinery", codes: ["de_bsig_nace28_machinery_manufacturer"] },
  { stableValue: "manufacturing_vehicles", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen Kraftwagen oder Kraftwagenteile her", en: "We manufacture motor vehicles or motor-vehicle parts", codes: ["de_bsig_nace29_motor_vehicle_manufacturer"] },
  { stableValue: "manufacturing_other_transport", sectorCode: "manufacturing", route: "A2", kind: "activity", de: "Wir stellen sonstige Fahrzeuge her", en: "We manufacture other transport equipment", codes: ["de_bsig_nace30_other_transport_equipment_manufacturer"] },
  { stableValue: "manufacturing_other_only", sectorCode: "manufacturing", route: "NO", kind: "none", de: "Wir stellen nur andere Produkte her", en: "We manufacture other products only", codes: [] },
  { stableValue: "manufacturing_none", sectorCode: "manufacturing", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "manufacturing_unsure", sectorCode: "manufacturing", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },

  { stableValue: "research_applied_commercial", sectorCode: "research", route: "A2", kind: "activity", de: "Unser Hauptzweck ist angewandte Forschung oder experimentelle Entwicklung zur kommerziellen Nutzung", en: "Our primary purpose is applied research or experimental development intended for commercial exploitation", codes: ["de_bsig_research_organisation"] },
  { stableValue: "research_education_only", sectorCode: "research", route: "NO", kind: "none", de: "Wir sind in erster Linie eine Bildungseinrichtung", en: "We are primarily an educational institution", codes: [] },
  { stableValue: "research_none", sectorCode: "research", route: "NO", kind: "none", de: "Keine dieser Tätigkeiten", en: "None of these", codes: ["none_of_these"] },
  { stableValue: "research_unsure", sectorCode: "research", route: "NO", kind: "unsure", de: "Ich bin mir nicht sicher", en: "I'm not sure", codes: ["unsure"] },
];

const nis2ActivityOptions: Nis2SeedOption[] = activitySelections.map((item) => ({
  stableValue: item.stableValue,
  label: item.de,
  labelEn: item.en,
  metadata: {
    sectorCode: item.sectorCode,
    route: item.route,
    kind: item.kind,
    exclusive: item.kind !== "activity",
    ...(item.helperContentKey ? { helperContentKey: item.helperContentKey } : {}),
    ...(item.definitionContentKey ? { definitionContentKey: item.definitionContentKey } : {}),
  },
}));

const activityFactMapping: Nis2SeedFactMapping = {
  factKey: "nis2_entity_types",
  byOption: Object.fromEntries(
    activitySelections.map((item) => [
      item.stableValue,
      item.codes.length > 0 ? item.codes : null,
    ]),
  ),
};

const sizeRouteCondition = {
  any: [
    {
      all: [
        { questionStableKey: "bc.germany_connection", operator: "equals", value: "de_telecom_provider" },
        { questionStableKey: "bc.special_status", operator: "in", values: ["none", "important"] },
      ],
    },
    {
      all: [
        { questionStableKey: "bc.germany_connection", operator: "in", values: ["de_established", "de_cross_border_digital_provider"] },
        { questionStableKey: "bc.special_status", operator: "in", values: ["none", "important"] },
        { questionStableKey: "bc.activity", operator: "route_in", values: ["T", "A1", "A2"] },
      ],
    },
  ],
};

const sizeBucketOptions = [
  { stableValue: "under_50", label: "Unter 50", labelEn: "Fewer than 50" },
  { stableValue: "50_249", label: "50–249", labelEn: "50–249" },
  { stableValue: "250_plus", label: "250 oder mehr", labelEn: "250 or more" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const turnoverOptions = [
  { stableValue: "revenue_at_most_10m", label: "Höchstens 10 Mio. €", labelEn: "EUR 10 million or less" },
  { stableValue: "revenue_over_10m_to_50m", label: "Über 10 bis einschließlich 50 Mio. €", labelEn: "More than EUR 10 million and up to EUR 50 million" },
  { stableValue: "revenue_over_50m", label: "Über 50 Mio. €", labelEn: "More than EUR 50 million" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const balanceSheetOptions = [
  { stableValue: "balance_at_most_10m", label: "Höchstens 10 Mio. €", labelEn: "EUR 10 million or less" },
  { stableValue: "balance_over_10m_to_43m", label: "Über 10 bis einschließlich 43 Mio. €", labelEn: "More than EUR 10 million and up to EUR 43 million" },
  { stableValue: "balance_over_43m", label: "Über 43 Mio. €", labelEn: "More than EUR 43 million" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const aggregationOptions: Nis2SeedOption[] = [
  { stableValue: "verified_de_without_it_exception", label: "Ja", labelEn: "Yes" },
  { stableValue: "not_applicable_no_partner_or_linked_enterprises", label: "Wir haben keine relevanten Partner- oder verbundenen Unternehmen", labelEn: "We have no relevant partner or linked companies" },
  { stableValue: "verified_de_with_it_exception", label: "Ja, unter Berücksichtigung der BSIG-IT-Unabhängigkeitsausnahme", labelEn: "Yes, taking the BSIG IT-independence exception into account" },
  { stableValue: "no", label: "Nein", labelEn: "No" },
  { stableValue: "unsure", label: "Ich bin mir nicht sicher", labelEn: "I'm not sure" },
];

export const nis2Questions: Nis2SeedQuestion[] = [
  {
    stableKey: "bc.germany_connection",
    position: 1,
    questionText: "Welche Aussage trifft auf die bewertete Organisation zu?",
    questionTextEn: "Which statement applies to the organisation being assessed?",
    helpText: "Die Antwort bestimmt, ob und auf welcher Grundlage Deutschland für die Prüfung zuständig ist.",
    helpTextEn: "The answer determines whether and on which basis Germany is competent for this assessment.",
    tooltipText: "Für die deutsche Einstufung sind Niederlassung, kritische Anlagen, die Bundesverwaltung, grenzüberschreitende digitale Dienste, öffentliche Telekommunikationsdienste oder eine regionale Verwaltung nach Landesrecht entscheidend. Die eigene Einschätzung der Ausfallfolgen reicht nicht aus.",
    tooltipTextEn: "For the German classification, the decisive factors are establishment, critical installations, the federal administration, cross-border digital services, public telecommunications services or regional administration under Land law. Your own assessment of outage impact is not sufficient.",
    answerType: "single_choice",
    required: true,
    options: germanyConnectionOptions,
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
          de_telecom_provider: ["de_bsig_public_telecom_network_operator", "de_bsig_publicly_available_telecom_service_provider"],
          de_regional_administration: ["de_bsig_regional_public_administration"],
        },
      },
      {
        factKey: "employee_count_bucket",
        byOption: { de_critical_installation: "under_50" },
      },
      {
        factKey: "annual_revenue_bucket",
        byOption: { de_critical_installation: "revenue_at_most_10m" },
      },
      {
        factKey: "balance_sheet_total_bucket",
        byOption: { de_critical_installation: "balance_at_most_10m" },
      },
      {
        factKey: "sme_figures_verified",
        byOption: { de_critical_installation: "verified_de_without_it_exception" },
      },
    ],
    config: { section: "jurisdiction", ui: { control: "wizard_choice" } },
  },
  {
    stableKey: "bc.special_status",
    position: 2,
    questionText: "Trifft bereits eine der folgenden besonderen rechtlichen Einstufungen auf die Organisation zu?",
    questionTextEn: "Does any of the following already apply to the organisation?",
    helpText: "Gemeint sind formale Einstufungen durch eine Behörde oder eine Benennung nach der CER-Richtlinie, nicht die eigene Einschätzung der Ausfallfolgen.",
    helpTextEn: "This means formal classifications by an authority or a designation under the CER Directive, not your own assessment of outage impact.",
    tooltipText: "Wählen Sie hier eine Einstufung aus, wenn eine Behörde oder ein EU-Mitgliedstaat Ihre Organisation ausdrücklich als besonders relevant eingestuft hat. Die eigene Einschätzung, dass ein Ausfall schwerwiegende Folgen hätte, reicht dafür nicht aus.",
    tooltipTextEn: "Select a classification here if an authority or an EU Member State has expressly classified your organization as particularly relevant. Your own assessment that an outage would have serious consequences is not sufficient.",
    answerType: "single_choice",
    required: true,
    options: specialStatusOptions,
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
      ui: { control: "wizard_choice" },
      visibleWhen: {
        questionStableKey: "bc.germany_connection",
        operator: "in",
        values: ["de_established", "de_cross_border_digital_provider", "de_telecom_provider"],
      },
    },
  },
  {
    stableKey: "bc.sector",
    position: 3,
    questionText: "In welchen Bereichen ist Ihre Organisation selbst tätig?",
    questionTextEn: "In which areas does your organisation itself operate?",
    helpText: "Wählen Sie alle zutreffenden Bereiche aus.",
    helpTextEn: "Select all areas that apply.",
    tooltipText: "Entscheidend ist, in welchen Bereichen Ihre Organisation selbst Leistungen erbringt. Der Einkauf oder die Nutzung von Diensten anderer Unternehmen begründet für sich genommen noch keinen Bereich.",
    tooltipTextEn: "What matters is the areas in which your organisation itself provides services. Purchasing or using services from other companies does not by itself establish an area.",
    answerType: "multi_choice",
    required: true,
    options: sectorOptions,
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
      ui: { control: "wizard_sections" },
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
    questionText: "Welche dieser Tätigkeiten führt Ihre Organisation selbst aus?",
    questionTextEn: "Which of these activities does your organisation itself perform?",
    helpText: "Wählen Sie alle zutreffenden Tätigkeiten aus. Wählen Sie nichts nur deshalb aus, weil Ihre Organisation es einkauft oder nutzt.",
    helpTextEn: "Select all that apply. Do not select something simply because your organisation purchases or uses it.",
    tooltipText: "Die Auswahl wird auf die im deutschen BSI-Gesetz Anlage 1 und 2 sowie in den Sonderfällen geregelten Einrichtungsidentitäten abgebildet. Es gelten die im Gesetz in Bezug genommenen sektorspezifischen Definitionen.",
    tooltipTextEn: "Selections are mapped onto the entity identities defined in German BSIG Annexes 1 and 2 and in special cases. The sector-specific Union-law definitions referenced by the statute apply.",
    answerType: "multi_choice",
    required: true,
    options: nis2ActivityOptions,
    factKey: "nis2_entity_types",
    factMappings: [activityFactMapping],
    config: {
      section: "activity",
      ui: { control: "wizard_sections" },
      visibleWhen: {
        any: [
          { questionStableKey: "bc.germany_connection", operator: "equals", value: "de_cross_border_digital_provider" },
          {
            all: [
              { questionStableKey: "bc.germany_connection", operator: "equals", value: "de_established" },
              { questionStableKey: "bc.sector", operator: "contains_any", values: activitySectorCodes },
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
    questionText: "Wie viele Mitarbeitende hat die maßgebliche Unternehmenseinheit?",
    questionTextEn: "How many employees does the relevant enterprise have?",
    helpText: "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
    helpTextEn: "Select the applicable range. Exact figures are not required.",
    tooltipText: "Gemeint ist die für die Unternehmensgröße maßgebliche Zahl der Mitarbeitenden. Dabei können je nach Unternehmensstruktur auch verbundene Unternehmen oder Partnerunternehmen berücksichtigt werden. Wählen Sie „Unsicher“, wenn Ihnen die genaue Zahl nicht bekannt ist.",
    tooltipTextEn: "This means the employee count relevant for determining company size. Depending on the company structure, linked enterprises or partner enterprises may also need to be taken into account. Select “Unsure” if you do not know the exact figure.",
    answerType: "single_choice",
    required: true,
    options: sizeBucketOptions,
    factKey: "employee_count_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: sizeRouteCondition },
  },
  {
    stableKey: "bc.annual_revenue",
    position: 6,
    questionText: "Wie hoch ist der maßgebliche Jahresumsatz?",
    questionTextEn: "What is the relevant annual turnover?",
    helpText: "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
    helpTextEn: "Select the applicable range. Exact figures are not required.",
    tooltipText: "Gemeint ist der Jahresumsatz, der für die Bestimmung der Unternehmensgröße berücksichtigt wird. Bei verbundenen Unternehmen oder Partnerunternehmen müssen möglicherweise weitere Umsätze ganz oder teilweise einbezogen werden.",
    tooltipTextEn: "This means the annual turnover taken into account when determining company size. For linked enterprises or partner enterprises, additional turnover may need to be included in full or in part.",
    answerType: "single_choice",
    required: true,
    options: turnoverOptions,
    factKey: "annual_revenue_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: sizeRouteCondition },
  },
  {
    stableKey: "bc.balance_sheet_total",
    position: 7,
    questionText: "Wie hoch ist die maßgebliche Jahresbilanzsumme?",
    questionTextEn: "What is the relevant annual balance-sheet total?",
    helpText: "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
    helpTextEn: "Select the applicable range. Exact figures are not required.",
    tooltipText: "Die Jahresbilanzsumme finden Sie in der Bilanz des letzten abgeschlossenen Geschäftsjahres. Bei verbundenen Unternehmen oder Partnerunternehmen müssen möglicherweise weitere Werte ganz oder teilweise berücksichtigt werden.",
    tooltipTextEn: "The annual balance-sheet total can be found in the balance sheet for the most recently completed financial year. For linked enterprises or partner enterprises, additional figures may need to be taken into account in full or in part.",
    answerType: "single_choice",
    required: true,
    options: balanceSheetOptions,
    factKey: "balance_sheet_total_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: sizeRouteCondition },
  },
  {
    stableKey: "bc.aggregation",
    position: 8,
    questionText: "Beziehen sich die oben angegebenen Größenspannen bereits auf relevante Partner- und verbundene Unternehmen?",
    questionTextEn: "Do the size ranges above already take relevant partner and linked companies into account?",
    helpText: "Eine bloße Konzernzugehörigkeit entscheidet nicht über NIS2. Entscheidend ist, dass die Mitarbeiteranzahl und die Finanzwerte einschließlich der Aggregationsregeln korrekt ermittelt wurden.",
    helpTextEn: "Mere membership of a corporate group does not determine NIS2 applicability. What matters is that the employee count and financial figures were calculated correctly, including the aggregation rules.",
    tooltipText: "Gehört Ihre Organisation zu einer Unternehmensgruppe oder bestehen Beteiligungen an anderen Unternehmen, müssen deren Mitarbeiteranzahlen, Umsätze und Bilanzsummen möglicherweise ganz oder teilweise mitgerechnet werden. Die deutsche IT-Unabhängigkeitsausnahme kann in eng begrenzten Fällen einzelne verbundene Unternehmen ausnehmen.",
    tooltipTextEn: "If your organization belongs to a corporate group or has holdings in other companies, their employee counts, turnover and balance-sheet totals may need to be included in full or in part. The German IT-independence exception may, in narrowly defined cases, exclude individual linked enterprises.",
    answerType: "single_choice",
    required: true,
    options: aggregationOptions,
    factKey: "sme_figures_verified",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: sizeRouteCondition },
  },
];

export const nis2ScopeRuleSet = {
  kind: "nis2_scope_v2",
  version: 2,
  profileVersion: "eu-core-2026-01",
  disclaimer: "Diese automatisierte Einstufung ist eine nachvollziehbare Vorprüfung und ersetzt keine rechtliche Beratung oder behördliche Entscheidung.",
  disclaimerEn: "This automated classification is a traceable preliminary assessment and does not replace legal advice or an authority decision.",
  outcomes: {
    essential_entity: { label: "Wesentliche Einrichtung", labelEn: "Essential entity" },
    important_entity: { label: "Wichtige Einrichtung", labelEn: "Important entity" },
    not_directly_in_scope: { label: "Nicht direkt im Anwendungsbereich", labelEn: "Not directly in scope" },
    clarification_required: { label: "Klärung erforderlich", labelEn: "Clarification required" },
  },
  entityTypes: nis2EntityTypes,
  countryProfiles: {
    DE: {
      countryCode: "DE",
      version: "de-bsig-2025-amended-2026-03",
      supported: true,
      allowNegativeConclusion: true,
      legalReferences: [
        "BSIG vom 2. Dezember 2025, zuletzt geändert am 11. März 2026, § 28 sowie Anlagen 1 und 2",
        "Directive (EU) 2022/2555, Articles 2, 3 and 26",
      ],
    },
  },
};
