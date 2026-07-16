import type {
  Nis2EntityRule,
  Nis2EntityType,
  Nis2ScopeRuleSetDocument,
} from "./rule-set-schema";

export type Nis2SeedOption = {
  stableValue: string;
  label: string;
  labelEn: string;
  metadata?: Record<string, unknown>;
};

export type Nis2SeedQuestion = {
  stableKey: string;
  position: number;
  questionText: string;
  questionTextEn: string;
  helpText?: string;
  helpTextEn?: string;
  answerType: "single_choice" | "multi_choice";
  required: boolean;
  options: Nis2SeedOption[];
  factKey: string;
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
): Nis2EntityType {
  return {
    code,
    sectorCode,
    annex,
    label,
    labelEn,
    description: `Rechtlich definierte Einrichtungsart: ${label}.`,
    descriptionEn: `Legally defined entity type: ${labelEn}.`,
    legalReference:
      annex === null
        ? "Directive (EU) 2022/2555, Articles 2(4) and 28"
        : `Directive (EU) 2022/2555, Annex ${annex === 1 ? "I" : "II"}, ${section}`,
    rule,
  };
}

export const nis2EntityTypes: Nis2EntityType[] = [
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

const yesNoUnsureOptions: Nis2SeedOption[] = [
  { stableValue: "yes", label: "Ja", labelEn: "Yes" },
  { stableValue: "no", label: "Nein", labelEn: "No" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const countryOptions: Nis2SeedOption[] = [
  ["DE", "Deutschland", "Germany"], ["AT", "Österreich", "Austria"],
  ["BE", "Belgien", "Belgium"], ["BG", "Bulgarien", "Bulgaria"],
  ["HR", "Kroatien", "Croatia"], ["CY", "Zypern", "Cyprus"],
  ["CZ", "Tschechien", "Czechia"], ["DK", "Dänemark", "Denmark"],
  ["EE", "Estland", "Estonia"], ["FI", "Finnland", "Finland"],
  ["FR", "Frankreich", "France"], ["GR", "Griechenland", "Greece"],
  ["HU", "Ungarn", "Hungary"], ["IE", "Irland", "Ireland"],
  ["IT", "Italien", "Italy"], ["LV", "Lettland", "Latvia"],
  ["LT", "Litauen", "Lithuania"], ["LU", "Luxemburg", "Luxembourg"],
  ["MT", "Malta", "Malta"], ["NL", "Niederlande", "Netherlands"],
  ["PL", "Polen", "Poland"], ["PT", "Portugal", "Portugal"],
  ["RO", "Rumänien", "Romania"], ["SK", "Slowakei", "Slovakia"],
  ["SI", "Slowenien", "Slovenia"], ["ES", "Spanien", "Spain"],
  ["SE", "Schweden", "Sweden"],
].map(([stableValue, label, labelEn]) => ({ stableValue, label, labelEn }));
countryOptions.push({ stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" });

const entityTypeOptions: Nis2SeedOption[] = nis2EntityTypes.map((item) => {
  const sector = nis2SectorGroups.find((group) => group.code === item.sectorCode);
  return {
    stableValue: item.code,
    label: item.label,
    labelEn: item.labelEn,
    metadata: {
      sectorCode: item.sectorCode,
      sectorLabel: sector?.label,
      sectorLabelEn: sector?.labelEn,
      annex: item.annex,
      description: item.description,
      descriptionEn: item.descriptionEn,
      legalReference: item.legalReference,
    },
  };
});
entityTypeOptions.push(
  {
    stableValue: "none_of_these",
    label: "Keine dieser Einrichtungsarten",
    labelEn: "None of these entity types",
    metadata: { exclusive: true },
  },
  {
    stableValue: "unsure",
    label: "Unsicher",
    labelEn: "Unsure",
    metadata: { exclusive: true },
  },
);

const visibleForEuActivity = {
  questionStableKey: "bc.eu_activity",
  operator: "equals",
  value: "yes",
};

export const nis2Questions: Nis2SeedQuestion[] = [
  {
    stableKey: "bc.eu_activity",
    position: 1,
    questionText: "Erbringt Ihre Organisation relevante Dienste oder Tätigkeiten innerhalb der Europäischen Union?",
    questionTextEn: "Does your organization provide relevant services or carry out relevant activities within the European Union?",
    helpText: "NIS2 setzt grundsätzlich eine Tätigkeit oder Dienstleistung innerhalb der EU voraus.",
    helpTextEn: "NIS2 generally requires an activity or service within the EU.",
    answerType: "single_choice",
    required: true,
    options: yesNoUnsureOptions,
    factKey: "eu_activity",
    config: { section: "jurisdiction", ui: { control: "buttons" } },
  },
  {
    stableKey: "bc.entity_types",
    position: 2,
    questionText: "Welche der rechtlich definierten Einrichtungsarten treffen auf Ihre Organisation zu?",
    questionTextEn: "Which legally defined entity types apply to your organization?",
    helpText: "Wählen Sie alle passenden Tätigkeiten. Die Sektorüberschriften dienen nur der Gruppierung; entscheidend ist die konkrete Einrichtungsart.",
    helpTextEn: "Select every applicable activity. Sector headings only group the choices; the exact entity type determines scope.",
    answerType: "multi_choice",
    required: true,
    options: entityTypeOptions,
    factKey: "nis2_entity_types",
    config: {
      section: "entity_type",
      ui: { control: "searchable_multi_select" },
      visibleWhen: visibleForEuActivity,
    },
  },
  {
    stableKey: "bc.jurisdiction_country",
    position: 3,
    questionText: "Welcher EU-Mitgliedstaat ist für diese Prüfung hauptsächlich zuständig?",
    questionTextEn: "Which EU Member State is primarily competent for this assessment?",
    helpText: "Für Deutschland ist ein vollständiges nationales Profil hinterlegt. Andere Staaten werden zunächst nach dem EU-Kern geprüft.",
    helpTextEn: "A complete national profile is available for Germany. Other countries are initially checked against the EU core.",
    answerType: "single_choice",
    required: true,
    options: countryOptions,
    factKey: "jurisdiction_country",
    config: {
      section: "jurisdiction",
      ui: { control: "select" },
      visibleWhen: visibleForEuActivity,
    },
  },
  {
    stableKey: "bc.jurisdiction_basis",
    position: 4,
    questionText: "Woraus ergibt sich die Zuständigkeit dieses Mitgliedstaats?",
    questionTextEn: "What is the basis for that Member State's jurisdiction?",
    helpText: "Die Zuständigkeit richtet sich je nach Einrichtungsart nach Niederlassung, Dienstleistungsort, Hauptniederlassung oder EU-Vertreter.",
    helpTextEn: "Depending on the entity type, jurisdiction follows establishment, service location, main establishment or an EU representative.",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "establishment", label: "Niederlassung in diesem Staat", labelEn: "Establishment in this country" },
      { stableValue: "telecom_service_location", label: "Erbringung öffentlicher Telekommunikationsdienste in diesem Staat", labelEn: "Public telecom services provided in this country" },
      { stableValue: "main_eu_establishment", label: "Hauptniederlassung in der EU in diesem Staat", labelEn: "Main EU establishment in this country" },
      { stableValue: "eu_representative", label: "Benannter EU-Vertreter in diesem Staat", labelEn: "Designated EU representative in this country" },
      { stableValue: "public_administration", label: "Durch diesen Staat errichtete Verwaltungseinrichtung", labelEn: "Public administration established by this country" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "jurisdiction_basis",
    config: {
      section: "jurisdiction",
      ui: { control: "select" },
      visibleWhen: visibleForEuActivity,
    },
  },
  {
    stableKey: "bc.member_state_designation",
    position: 5,
    questionText: "Liegt eine besondere behördliche Einstufung Ihrer Organisation vor?",
    questionTextEn: "Has your organization received a special authority classification?",
    helpText: "Gemeint sind formale Einstufungen durch einen Mitgliedstaat oder eine Benennung nach der CER-Richtlinie, nicht die eigene Einschätzung der Ausfallfolgen.",
    helpTextEn: "This means a formal Member-State classification or CER designation, not your own assessment of outage impact.",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "none", label: "Keine besondere Einstufung", labelEn: "No special classification" },
      { stableValue: "essential", label: "Als wesentliche Einrichtung eingestuft", labelEn: "Classified as an essential entity" },
      { stableValue: "important", label: "Als wichtige Einrichtung eingestuft", labelEn: "Classified as an important entity" },
      { stableValue: "cer_critical", label: "Als kritische Einrichtung nach CER benannt", labelEn: "Designated as a critical entity under CER" },
      { stableValue: "de_critical_installation", label: "Betreiber einer kritischen Anlage nach deutschem BSIG", labelEn: "Operator of a critical installation under the German BSIG" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "member_state_designation",
    config: {
      section: "special_status",
      ui: { control: "select" },
      visibleWhen: visibleForEuActivity,
    },
  },
  {
    stableKey: "bc.employee_count",
    position: 6,
    questionText: "Wie viele Mitarbeitende hat die maßgebliche Unternehmenseinheit?",
    questionTextEn: "How many employees does the relevant enterprise have?",
    helpText: "Verwenden Sie die nach der KMU-Empfehlung maßgebliche Jahresarbeitseinheitenzahl.",
    helpTextEn: "Use the annual-work-unit count relevant under the SME Recommendation.",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "under_50", label: "Unter 50", labelEn: "Fewer than 50" },
      { stableValue: "50_249", label: "50–249", labelEn: "50–249" },
      { stableValue: "250_plus", label: "250 oder mehr", labelEn: "250 or more" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "employee_count_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.annual_revenue",
    position: 7,
    questionText: "Wie hoch ist der maßgebliche Jahresumsatz?",
    questionTextEn: "What is the relevant annual turnover?",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "revenue_at_most_10m", label: "Höchstens 10 Mio. €", labelEn: "EUR 10 million or less" },
      { stableValue: "revenue_over_10m_to_50m", label: "Über 10 bis einschließlich 50 Mio. €", labelEn: "More than EUR 10 million and up to EUR 50 million" },
      { stableValue: "revenue_over_50m", label: "Über 50 Mio. €", labelEn: "More than EUR 50 million" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "annual_revenue_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.balance_sheet_total",
    position: 8,
    questionText: "Wie hoch ist die maßgebliche Jahresbilanzsumme?",
    questionTextEn: "What is the relevant annual balance-sheet total?",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "balance_at_most_10m", label: "Höchstens 10 Mio. €", labelEn: "EUR 10 million or less" },
      { stableValue: "balance_over_10m_to_43m", label: "Über 10 bis einschließlich 43 Mio. €", labelEn: "More than EUR 10 million and up to EUR 43 million" },
      { stableValue: "balance_over_43m", label: "Über 43 Mio. €", labelEn: "More than EUR 43 million" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "balance_sheet_total_bucket",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.sme_figures_verified",
    position: 9,
    questionText: "Wurden diese Größenangaben nach der Empfehlung 2003/361/EG einschließlich erforderlicher Partner- und verbundener Unternehmen ermittelt?",
    questionTextEn: "Were these size figures calculated under Recommendation 2003/361/EC, including required partner and linked enterprises?",
    helpText: "Eine bloße Konzernzugehörigkeit entscheidet nicht über NIS2; maßgeblich sind die korrekt ermittelten Größenwerte.",
    helpTextEn: "Group membership alone does not determine NIS2 scope; the correctly calculated size figures do.",
    answerType: "single_choice",
    required: true,
    options: yesNoUnsureOptions,
    factKey: "sme_figures_verified",
    config: { section: "size", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.sector_specific_regime",
    position: 10,
    questionText: "Gilt für Ihre Organisation ein vorrangiges oder sektorspezifisches Cybersicherheitsregelwerk?",
    questionTextEn: "Is your organization subject to a prevailing or sector-specific cybersecurity regime?",
    helpText: "Diese Regelwerke ändern nicht automatisch die NIS2-Einstufung, können aber einzelne Pflichten ersetzen oder verlagern.",
    helpTextEn: "These regimes do not automatically change the NIS2 classification, but may replace or redirect individual duties.",
    answerType: "single_choice",
    required: true,
    options: [
      { stableValue: "none", label: "Keines bekannt", labelEn: "None known" },
      { stableValue: "dora", label: "DORA für Finanzunternehmen", labelEn: "DORA for financial entities" },
      { stableValue: "de_telecom_energy", label: "Deutsche Telekommunikations- oder Energievorschriften", labelEn: "German telecom or energy provisions" },
      { stableValue: "other", label: "Anderes sektorspezifisches Regelwerk", labelEn: "Other sector-specific regime" },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "sector_specific_regime",
    config: { section: "national_overlays", ui: { control: "select" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.critical_customers",
    position: 11,
    questionText: "Erbringt Ihre Organisation Leistungen für wesentliche oder wichtige Einrichtungen?",
    questionTextEn: "Does your organization provide services to essential or important entities?",
    helpText: "Diese Antwort beeinflusst nur den separaten Hinweis zur indirekten Lieferkettenbetroffenheit.",
    helpTextEn: "This answer only affects the separate indirect supply-chain exposure notice.",
    answerType: "single_choice",
    required: true,
    options: yesNoUnsureOptions,
    factKey: "serves_critical_customers",
    config: { section: "indirect_exposure", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
  {
    stableKey: "bc.security_evidence_requested",
    position: 12,
    questionText: "Fordern Kunden vertraglich Informationssicherheitsmaßnahmen oder entsprechende Nachweise?",
    questionTextEn: "Do customers contractually require information-security measures or related evidence?",
    helpText: "Vertragliche Anforderungen können eine indirekte Betroffenheit begründen, ändern aber nicht die gesetzliche Einstufung.",
    helpTextEn: "Contractual requirements may create indirect exposure but do not change the statutory classification.",
    answerType: "single_choice",
    required: true,
    options: yesNoUnsureOptions,
    factKey: "has_customer_security_evidence_requests",
    config: { section: "indirect_exposure", ui: { control: "buttons" }, visibleWhen: visibleForEuActivity },
  },
];

export const nis2ScopeRuleSet: Nis2ScopeRuleSetDocument = {
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
