import type { Locale } from "@/src/i18n/config";
import { defineFeatureMessages } from "@/src/i18n/define-messages";

export const nis2ReleaseMessages = defineFeatureMessages({
  de: {
    nis2Release: {
      "nis2.fact.eu_activity.label": "Tätigkeit in der EU",
      "nis2.fact.eu_activity.description":
        "Ob relevante Dienste oder Tätigkeiten innerhalb der EU erbracht werden.",
      "nis2.fact.jurisdiction_country.label": "Zuständiger Mitgliedstaat",
      "nis2.fact.jurisdiction_country.description":
        "Mitgliedstaat, dessen Zuständigkeit nach Artikel 26 geprüft wird.",
      "nis2.fact.jurisdiction_basis.label": "Grundlage der Zuständigkeit",
      "nis2.fact.jurisdiction_basis.description":
        "Niederlassung, Dienstleistungsort, Hauptniederlassung oder EU-Vertreter.",
      "nis2.fact.nis2_entity_types.label": "NIS2-Einrichtungsarten",
      "nis2.fact.nis2_entity_types.description":
        "Ausgewählte Tätigkeitsidentitäten, die auf die NIS2-Anhänge und Sonderfälle abgebildet werden.",
      "nis2.fact.member_state_designation.label": "Behördliche Einstufung",
      "nis2.fact.member_state_designation.description":
        "Formale Einstufung oder Benennung durch einen Mitgliedstaat.",
      "nis2.fact.employee_count_bucket.label": "Mitarbeiterzahl",
      "nis2.fact.employee_count_bucket.description":
        "Mitarbeiterzahl nach der KMU-Empfehlung.",
      "nis2.fact.annual_revenue_bucket.label": "Jahresumsatz",
      "nis2.fact.annual_revenue_bucket.description":
        "Jahresumsatz mit rechtlich exakten Schwellenwerten.",
      "nis2.fact.balance_sheet_total_bucket.label": "Jahresbilanzsumme",
      "nis2.fact.balance_sheet_total_bucket.description":
        "Jahresbilanzsumme mit rechtlich exakten Schwellenwerten.",
      "nis2.fact.sme_figures_verified.label": "KMU-Größenwerte geprüft",
      "nis2.fact.sme_figures_verified.description":
        "Ob die Größenwerte korrekt berechnet wurden oder keine Partner- oder verbundenen Unternehmen bestehen.",
      "nis2.sector.energy.label": "Energie",
      "nis2.sector.transport.label": "Verkehr",
      "nis2.sector.banking.label": "Banken",
      "nis2.sector.financial_market_infrastructures.label":
        "Finanzmarktinfrastrukturen",
      "nis2.sector.health.label": "Gesundheit",
      "nis2.sector.drinking_water.label": "Trinkwasser",
      "nis2.sector.waste_water.label": "Abwasser",
      "nis2.sector.digital_infrastructure.label": "Digitale Infrastruktur",
      "nis2.sector.ict_service_management.label": "Verwaltung von IKT-Diensten",
      "nis2.sector.public_administration.label": "Öffentliche Verwaltung",
      "nis2.sector.space.label": "Weltraum",
      "nis2.sector.postal_courier.label": "Post- und Kurierdienste",
      "nis2.sector.waste_management.label": "Abfallbewirtschaftung",
      "nis2.sector.chemicals.label": "Chemikalien",
      "nis2.sector.food.label": "Lebensmittel",
      "nis2.sector.manufacturing.label": "Verarbeitendes Gewerbe",
      "nis2.sector.digital_providers.label": "Digitale Anbieter",
      "nis2.sector.research.label": "Forschung",
      "nis2.entity.electricity_supplier.label": "Stromlieferant",
      "nis2.entity.electricity_supplier.description":
        "Elektrizitätsunternehmen, das die Funktion der Stromlieferung nach Artikel 2 Nummern 12 und 57 der Richtlinie (EU) 2019/944 ausübt.",
      "nis2.entity.electricity_distribution_operator.label":
        "Elektrizitätsverteilernetzbetreiber",
      "nis2.entity.electricity_distribution_operator.description":
        "Betreiber eines Elektrizitätsverteilernetzes im Sinne von Artikel 2 Nummer 29 der Richtlinie (EU) 2019/944.",
      "nis2.entity.electricity_transmission_operator.label":
        "Elektrizitätsübertragungsnetzbetreiber",
      "nis2.entity.electricity_transmission_operator.description":
        "Betreiber eines Elektrizitätsübertragungsnetzes im Sinne von Artikel 2 Nummer 35 der Richtlinie (EU) 2019/944.",
      "nis2.entity.electricity_producer.label": "Stromerzeuger",
      "nis2.entity.electricity_producer.description":
        "Stromerzeuger im Sinne von Artikel 2 Nummer 38 der Richtlinie (EU) 2019/944.",
      "nis2.entity.electricity_market_operator.label":
        "Nominierter Strommarktbetreiber",
      "nis2.entity.electricity_market_operator.description":
        "Nominierter Strommarktbetreiber im Sinne von Artikel 2 Nummer 8 der Verordnung (EU) 2019/943.",
      "nis2.entity.electricity_flexibility_provider.label":
        "Anbieter von Aggregation, Laststeuerung oder Energiespeicherung",
      "nis2.entity.electricity_flexibility_provider.description":
        "Marktteilnehmer, der Aggregation, Laststeuerung oder Energiespeicherung nach den in NIS2 Anhang I Nummer 1 Buchstabe a genannten Unionsrechtsdefinitionen anbietet.",
      "nis2.entity.recharging_point_operator.label":
        "Betreiber öffentlich zugänglicher Ladepunkte",
      "nis2.entity.recharging_point_operator.description":
        "Für Verwaltung und Betrieb eines öffentlich zugänglichen Ladepunkts zur Versorgung von Endnutzern verantwortliche Einrichtung.",
      "nis2.entity.district_heating_cooling_operator.label":
        "Betreiber von Fernwärme- oder Fernkälteversorgung",
      "nis2.entity.district_heating_cooling_operator.description":
        "Betreiber von Fernwärme oder Fernkälte im Sinne von Artikel 2 Nummer 19 der Richtlinie (EU) 2018/2001.",
      "nis2.entity.oil_pipeline_operator.label":
        "Betreiber von Erdöl-Fernleitungen",
      "nis2.entity.oil_pipeline_operator.description":
        "Betreiber einer Fernleitung für die Übertragung von Erdöl.",
      "nis2.entity.oil_facility_operator.label":
        "Betreiber von Erdölgewinnungs-, Raffinerie-, Aufbereitungs-, Lager- oder Übertragungsanlagen",
      "nis2.entity.oil_facility_operator.description":
        "Betreiber von Anlagen zur Erdölgewinnung, Raffination, Aufbereitung, Lagerung oder Übertragung.",
      "nis2.entity.central_oil_stockholding_entity.label":
        "Zentrale Erdölbevorratungsstelle",
      "nis2.entity.central_oil_stockholding_entity.description":
        "Zentrale Bevorratungsstelle im Sinne von Artikel 2 Buchstabe f der Richtlinie 2009/119/EG.",
      "nis2.entity.gas_supply_undertaking.label": "Gasversorgungsunternehmen",
      "nis2.entity.gas_supply_undertaking.description":
        "Gasversorgungsunternehmen im Sinne von Artikel 2 Nummer 8 der Richtlinie 2009/73/EG.",
      "nis2.entity.gas_distribution_operator.label":
        "Gasverteilernetzbetreiber",
      "nis2.entity.gas_distribution_operator.description":
        "Gasverteilernetzbetreiber im Sinne von Artikel 2 Nummer 6 der Richtlinie 2009/73/EG.",
      "nis2.entity.gas_transmission_operator.label":
        "Gasfernleitungsnetzbetreiber",
      "nis2.entity.gas_transmission_operator.description":
        "Gasfernleitungsnetzbetreiber im Sinne von Artikel 2 Nummer 4 der Richtlinie 2009/73/EG.",
      "nis2.entity.gas_storage_operator.label": "Gasspeicheranlagenbetreiber",
      "nis2.entity.gas_storage_operator.description":
        "Gasspeicheranlagenbetreiber im Sinne von Artikel 2 Nummer 10 der Richtlinie 2009/73/EG.",
      "nis2.entity.lng_operator.label": "Betreiber einer LNG-Anlage",
      "nis2.entity.lng_operator.description":
        "Betreiber einer LNG-Anlage im Sinne von Artikel 2 Nummer 12 der Richtlinie 2009/73/EG.",
      "nis2.entity.natural_gas_undertaking.label": "Erdgasunternehmen",
      "nis2.entity.natural_gas_undertaking.description":
        "Erdgasunternehmen im Sinne von Artikel 2 Nummer 1 der Richtlinie 2009/73/EG; nicht identisch mit dem engeren deutschen Fördererbegriff.",
      "nis2.entity.gas_refining_treatment_operator.label":
        "Betreiber von Erdgasraffinerie- oder Aufbereitungsanlagen",
      "nis2.entity.gas_refining_treatment_operator.description":
        "Betreiber einer Anlage zur Raffination oder Aufbereitung von Erdgas.",
      "nis2.entity.hydrogen_operator.label":
        "Betreiber für Wasserstofferzeugung, -speicherung oder -fernleitung",
      "nis2.entity.hydrogen_operator.description":
        "Betreiber von Anlagen zur Erzeugung, Speicherung oder Fernleitung von Wasserstoff.",
      "nis2.entity.air_carrier.label": "Luftfahrtunternehmen",
      "nis2.entity.air_carrier.description":
        "Gewerblich eingesetztes Luftfahrtunternehmen im Sinne von Artikel 3 Nummer 4 der Verordnung (EG) 300/2008.",
      "nis2.entity.airport_operator.label":
        "Flughafenleitungsorgan, Flughafen oder Betreiber zugehöriger Einrichtungen",
      "nis2.entity.airport_operator.description":
        "Flughafenleitungsorgan, erfasster Flughafen oder Betreiber zugehöriger Flughafeneinrichtungen nach den in NIS2 Anhang I genannten Rechtsakten.",
      "nis2.entity.air_traffic_management_provider.label":
        "Flugverkehrsmanagement- oder Flugsicherungsanbieter",
      "nis2.entity.air_traffic_management_provider.description":
        "Betreiber der Flugverkehrsmanagementkontrolle, der Flugverkehrskontrolldienste im Sinne der Verordnung (EG) 549/2004 erbringt.",
      "nis2.entity.rail_infrastructure_manager.label":
        "Betreiber von Eisenbahninfrastruktur",
      "nis2.entity.rail_infrastructure_manager.description":
        "Betreiber von Eisenbahninfrastruktur im Sinne von Artikel 3 Nummer 2 der Richtlinie 2012/34/EU.",
      "nis2.entity.railway_undertaking.label": "Eisenbahnunternehmen",
      "nis2.entity.railway_undertaking.description":
        "Eisenbahnunternehmen einschließlich Betreiber von Serviceeinrichtungen nach Artikel 3 Nummern 1 und 12 der Richtlinie 2012/34/EU.",
      "nis2.entity.water_transport_company.label":
        "Binnen-, See- oder Küstenschifffahrtsunternehmen",
      "nis2.entity.water_transport_company.description":
        "Unternehmen der Binnen-, See- oder Küstenschifffahrt für Personen- oder Güterverkehr; einzelne Schiffe sind nicht erfasst.",
      "nis2.entity.port_operator.label":
        "Leitungsorgan eines Hafens oder Betreiber einer Hafenanlage",
      "nis2.entity.port_operator.description":
        "Leitungsorgan eines Hafens, Betreiber einer Hafenanlage oder Betreiber von Anlagen und Ausrüstung innerhalb eines Hafens.",
      "nis2.entity.vessel_traffic_service.label":
        "Betreiber eines Schiffsverkehrsdienstes",
      "nis2.entity.vessel_traffic_service.description":
        "Betreiber eines Schiffsverkehrsdienstes im Sinne von Artikel 3 Buchstabe o der Richtlinie 2002/59/EG.",
      "nis2.entity.road_authority.label": "Straßenverkehrsbehörde",
      "nis2.entity.road_authority.description":
        "Straßenverkehrsbehörde mit Verantwortung für Verkehrsmanagementkontrolle; nur beiläufige Aufgaben genügen nicht.",
      "nis2.entity.intelligent_transport_system_operator.label":
        "Betreiber intelligenter Verkehrssysteme",
      "nis2.entity.intelligent_transport_system_operator.description":
        "Betreiber eines intelligenten Verkehrssystems im Sinne von Artikel 4 Nummer 1 der Richtlinie 2010/40/EU.",
      "nis2.entity.credit_institution.label": "Kreditinstitut",
      "nis2.entity.credit_institution.description":
        "Kreditinstitut im Sinne von Artikel 4 Absatz 1 der Verordnung (EU) 575/2013.",
      "nis2.entity.trading_venue_operator.label":
        "Betreiber eines Handelsplatzes",
      "nis2.entity.trading_venue_operator.description":
        "Betreiber eines Handelsplatzes im Sinne von Artikel 4 Absatz 1 Nummer 24 der Richtlinie 2014/65/EU.",
      "nis2.entity.central_counterparty.label": "Zentrale Gegenpartei",
      "nis2.entity.central_counterparty.description":
        "Zentrale Gegenpartei im Sinne von Artikel 2 Nummer 1 der Verordnung (EU) 648/2012.",
      "nis2.entity.healthcare_provider.label": "Gesundheitsdienstleister",
      "nis2.entity.healthcare_provider.description":
        "Gesundheitsdienstleister im Sinne von Artikel 3 Buchstabe g der Richtlinie 2011/24/EU.",
      "nis2.entity.eu_reference_laboratory.label": "EU-Referenzlaboratorium",
      "nis2.entity.eu_reference_laboratory.description":
        "EU-Referenzlaboratorium nach Artikel 15 der Verordnung (EU) 2022/2371.",
      "nis2.entity.medicinal_product_researcher.label":
        "Forschungs- und Entwicklungsunternehmen für Arzneimittel",
      "nis2.entity.medicinal_product_researcher.description":
        "Einrichtung, die Forschung und Entwicklung zu Arzneimitteln im Sinne von Artikel 1 Nummer 2 der Richtlinie 2001/83/EG betreibt.",
      "nis2.entity.pharmaceutical_manufacturer.label":
        "Hersteller pharmazeutischer Grundstoffe oder Erzeugnisse",
      "nis2.entity.pharmaceutical_manufacturer.description":
        "Hersteller pharmazeutischer Grundstoffe oder Erzeugnisse mit einer Tätigkeit nach NACE Rev. 2 Abteilung 21.",
      "nis2.entity.critical_medical_device_manufacturer.label":
        "Hersteller kritischer Medizinprodukte für Notlagen",
      "nis2.entity.critical_medical_device_manufacturer.description":
        "Hersteller eines Medizinprodukts, das während einer Gesundheitsnotlage auf der Liste kritischer Produkte nach Verordnung (EU) 2022/123 steht.",
      "nis2.entity.drinking_water_supplier.label":
        "Lieferant oder Verteiler von Trinkwasser",
      "nis2.entity.drinking_water_supplier.description":
        "Lieferant oder Verteiler von Wasser für den menschlichen Gebrauch; nur beiläufige Wasserverteilung ist ausgeschlossen.",
      "nis2.entity.waste_water_undertaking.label":
        "Unternehmen der Abwassersammlung, -entsorgung oder -behandlung",
      "nis2.entity.waste_water_undertaking.description":
        "Unternehmen zur Sammlung, Entsorgung oder Behandlung von kommunalem, häuslichem oder industriellem Abwasser, sofern dies keine unwesentliche Nebentätigkeit ist.",
      "nis2.entity.internet_exchange_point.label":
        "Betreiber eines Internetknotens",
      "nis2.entity.internet_exchange_point.description":
        "Internetknoten nach Artikel 6 Nummer 18 NIS2, der mehr als zwei unabhängige autonome Systeme unter den dort genannten Grenzen verbindet.",
      "nis2.entity.dns_service_provider.label": "DNS-Diensteanbieter",
      "nis2.entity.dns_service_provider.description":
        "Anbieter öffentlicher rekursiver DNS-Auflösung oder autoritativer DNS-Auflösung für Dritte; Root-Nameserver sind ausgeschlossen.",
      "nis2.entity.tld_registry.label": "TLD-Namensregister",
      "nis2.entity.tld_registry.description":
        "Einrichtung, der eine Top-Level-Domain delegiert ist und die für deren Verwaltung und technischen Betrieb verantwortlich ist; reine Eigennutzung ist ausgeschlossen.",
      "nis2.entity.cloud_service_provider.label":
        "Cloud-Computing-Dienstleister",
      "nis2.entity.cloud_service_provider.description":
        "Anbieter eines bedarfsgesteuerten, entfernt verwalteten, skalierbaren und elastischen Pools gemeinsam nutzbarer Rechenressourcen.",
      "nis2.entity.data_centre_service_provider.label":
        "Rechenzentrumsdienstleister",
      "nis2.entity.data_centre_service_provider.description":
        "Anbieter zentraler Unterbringung, Verbindung und Betrieb von IT- und Netzwerkausrüstung einschließlich unterstützender Energie- und Umweltinfrastruktur.",
      "nis2.entity.content_delivery_network_provider.label":
        "Content-Delivery-Network-Anbieter",
      "nis2.entity.content_delivery_network_provider.description":
        "Anbieter geografisch verteilter Server zur hochverfügbaren, schnellen Bereitstellung von Inhalten oder Diensten für Dritte.",
      "nis2.entity.qualified_trust_service_provider.label":
        "Qualifizierter Vertrauensdiensteanbieter",
      "nis2.entity.qualified_trust_service_provider.description":
        "Qualifizierter Vertrauensdiensteanbieter als Anwendungsunterteilung der einheitlichen NIS2-Kategorie; unabhängig von der Größe wesentlich.",
      "nis2.entity.other_trust_service_provider.label":
        "Nicht qualifizierter Vertrauensdiensteanbieter",
      "nis2.entity.other_trust_service_provider.description":
        "Nicht qualifizierter Vertrauensdiensteanbieter als Anwendungsunterteilung derselben NIS2-Kategorie; unabhängig von der Größe erfasst und grundsätzlich wichtig.",
      "nis2.entity.public_electronic_communications_network.label":
        "Anbieter eines öffentlichen elektronischen Kommunikationsnetzes",
      "nis2.entity.public_electronic_communications_network.description":
        "Anbieter eines öffentlichen elektronischen Kommunikationsnetzes nach Artikel 6 Nummer 36 NIS2 und Artikel 2 Nummer 8 der Richtlinie (EU) 2018/1972.",
      "nis2.entity.public_electronic_communications_service.label":
        "Anbieter eines öffentlich zugänglichen elektronischen Kommunikationsdienstes",
      "nis2.entity.public_electronic_communications_service.description":
        "Anbieter eines öffentlich zugänglichen elektronischen Kommunikationsdienstes nach Artikel 6 Nummer 37 NIS2.",
      "nis2.entity.domain_name_registration_service.label":
        "Anbieter von Domänennamenregistrierungsdiensten",
      "nis2.entity.domain_name_registration_service.description":
        "Registrar oder für Registrare handelnder Dienst einschließlich Datenschutz-/Proxy-Diensten und Wiederverkäufern; nach Artikel 2 Absatz 4 unabhängig von der Größe erfasst.",
      "nis2.entity.managed_service_provider.label":
        "Managed Service Provider (MSP)",
      "nis2.entity.managed_service_provider.description":
        "Einrichtung, die IKT- oder Netzwerksysteme von Kunden lokal oder entfernt aktiv installiert, verwaltet, betreibt, wartet oder dabei unterstützt.",
      "nis2.entity.managed_security_service_provider.label":
        "Managed Security Service Provider (MSSP)",
      "nis2.entity.managed_security_service_provider.description":
        "Managed Service Provider, der Tätigkeiten des Cybersicherheitsrisikomanagements ausführt oder dabei unterstützt.",
      "nis2.entity.central_public_administration.label":
        "Einrichtung der Zentralverwaltung",
      "nis2.entity.central_public_administration.description":
        "Einrichtung der Zentralverwaltung nach nationalem Recht, die die NIS2-Verwaltungsdefinition erfüllt; Sicherheits- und Verteidigungsausnahmen bleiben unberührt.",
      "nis2.entity.regional_public_administration.label":
        "Einrichtung der regionalen Verwaltung mit relevanter Risikoeinstufung",
      "nis2.entity.regional_public_administration.description":
        "Einrichtung der regionalen Verwaltung nach nationalem Recht, die zusätzlich die nationale risikobasierte Störungsbewertung bestehen muss.",
      "nis2.entity.space_ground_infrastructure_operator.label":
        "Betreiber bodengestützter Weltrauminfrastruktur",
      "nis2.entity.space_ground_infrastructure_operator.description":
        "Betreiber staatlicher oder privater bodengestützter Infrastruktur zur Unterstützung weltraumgestützter Dienste; öffentliche Kommunikationsnetze sind ausgenommen.",
      "nis2.entity.postal_courier_provider.label":
        "Post- oder Kurierdiensteanbieter",
      "nis2.entity.postal_courier_provider.description":
        "Postdiensteanbieter im Sinne von Artikel 2 Nummer 1a der Richtlinie 97/67/EG, einschließlich Kurierdiensteanbieter.",
      "nis2.entity.waste_management_undertaking.label":
        "Unternehmen der Abfallbewirtschaftung als Haupttätigkeit",
      "nis2.entity.waste_management_undertaking.description":
        "Unternehmen der Abfallbewirtschaftung im Sinne von Artikel 3 Nummer 9 der Richtlinie 2008/98/EG, sofern dies eine Haupttätigkeit ist.",
      "nis2.entity.chemical_manufacturer_distributor.label":
        "Hersteller oder Vertreiber chemischer Stoffe oder Gemische",
      "nis2.entity.chemical_manufacturer_distributor.description":
        "Hersteller oder Vertreiber von Stoffen oder Gemischen nach REACH; Anwendungsunterteilung einer einheitlichen NIS2-Anhang-II-Kategorie.",
      "nis2.entity.chemical_article_producer.label":
        "Produzent von Erzeugnissen aus chemischen Stoffen oder Gemischen",
      "nis2.entity.chemical_article_producer.description":
        "Produzent von Erzeugnissen aus Stoffen oder Gemischen nach REACH; zweite Anwendungsunterteilung derselben NIS2-Anhang-II-Kategorie.",
      "nis2.entity.food_wholesale_industrial_business.label":
        "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung",
      "nis2.entity.food_wholesale_industrial_business.description":
        "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung; andere Lebensmittelunternehmen sind nicht allein deshalb erfasst.",
      "nis2.entity.medical_device_manufacturer.label":
        "Hersteller von Medizinprodukten oder In-vitro-Diagnostika",
      "nis2.entity.medical_device_manufacturer.description":
        "Hersteller von Medizinprodukten oder In-vitro-Diagnostika, soweit er nicht bereits unter die Notfallkategorie in Anhang I fällt.",
      "nis2.entity.computer_electronic_optical_manufacturer.label":
        "Hersteller von Datenverarbeitungsgeräten, elektronischen oder optischen Erzeugnissen",
      "nis2.entity.computer_electronic_optical_manufacturer.description":
        "Unternehmen mit einer Herstellungstätigkeit nach NACE Rev. 2 Abteilung 26.",
      "nis2.entity.electrical_equipment_manufacturer.label":
        "Hersteller elektrischer Ausrüstungen",
      "nis2.entity.electrical_equipment_manufacturer.description":
        "Unternehmen mit einer Herstellungstätigkeit nach NACE Rev. 2 Abteilung 27.",
      "nis2.entity.machinery_manufacturer.label": "Maschinenbauunternehmen",
      "nis2.entity.machinery_manufacturer.description":
        "Unternehmen mit einer Herstellungstätigkeit nach NACE Rev. 2 Abteilung 28.",
      "nis2.entity.motor_vehicle_manufacturer.label":
        "Hersteller von Kraftwagen, Anhängern oder Aufliegern",
      "nis2.entity.motor_vehicle_manufacturer.description":
        "Unternehmen mit einer Herstellungstätigkeit nach NACE Rev. 2 Abteilung 29.",
      "nis2.entity.other_transport_equipment_manufacturer.label":
        "Hersteller sonstiger Fahrzeuge",
      "nis2.entity.other_transport_equipment_manufacturer.description":
        "Unternehmen mit einer Herstellungstätigkeit nach NACE Rev. 2 Abteilung 30.",
      "nis2.entity.online_marketplace_provider.label":
        "Anbieter eines Online-Marktplatzes",
      "nis2.entity.online_marketplace_provider.description":
        "Anbieter eines Online-Marktplatzes im Sinne von Artikel 6 Nummer 28 NIS2 und Artikel 2 Buchstabe n der Richtlinie 2005/29/EG.",
      "nis2.entity.online_search_engine_provider.label":
        "Anbieter einer Online-Suchmaschine",
      "nis2.entity.online_search_engine_provider.description":
        "Anbieter einer Online-Suchmaschine im Sinne von Artikel 6 Nummer 29 NIS2.",
      "nis2.entity.social_networking_platform_provider.label":
        "Anbieter einer Plattform für soziale Netzwerke",
      "nis2.entity.social_networking_platform_provider.description":
        "Plattform, die Endnutzer geräteübergreifend verbindet und das Teilen, Entdecken und Kommunizieren ermöglicht.",
      "nis2.entity.research_organisation.label": "Forschungseinrichtung",
      "nis2.entity.research_organisation.description":
        "Einrichtung, die hauptsächlich angewandte Forschung oder experimentelle Entwicklung zur kommerziellen Nutzung betreibt; Bildungseinrichtungen sind ausgeschlossen.",
      "nis2.profile.de.entity.de_bsig_electricity_supplier.label":
        "Stromlieferant",
      "nis2.profile.de.entity.de_bsig_electricity_supplier.description":
        "Stromlieferant nach BSIG Anlage 1 Nummer 1.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.label":
        "Elektrizitätsverteilernetzbetreiber",
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.description":
        "Elektrizitätsverteilernetzbetreiber nach BSIG Anlage 1 Nummer 1.1.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.label":
        "Elektrizitätsübertragungsnetzbetreiber",
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.description":
        "Elektrizitätsübertragungsnetzbetreiber nach BSIG Anlage 1 Nummer 1.1.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.label":
        "Betreiber einer Stromerzeugungsanlage",
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.description":
        "Betreiber einer Stromerzeugungsanlage nach BSIG Anlage 1 Nummer 1.1.4; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.label":
        "Nominierter Strommarktbetreiber",
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.description":
        "Nominierter Strommarktbetreiber nach BSIG Anlage 1 Nummer 1.1.5; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.label":
        "Aggregator im Elektrizitätsbereich",
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.description":
        "Aggregator im Elektrizitätsbereich nach BSIG Anlage 1 Nummer 1.1.6; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.label":
        "Betreiber einer Energiespeicheranlage",
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.description":
        "Betreiber einer Energiespeicheranlage nach BSIG Anlage 1 Nummer 1.1.7; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.label":
        "Anbieter von Ausgleichsleistungen",
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.description":
        "Anbieter von Ausgleichsleistungen nach BSIG Anlage 1 Nummer 1.1.8; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.label":
        "Ladepunktbetreiber",
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.description":
        "Ladepunktbetreiber nach BSIG Anlage 1 Nummer 1.1.9; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.label":
        "Betreiber von Fernwärme- oder Fernkälteversorgung",
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.description":
        "Betreiber von Fernwärme- oder Fernkälteversorgung nach BSIG Anlage 1 Nummer 1.2.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.label":
        "Betreiber einer Erdölfernleitung",
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.description":
        "Betreiber einer Erdölfernleitung nach BSIG Anlage 1 Nummer 1.3.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.label":
        "Betreiber von Erdölproduktions-, Raffinations-, Aufbereitungs-, Lager- oder Fernleitungsanlagen",
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.description":
        "Betreiber von Erdölproduktions-, Raffinations-, Aufbereitungs-, Lager- oder Fernleitungsanlagen nach BSIG Anlage 1 Nummer 1.3.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.label":
        "Zentrale Erdölbevorratungsstelle",
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.description":
        "Zentrale Erdölbevorratungsstelle nach BSIG Anlage 1 Nummer 1.3.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.label":
        "Gasverteilernetzbetreiber",
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.description":
        "Gasverteilernetzbetreiber nach BSIG Anlage 1 Nummer 1.4.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.label":
        "Gasfernleitungsnetzbetreiber",
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.description":
        "Gasfernleitungsnetzbetreiber nach BSIG Anlage 1 Nummer 1.4.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.label":
        "Gasspeicheranlagenbetreiber",
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.description":
        "Gasspeicheranlagenbetreiber nach BSIG Anlage 1 Nummer 1.4.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_lng_operator.label":
        "LNG-Anlagenbetreiber",
      "nis2.profile.de.entity.de_bsig_lng_operator.description":
        "LNG-Anlagenbetreiber nach BSIG Anlage 1 Nummer 1.4.4; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_gas_supplier.label": "Gaslieferant",
      "nis2.profile.de.entity.de_bsig_gas_supplier.description":
        "Gaslieferant nach BSIG Anlage 1 Nummer 1.4.5; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.label":
        "Betreiber einer Anlage zur Erdgasgewinnung",
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.description":
        "Betreiber einer Anlage zur Erdgasgewinnung nach BSIG Anlage 1 Nummer 1.4.6; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.label":
        "Betreiber einer Erdgasraffinerie oder -aufbereitungsanlage",
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.description":
        "Betreiber einer Erdgasraffinerie oder -aufbereitungsanlage nach BSIG Anlage 1 Nummer 1.4.7; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_hydrogen_operator.label":
        "Betreiber von Wasserstofferzeugungs-, Speicher- oder Fernleitungsanlagen",
      "nis2.profile.de.entity.de_bsig_hydrogen_operator.description":
        "Betreiber von Wasserstofferzeugungs-, Speicher- oder Fernleitungsanlagen nach BSIG Anlage 1 Nummer 1.4.8; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.label":
        "Gewerblich genutztes Luftfahrtunternehmen",
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.description":
        "Gewerblich genutztes Luftfahrtunternehmen nach BSIG Anlage 1 Nummer 2.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_airport_entity.label":
        "Flughafenleitungsorgan, Flughafen oder Betreiber einer zugehörigen Anlage",
      "nis2.profile.de.entity.de_bsig_airport_entity.description":
        "Flughafenleitungsorgan, Flughafen oder Betreiber einer zugehörigen Anlage nach BSIG Anlage 1 Nummer 2.1.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_atm_ans_provider.label":
        "Flugverkehrsmanagement- oder Flugsicherungsdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_atm_ans_provider.description":
        "Flugverkehrsmanagement- oder Flugsicherungsdiensteanbieter nach BSIG Anlage 1 Nummer 2.1.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.label":
        "Eisenbahninfrastrukturbetreiber",
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.description":
        "Eisenbahninfrastrukturbetreiber nach BSIG Anlage 1 Nummer 2.2.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_railway_undertaking.label":
        "Eisenbahnverkehrsunternehmen einschließlich Serviceeinrichtungsbetreiber",
      "nis2.profile.de.entity.de_bsig_railway_undertaking.description":
        "Eisenbahnverkehrsunternehmen einschließlich Serviceeinrichtungsbetreiber nach BSIG Anlage 1 Nummer 2.2.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_water_transport_company.label":
        "Unternehmen der Binnen-, See- oder Küstenschifffahrt",
      "nis2.profile.de.entity.de_bsig_water_transport_company.description":
        "Unternehmen der Binnen-, See- oder Küstenschifffahrt nach BSIG Anlage 1 Nummer 2.3.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_port_entity.label":
        "Hafenleitungsorgan, Hafenanlage oder Betreiber von Hafenanlagen und -ausrüstung",
      "nis2.profile.de.entity.de_bsig_port_entity.description":
        "Hafenleitungsorgan, Hafenanlage oder Betreiber von Hafenanlagen und -ausrüstung nach BSIG Anlage 1 Nummer 2.3.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.label":
        "Betreiber einer Anlage oder eines Systems zum sicheren Wasserstraßenbetrieb",
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.description":
        "Betreiber einer Anlage oder eines Systems zum sicheren Wasserstraßenbetrieb nach BSIG Anlage 1 Nummer 2.3.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.label":
        "Betreiber einer Anlage oder eines Systems zur Straßenverkehrsbeeinflussung",
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.description":
        "Betreiber einer Anlage oder eines Systems zur Straßenverkehrsbeeinflussung nach BSIG Anlage 1 Nummer 2.4.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.label":
        "Betreiber eines intelligenten Verkehrssystems",
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.description":
        "Betreiber eines intelligenten Verkehrssystems nach BSIG Anlage 1 Nummer 2.4.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_credit_institution.label":
        "Kreditinstitut",
      "nis2.profile.de.entity.de_bsig_credit_institution.description":
        "Kreditinstitut nach BSIG Anlage 1 Nummer 3.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_trading_venue.label": "Handelsplatz",
      "nis2.profile.de.entity.de_bsig_trading_venue.description":
        "Handelsplatz nach BSIG Anlage 1 Nummer 3.2.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_central_counterparty.label":
        "Zentrale Gegenpartei",
      "nis2.profile.de.entity.de_bsig_central_counterparty.description":
        "Zentrale Gegenpartei nach BSIG Anlage 1 Nummer 3.2.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_healthcare_provider.label":
        "Gesundheitsdienstleister",
      "nis2.profile.de.entity.de_bsig_healthcare_provider.description":
        "Gesundheitsdienstleister nach BSIG Anlage 1 Nummer 4.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.label":
        "EU-Referenzlaboratorium",
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.description":
        "EU-Referenzlaboratorium nach BSIG Anlage 1 Nummer 4.1.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.label":
        "Unternehmen der Arzneimittelforschung und -entwicklung",
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.description":
        "Unternehmen der Arzneimittelforschung und -entwicklung nach BSIG Anlage 1 Nummer 4.1.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.label":
        "Hersteller pharmazeutischer Erzeugnisse",
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.description":
        "Hersteller pharmazeutischer Erzeugnisse nach BSIG Anlage 1 Nummer 4.1.4; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.label":
        "Hersteller eines notfallkritischen Medizinprodukts",
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.description":
        "Hersteller eines notfallkritischen Medizinprodukts nach BSIG Anlage 1 Nummer 4.1.5; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.label":
        "Betreiber einer Trinkwasserversorgungsanlage",
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.description":
        "Betreiber einer Trinkwasserversorgungsanlage nach BSIG Anlage 1 Nummer 5.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.label":
        "Abwasserunternehmen",
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.description":
        "Abwasserunternehmen nach BSIG Anlage 1 Nummer 5.2.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.label":
        "Betreiber eines Internetknotens",
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.description":
        "Betreiber eines Internetknotens nach BSIG Anlage 1 Nummer 6.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_dns_service_provider.label":
        "DNS-Diensteanbieter",
      "nis2.profile.de.entity.de_bsig_dns_service_provider.description":
        "DNS-Diensteanbieter nach BSIG Anlage 1 Nummer 6.1.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_tld_registry.label":
        "Top-Level-Domain-Namensregister",
      "nis2.profile.de.entity.de_bsig_tld_registry.description":
        "Top-Level-Domain-Namensregister nach BSIG Anlage 1 Nummer 6.1.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.label":
        "Cloud-Computing-Diensteanbieter",
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.description":
        "Cloud-Computing-Diensteanbieter nach BSIG Anlage 1 Nummer 6.1.4; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.label":
        "Rechenzentrumsdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.description":
        "Rechenzentrumsdiensteanbieter nach BSIG Anlage 1 Nummer 6.1.5; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.label":
        "Betreiber eines Inhaltszustellnetzes",
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.description":
        "Betreiber eines Inhaltszustellnetzes nach BSIG Anlage 1 Nummer 6.1.6; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.label":
        "Qualifizierter Vertrauensdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.description":
        "Qualifizierter Vertrauensdiensteanbieter nach BSIG Anlage 1 Nummer 6.1.7; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.label":
        "Nicht qualifizierter Vertrauensdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.description":
        "Nicht qualifizierter Vertrauensdiensteanbieter nach BSIG Anlage 1 Nummer 6.1.7; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.label":
        "Betreiber eines öffentlichen Telekommunikationsnetzes",
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.description":
        "Betreiber eines öffentlichen Telekommunikationsnetzes nach BSIG Anlage 1 Nummer 6.1.8; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.label":
        "Anbieter öffentlich zugänglicher Telekommunikationsdienste",
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.description":
        "Anbieter öffentlich zugänglicher Telekommunikationsdienste nach BSIG Anlage 1 Nummer 6.1.9; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist.",
      "nis2.profile.de.entity.de_bsig_managed_service_provider.label":
        "Anbieter verwalteter Dienste",
      "nis2.profile.de.entity.de_bsig_managed_service_provider.description":
        "Anbieter verwalteter Dienste nach BSIG Anlage 1 Nummer 6.1.10; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.label":
        "Anbieter verwalteter Sicherheitsdienste",
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.description":
        "Anbieter verwalteter Sicherheitsdienste nach BSIG Anlage 1 Nummer 6.1.11; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.label":
        "Betreiber bodengestützter Weltrauminfrastruktur",
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.description":
        "Betreiber bodengestützter Weltrauminfrastruktur nach BSIG Anlage 1 Nummer 7.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.label":
        "Post- oder Kurierdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.description":
        "Post- oder Kurierdiensteanbieter nach BSIG Anlage 2 Nummer 1.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.label":
        "Unternehmen mit Abfallbewirtschaftung als Haupttätigkeit",
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.description":
        "Unternehmen mit Abfallbewirtschaftung als Haupttätigkeit nach BSIG Anlage 2 Nummer 2.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.label":
        "REACH-registrierungspflichtiger Chemikalienhersteller oder -importeur der NACE-Abteilung 20",
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.description":
        "REACH-registrierungspflichtiger Chemikalienhersteller oder -importeur der NACE-Abteilung 20 nach BSIG Anlage 2 Nummer 3.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.label":
        "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung",
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.description":
        "Lebensmittelunternehmen im Großhandel oder in industrieller Produktion und Verarbeitung nach BSIG Anlage 2 Nummer 4.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.label":
        "Hersteller von Medizinprodukten oder In-vitro-Diagnostika",
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.description":
        "Hersteller von Medizinprodukten oder In-vitro-Diagnostika nach BSIG Anlage 2 Nummer 5.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.label":
        "Hersteller nach NACE-Abteilung 26",
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.description":
        "Hersteller nach NACE-Abteilung 26 nach BSIG Anlage 2 Nummer 5.2.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.label":
        "Hersteller nach NACE-Abteilung 27",
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.description":
        "Hersteller nach NACE-Abteilung 27 nach BSIG Anlage 2 Nummer 5.3.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.label":
        "Hersteller nach NACE-Abteilung 28",
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.description":
        "Hersteller nach NACE-Abteilung 28 nach BSIG Anlage 2 Nummer 5.4.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.label":
        "Hersteller nach NACE-Abteilung 29",
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.description":
        "Hersteller nach NACE-Abteilung 29 nach BSIG Anlage 2 Nummer 5.5.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.label":
        "Hersteller nach NACE-Abteilung 30",
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.description":
        "Hersteller nach NACE-Abteilung 30 nach BSIG Anlage 2 Nummer 5.6.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.label":
        "Anbieter eines Online-Marktplatzes",
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.description":
        "Anbieter eines Online-Marktplatzes nach BSIG Anlage 2 Nummer 6.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.label":
        "Anbieter einer Online-Suchmaschine",
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.description":
        "Anbieter einer Online-Suchmaschine nach BSIG Anlage 2 Nummer 6.1.2; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.label":
        "Anbieter einer Plattform für soziale Netzwerkdienste",
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.description":
        "Anbieter einer Plattform für soziale Netzwerkdienste nach BSIG Anlage 2 Nummer 6.1.3; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_research_organisation.label":
        "Forschungseinrichtung für kommerziell nutzbare angewandte Forschung oder experimentelle Entwicklung",
      "nis2.profile.de.entity.de_bsig_research_organisation.description":
        "Forschungseinrichtung für kommerziell nutzbare angewandte Forschung oder experimentelle Entwicklung nach BSIG Anlage 2 Nummer 7.1.1; die Auswahl bestätigt, dass die dort einbezogene Definition erfüllt ist. Die Auswahl bestätigt außerdem, dass diese Tätigkeit nicht nur vernachlässigbar ist und Waren oder Dienstleistungen entgeltlich angeboten werden.",
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.label":
        "Domain-Name-Registrierungsdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.description":
        "Domain-Name-Registrierungsdiensteanbieter",
      "nis2.profile.de.entity.de_bsig_federal_authority.label": "Bundesbehörde",
      "nis2.profile.de.entity.de_bsig_federal_authority.description":
        "Bundesbehörde",
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.label":
        "Öffentlich-rechtlicher IT-Dienstleister des Bundes",
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.description":
        "Öffentlich-rechtlicher IT-Dienstleister des Bundes",
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.label":
        "Andere durch Anordnung erfasste öffentlich-rechtliche Bundesstelle",
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.description":
        "Andere durch Anordnung erfasste öffentlich-rechtliche Bundesstelle",
      "nis2.profile.de.entity.de_bsig_regional_public_administration.label":
        "Regionale öffentliche Verwaltung mit Land-Rechtsgrundlage",
      "nis2.profile.de.entity.de_bsig_regional_public_administration.description":
        "Regionale öffentliche Verwaltung mit Land-Rechtsgrundlage",
      "nis2.question.bc.germany_connection.text":
        "Welche Aussage trifft auf die bewertete Organisation zu?",
      "nis2.question.bc.germany_connection.help":
        "Die Antwort bestimmt, ob und auf welcher Grundlage Deutschland für die Prüfung zuständig ist.",
      "nis2.question.bc.germany_connection.tooltip":
        "Für die deutsche Einstufung sind Niederlassung, kritische Anlagen, die Bundesverwaltung, grenzüberschreitende digitale Dienste, öffentliche Telekommunikationsdienste oder eine regionale Verwaltung nach Landesrecht entscheidend. Die eigene Einschätzung der Ausfallfolgen reicht nicht aus.",
      "nis2.question.bc.germany_connection.option.de_established":
        "Die Organisation ist in Deutschland niedergelassen",
      "nis2.question.bc.germany_connection.option.de_critical_installation":
        "Sie ist nicht in Deutschland niedergelassen, betreibt aber eine kritische Anlage in Deutschland",
      "nis2.question.bc.germany_connection.option.de_federal_administration":
        "Sie gehört zur deutschen Bundesverwaltung",
      "nis2.question.bc.germany_connection.option.de_cross_border_digital_provider":
        "Sie ist ein grenzüberschreitender digitaler Anbieter, für den Deutschland zuständig ist",
      "nis2.question.bc.germany_connection.option.de_telecom_provider":
        "Sie erbringt einen öffentlichen Telekommunikationsdienst oder betreibt ein öffentliches Telekommunikationsnetz, für das Deutschland zuständig ist",
      "nis2.question.bc.germany_connection.option.de_regional_administration":
        "Sie ist eine regionale oder Landesverwaltung, die deutschem Landesrecht unterliegt",
      "nis2.question.bc.germany_connection.option.none":
        "Keine dieser Aussagen",
      "nis2.question.bc.germany_connection.option.unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.special_status.text":
        "Trifft bereits eine der folgenden besonderen rechtlichen Einstufungen auf die Organisation zu?",
      "nis2.question.bc.special_status.help":
        "Gemeint sind formale Einstufungen durch eine Behörde oder eine Benennung nach der CER-Richtlinie, nicht die eigene Einschätzung der Ausfallfolgen.",
      "nis2.question.bc.special_status.tooltip":
        "Wählen Sie hier eine Einstufung aus, wenn eine Behörde oder ein EU-Mitgliedstaat Ihre Organisation ausdrücklich als besonders relevant eingestuft hat. Die eigene Einschätzung, dass ein Ausfall schwerwiegende Folgen hätte, reicht dafür nicht aus.",
      "nis2.question.bc.special_status.option.none":
        "Keine dieser Einstufungen",
      "nis2.question.bc.special_status.option.de_critical_installation":
        "Wir betreiben eine kritische Anlage",
      "nis2.question.bc.special_status.option.essential_or_cer":
        "Eine Behörde hat uns als besonders wichtig eingestuft oder als kritische Einrichtung nach CER benannt",
      "nis2.question.bc.special_status.option.important":
        "Eine Behörde hat uns formell als wichtig eingestuft",
      "nis2.question.bc.special_status.option.unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.sector.text":
        "In welchen Bereichen ist Ihre Organisation selbst tätig?",
      "nis2.question.bc.sector.help":
        "Wählen Sie alle zutreffenden Bereiche aus.",
      "nis2.question.bc.sector.tooltip":
        "Entscheidend ist, in welchen Bereichen Ihre Organisation selbst Leistungen erbringt. Der Einkauf oder die Nutzung von Diensten anderer Unternehmen begründet für sich genommen noch keinen Bereich.",
      "nis2.question.bc.sector.option.energy": "Energie",
      "nis2.question.bc.sector.option.transport":
        "Verkehr, Transport, Post- oder Kurierdienste",
      "nis2.question.bc.sector.option.banking_financial":
        "Bankwesen oder Finanzmarktinfrastrukturen",
      "nis2.question.bc.sector.option.health":
        "Gesundheitswesen, Pharmazie oder Medizinprodukte",
      "nis2.question.bc.sector.option.water": "Trinkwasser oder Abwasser",
      "nis2.question.bc.sector.option.digital":
        "Digitale Infrastruktur, IT, Telekommunikation oder Online-Dienste",
      "nis2.question.bc.sector.option.space": "Weltraum oder Satellitendienste",
      "nis2.question.bc.sector.option.waste": "Abfallbewirtschaftung",
      "nis2.question.bc.sector.option.chemicals": "Chemikalien",
      "nis2.question.bc.sector.option.food": "Lebensmittel",
      "nis2.question.bc.sector.option.manufacturing":
        "Verarbeitendes Gewerbe / Fertigung",
      "nis2.question.bc.sector.option.research": "Forschung",
      "nis2.question.bc.sector.option.none_of_these": "Keine dieser Bereiche",
      "nis2.question.bc.sector.option.unsure": "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.text":
        "Welche dieser Tätigkeiten führt Ihre Organisation selbst aus?",
      "nis2.question.bc.activity.help":
        "Wählen Sie alle zutreffenden Tätigkeiten aus. Wählen Sie nichts nur deshalb aus, weil Ihre Organisation es einkauft oder nutzt.",
      "nis2.question.bc.activity.tooltip":
        "Die Auswahl wird auf die im deutschen BSI-Gesetz Anlage 1 und 2 sowie in den Sonderfällen geregelten Einrichtungsidentitäten abgebildet. Es gelten die im Gesetz in Bezug genommenen sektorspezifischen Definitionen.",
      "nis2.question.bc.activity.option.energy_supply_networks":
        "Wir liefern Strom oder betreiben Stromnetze",
      "nis2.question.bc.activity.option.energy_generation_storage_markets":
        "Wir erzeugen oder speichern Strom, aggregieren Strom, betreiben Strommärkte, erbringen Ausgleichsleistungen oder betreiben Ladeinfrastruktur für Elektrofahrzeuge",
      "nis2.question.bc.activity.option.energy_district_heating_cooling":
        "Wir betreiben Fernwärme- oder Fernkälteversorgung",
      "nis2.question.bc.activity.option.energy_oil":
        "Wir fördern, raffinieren, lagern oder transportieren Erdöl oder Erdölprodukte",
      "nis2.question.bc.activity.option.energy_gas_lng":
        "Wir liefern, erzeugen, verarbeiten, speichern oder transportieren Erdgas oder betreiben Gas- oder LNG-Infrastruktur",
      "nis2.question.bc.activity.option.energy_hydrogen":
        "Wir erzeugen, speichern oder transportieren Wasserstoff",
      "nis2.question.bc.activity.option.energy_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.energy_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.transport_air":
        "Wir betreiben gewerblichen Luftverkehr, einen Flughafen oder Flugverkehrs- bzw. Flugsicherungsdienste",
      "nis2.question.bc.activity.option.transport_rail":
        "Wir betreiben Eisenbahninfrastruktur, Eisenbahnverkehr oder Serviceeinrichtungen",
      "nis2.question.bc.activity.option.transport_water":
        "Wir transportieren Personen oder Güter auf dem Wasser oder betreiben Häfen bzw. Hafeninfrastruktur",
      "nis2.question.bc.activity.option.transport_road_its":
        "Wir betreiben Straßenverkehrsmanagement oder intelligente Verkehrssysteme",
      "nis2.question.bc.activity.option.transport_postal_courier":
        "Wir erbringen Post- oder Kurierdienste",
      "nis2.question.bc.activity.option.transport_road_hitch":
        "Wir erbringen nur gewöhnliche Straßengüterbeförderung, Spedition oder Logistik",
      "nis2.question.bc.activity.option.transport_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.transport_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.banking_credit_institution":
        "Wir sind ein Kreditinstitut / eine Bank",
      "nis2.question.bc.activity.option.banking_trading_venue":
        "Wir betreiben einen Handelsplatz",
      "nis2.question.bc.activity.option.banking_central_counterparty":
        "Wir sind eine zentrale Gegenpartei (CCP)",
      "nis2.question.bc.activity.option.banking_other_financial":
        "Wir erbringen nur sonstige Finanzdienstleistungen",
      "nis2.question.bc.activity.option.banking_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.banking_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.health_patient_care":
        "Wir erbringen Gesundheitsdienstleistungen für Patienten",
      "nis2.question.bc.activity.option.health_eu_reference_laboratory":
        "Wir betreiben ein EU-Referenzlaboratorium",
      "nis2.question.bc.activity.option.health_pharma_research":
        "Wir forschen oder entwickeln pharmazeutische Produkte",
      "nis2.question.bc.activity.option.health_pharma_manufacture":
        "Wir stellen pharmazeutische Produkte her",
      "nis2.question.bc.activity.option.health_critical_medical_devices":
        "Wir stellen Medizinprodukte her, die in einer gesundheitlichen Notlage als kritisch eingestuft sind",
      "nis2.question.bc.activity.option.health_other_medical_devices":
        "Wir stellen andere Medizinprodukte oder In-vitro-Diagnostika her",
      "nis2.question.bc.activity.option.health_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.health_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.water_drinking":
        "Wir versorgen mit Trinkwasser",
      "nis2.question.bc.activity.option.water_wastewater":
        "Wir sammeln, behandeln oder beseitigen Abwasser",
      "nis2.question.bc.activity.option.water_none": "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.water_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.digital_ixp":
        "Wir betreiben einen Internet-Knoten (IXP)",
      "nis2.question.bc.activity.option.digital_cloud":
        "Wir erbringen Cloud-Computing-Dienste",
      "nis2.question.bc.activity.option.digital_data_centre":
        "Wir erbringen Rechenzentrumsdienste",
      "nis2.question.bc.activity.option.digital_cdn":
        "Wir betreiben ein Content-Delivery-Network (CDN)",
      "nis2.question.bc.activity.option.digital_msp.helper":
        "Verwaltete IT-Dienste: kontinuierliche Verwaltung oder Betrieb der IKT-Systeme von Kunden. Einmalige Beratung oder reine Softwareentwicklung allein zählt für diese Option nicht.",
      "nis2.question.bc.activity.option.digital_msp":
        "Wir verwalten oder betreiben kontinuierlich IT-Systeme von Kunden",
      "nis2.question.bc.activity.option.digital_mssp.helper":
        "Verwaltete Sicherheitsdienste: kontinuierliche Verwaltung oder Betrieb von Cybersicherheitsdiensten für Kunden. Einmalige Beratung oder reine Softwareentwicklung allein zählt für diese Option nicht.",
      "nis2.question.bc.activity.option.digital_mssp":
        "Wir verwalten oder betreiben kontinuierlich Cybersicherheitsdienste für Kunden",
      "nis2.question.bc.activity.option.digital_dns":
        "Wir erbringen DNS-Dienste",
      "nis2.question.bc.activity.option.digital_tld_registry":
        "Wir betreiben ein Top-Level-Domain-Register",
      "nis2.question.bc.activity.option.digital_qualified_trust":
        "Wir erbringen qualifizierte Vertrauensdienste",
      "nis2.question.bc.activity.option.digital_other_trust":
        "Wir erbringen sonstige (nicht qualifizierte) Vertrauensdienste",
      "nis2.question.bc.activity.option.digital_telecom":
        "Wir betreiben ein öffentliches Telekommunikationsnetz oder erbringen öffentlich zugängliche Telekommunikationsdienste",
      "nis2.question.bc.activity.option.digital_marketplace":
        "Wir betreiben einen Online-Marktplatz",
      "nis2.question.bc.activity.option.digital_search_engine":
        "Wir betreiben eine Online-Suchmaschine",
      "nis2.question.bc.activity.option.digital_social_network":
        "Wir betreiben eine Plattform für soziale Netzwerke",
      "nis2.question.bc.activity.option.digital_domain_registration":
        "Wir erbringen Domänennamen-Registrierungsdienste",
      "nis2.question.bc.activity.option.digital_software_only":
        "Wir entwickeln nur Software, erbringen IT-Beratung oder betreiben unsere eigene interne IT",
      "nis2.question.bc.activity.option.digital_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.digital_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.space_ground_infrastructure":
        "Wir betreiben bodengestützte Infrastruktur für weltraumgestützte Dienste",
      "nis2.question.bc.activity.option.space_manufacture":
        "Wir stellen Satelliten, Raumfahrzeuge oder zugehörige Ausrüstung her",
      "nis2.question.bc.activity.option.space_none": "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.space_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.waste_main_activity":
        "Abfallbewirtschaftung ist eine unserer Hauptgeschäftstätigkeiten",
      "nis2.question.bc.activity.option.waste_own_only":
        "Wir behandeln nur Abfälle, die in unserer eigenen Organisation anfallen",
      "nis2.question.bc.activity.option.waste_none": "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.waste_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.chemicals_manufacture_import.definition":
        "Die Kategorie erfasst Hersteller oder Importeure chemischer Stoffe oder Gemische, die nach der REACH-Verordnung registrierungspflichtig sind und der NACE-Abteilung 20 zuzuordnen sind.",
      "nis2.question.bc.activity.option.chemicals_manufacture_import":
        "Wir stellen unter die einschlägige REACH- bzw. Chemikalienherstellungskategorie fallende Stoffe oder Gemische her oder importieren sie",
      "nis2.question.bc.activity.option.chemicals_use_only":
        "Wir verwenden nur von anderen Unternehmen gekaufte chemische Produkte",
      "nis2.question.bc.activity.option.chemicals_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.chemicals_unsure":
        "Ich bin mir nicht sicher, ob unsere Chemikalientätigkeit diese Definition erfüllt",
      "nis2.question.bc.activity.option.food_wholesale":
        "Wir handeln im Großhandel mit Lebensmitteln",
      "nis2.question.bc.activity.option.food_industrial":
        "Wir produzieren oder verarbeiten Lebensmittel industriell",
      "nis2.question.bc.activity.option.food_retail_only":
        "Wir betreiben nur Einzelhandel, Restaurants oder Catering",
      "nis2.question.bc.activity.option.food_none": "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.food_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.manufacturing_medical_devices":
        "Wir stellen Medizinprodukte oder In-vitro-Diagnostika her",
      "nis2.question.bc.activity.option.manufacturing_computers":
        "Wir stellen Computer, elektronische oder optische Erzeugnisse her",
      "nis2.question.bc.activity.option.manufacturing_electrical":
        "Wir stellen elektrische Ausrüstungen her",
      "nis2.question.bc.activity.option.manufacturing_machinery":
        "Wir stellen Maschinen her",
      "nis2.question.bc.activity.option.manufacturing_vehicles":
        "Wir stellen Kraftwagen oder Kraftwagenteile her",
      "nis2.question.bc.activity.option.manufacturing_other_transport":
        "Wir stellen sonstige Fahrzeuge her",
      "nis2.question.bc.activity.option.manufacturing_other_only":
        "Wir stellen nur andere Produkte her",
      "nis2.question.bc.activity.option.manufacturing_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.manufacturing_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.activity.option.research_applied_commercial":
        "Unser Hauptzweck ist angewandte Forschung oder experimentelle Entwicklung zur kommerziellen Nutzung",
      "nis2.question.bc.activity.option.research_education_only":
        "Wir sind in erster Linie eine Bildungseinrichtung",
      "nis2.question.bc.activity.option.research_none":
        "Keine dieser Tätigkeiten",
      "nis2.question.bc.activity.option.research_unsure":
        "Ich bin mir nicht sicher",
      "nis2.question.bc.employee_count.text":
        "Wie viele Mitarbeitende hat die maßgebliche Unternehmenseinheit?",
      "nis2.question.bc.employee_count.help":
        "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
      "nis2.question.bc.employee_count.tooltip":
        "Gemeint ist die für die Unternehmensgröße maßgebliche Zahl der Mitarbeitenden. Dabei können je nach Unternehmensstruktur auch verbundene Unternehmen oder Partnerunternehmen berücksichtigt werden. Wählen Sie „Unsicher“, wenn Ihnen die genaue Zahl nicht bekannt ist.",
      "nis2.question.bc.employee_count.option.under_50": "Unter 50",
      "nis2.question.bc.employee_count.option.50_249": "50–249",
      "nis2.question.bc.employee_count.option.250_plus": "250 oder mehr",
      "nis2.question.bc.employee_count.option.unsure": "Unsicher",
      "nis2.question.bc.annual_revenue.text":
        "Wie hoch ist der maßgebliche Jahresumsatz?",
      "nis2.question.bc.annual_revenue.help":
        "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
      "nis2.question.bc.annual_revenue.tooltip":
        "Gemeint ist der Jahresumsatz, der für die Bestimmung der Unternehmensgröße berücksichtigt wird. Bei verbundenen Unternehmen oder Partnerunternehmen müssen möglicherweise weitere Umsätze ganz oder teilweise einbezogen werden.",
      "nis2.question.bc.annual_revenue.option.revenue_at_most_10m":
        "Höchstens 10 Mio. €",
      "nis2.question.bc.annual_revenue.option.revenue_over_10m_to_50m":
        "Über 10 bis einschließlich 50 Mio. €",
      "nis2.question.bc.annual_revenue.option.revenue_over_50m":
        "Über 50 Mio. €",
      "nis2.question.bc.annual_revenue.option.unsure": "Unsicher",
      "nis2.question.bc.balance_sheet_total.text":
        "Wie hoch ist die maßgebliche Jahresbilanzsumme?",
      "nis2.question.bc.balance_sheet_total.help":
        "Wählen Sie die zutreffende Spanne. Exakte Zahlen sind nicht erforderlich.",
      "nis2.question.bc.balance_sheet_total.tooltip":
        "Die Jahresbilanzsumme finden Sie in der Bilanz des letzten abgeschlossenen Geschäftsjahres. Bei verbundenen Unternehmen oder Partnerunternehmen müssen möglicherweise weitere Werte ganz oder teilweise berücksichtigt werden.",
      "nis2.question.bc.balance_sheet_total.option.balance_at_most_10m":
        "Höchstens 10 Mio. €",
      "nis2.question.bc.balance_sheet_total.option.balance_over_10m_to_43m":
        "Über 10 bis einschließlich 43 Mio. €",
      "nis2.question.bc.balance_sheet_total.option.balance_over_43m":
        "Über 43 Mio. €",
      "nis2.question.bc.balance_sheet_total.option.unsure": "Unsicher",
      "nis2.question.bc.aggregation.text":
        "Beziehen sich die oben angegebenen Größenspannen bereits auf relevante Partner- und verbundene Unternehmen?",
      "nis2.question.bc.aggregation.help":
        "Eine bloße Konzernzugehörigkeit entscheidet nicht über NIS2. Entscheidend ist, dass die Mitarbeiteranzahl und die Finanzwerte einschließlich der Aggregationsregeln korrekt ermittelt wurden.",
      "nis2.question.bc.aggregation.tooltip":
        "Gehört Ihre Organisation zu einer Unternehmensgruppe oder bestehen Beteiligungen an anderen Unternehmen, müssen deren Mitarbeiteranzahlen, Umsätze und Bilanzsummen möglicherweise ganz oder teilweise mitgerechnet werden. Die deutsche IT-Unabhängigkeitsausnahme kann in eng begrenzten Fällen einzelne verbundene Unternehmen ausnehmen.",
      "nis2.question.bc.aggregation.option.verified_de_without_it_exception":
        "Ja",
      "nis2.question.bc.aggregation.option.not_applicable_no_partner_or_linked_enterprises":
        "Wir haben keine relevanten Partner- oder verbundenen Unternehmen",
      "nis2.question.bc.aggregation.option.verified_de_with_it_exception":
        "Ja, unter Berücksichtigung der BSIG-IT-Unabhängigkeitsausnahme",
      "nis2.question.bc.aggregation.option.no": "Nein",
      "nis2.question.bc.aggregation.option.unsure": "Ich bin mir nicht sicher",
      "nis2.legal.eu_nis2.article_2.citation":
        "Richtlinie (EU) 2022/2555, Artikel 2",
      "nis2.legal.eu_nis2.article_2_4.citation":
        "Richtlinie (EU) 2022/2555, Artikel 2(4)",
      "nis2.legal.eu_nis2.article_3.citation":
        "Richtlinie (EU) 2022/2555, Artikel 3",
      "nis2.legal.eu_nis2.article_4.citation":
        "Richtlinie (EU) 2022/2555, Artikel 4",
      "nis2.legal.eu_nis2.article_26.citation":
        "Richtlinie (EU) 2022/2555, Artikel 26",
      "nis2.legal.eu_nis2.article_28.citation":
        "Richtlinie (EU) 2022/2555, Artikel 28",
      "nis2.legal.eu_nis2.annex_i_1_a.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 1(a)",
      "nis2.legal.eu_nis2.annex_i_1_b.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 1(b)",
      "nis2.legal.eu_nis2.annex_i_1_c.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 1(c)",
      "nis2.legal.eu_nis2.annex_i_1_d.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 1(d)",
      "nis2.legal.eu_nis2.annex_i_1_e.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 1(e)",
      "nis2.legal.eu_nis2.annex_i_2_a.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 2(a)",
      "nis2.legal.eu_nis2.annex_i_2_b.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 2(b)",
      "nis2.legal.eu_nis2.annex_i_2_c.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 2(c)",
      "nis2.legal.eu_nis2.annex_i_2_d.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 2(d)",
      "nis2.legal.eu_nis2.annex_i_3.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 3",
      "nis2.legal.eu_nis2.annex_i_4.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 4",
      "nis2.legal.eu_nis2.annex_i_5.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 5",
      "nis2.legal.eu_nis2.annex_i_6.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 6",
      "nis2.legal.eu_nis2.annex_i_7.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 7",
      "nis2.legal.eu_nis2.annex_i_8.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 8",
      "nis2.legal.eu_nis2.annex_i_9.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 9",
      "nis2.legal.eu_nis2.annex_i_10.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 10",
      "nis2.legal.eu_nis2.annex_i_11.citation":
        "Richtlinie (EU) 2022/2555, Anhang I, 11",
      "nis2.legal.eu_nis2.annex_ii_1.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 1",
      "nis2.legal.eu_nis2.annex_ii_2.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 2",
      "nis2.legal.eu_nis2.annex_ii_3.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 3",
      "nis2.legal.eu_nis2.annex_ii_4.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 4",
      "nis2.legal.eu_nis2.annex_ii_5_a.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(a)",
      "nis2.legal.eu_nis2.annex_ii_5_b.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(b)",
      "nis2.legal.eu_nis2.annex_ii_5_c.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(c)",
      "nis2.legal.eu_nis2.annex_ii_5_d.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(d)",
      "nis2.legal.eu_nis2.annex_ii_5_e.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(e)",
      "nis2.legal.eu_nis2.annex_ii_5_f.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 5(f)",
      "nis2.legal.eu_nis2.annex_ii_6.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 6",
      "nis2.legal.eu_nis2.annex_ii_7.citation":
        "Richtlinie (EU) 2022/2555, Anhang II, 7",
      "nis2.legal.de_bsig.annex_1_1_1_1.citation": "Anlage 1 Nummer 1.1.1",
      "nis2.legal.de_bsig.annex_1_1_1_2.citation": "Anlage 1 Nummer 1.1.2",
      "nis2.legal.de_bsig.annex_1_1_1_3.citation": "Anlage 1 Nummer 1.1.3",
      "nis2.legal.de_bsig.annex_1_1_1_4.citation": "Anlage 1 Nummer 1.1.4",
      "nis2.legal.de_bsig.annex_1_1_1_5.citation": "Anlage 1 Nummer 1.1.5",
      "nis2.legal.de_bsig.annex_1_1_1_6.citation": "Anlage 1 Nummer 1.1.6",
      "nis2.legal.de_bsig.annex_1_1_1_7.citation": "Anlage 1 Nummer 1.1.7",
      "nis2.legal.de_bsig.annex_1_1_1_8.citation": "Anlage 1 Nummer 1.1.8",
      "nis2.legal.de_bsig.annex_1_1_1_9.citation": "Anlage 1 Nummer 1.1.9",
      "nis2.legal.de_bsig.annex_1_1_2_1.citation": "Anlage 1 Nummer 1.2.1",
      "nis2.legal.de_bsig.annex_1_1_3_1.citation": "Anlage 1 Nummer 1.3.1",
      "nis2.legal.de_bsig.annex_1_1_3_2.citation": "Anlage 1 Nummer 1.3.2",
      "nis2.legal.de_bsig.annex_1_1_3_3.citation": "Anlage 1 Nummer 1.3.3",
      "nis2.legal.de_bsig.annex_1_1_4_1.citation": "Anlage 1 Nummer 1.4.1",
      "nis2.legal.de_bsig.annex_1_1_4_2.citation": "Anlage 1 Nummer 1.4.2",
      "nis2.legal.de_bsig.annex_1_1_4_3.citation": "Anlage 1 Nummer 1.4.3",
      "nis2.legal.de_bsig.annex_1_1_4_4.citation": "Anlage 1 Nummer 1.4.4",
      "nis2.legal.de_bsig.annex_1_1_4_5.citation": "Anlage 1 Nummer 1.4.5",
      "nis2.legal.de_bsig.annex_1_1_4_6.citation": "Anlage 1 Nummer 1.4.6",
      "nis2.legal.de_bsig.annex_1_1_4_7.citation": "Anlage 1 Nummer 1.4.7",
      "nis2.legal.de_bsig.annex_1_1_4_8.citation": "Anlage 1 Nummer 1.4.8",
      "nis2.legal.de_bsig.annex_1_2_1_1.citation": "Anlage 1 Nummer 2.1.1",
      "nis2.legal.de_bsig.annex_1_2_1_2.citation": "Anlage 1 Nummer 2.1.2",
      "nis2.legal.de_bsig.annex_1_2_1_3.citation": "Anlage 1 Nummer 2.1.3",
      "nis2.legal.de_bsig.annex_1_2_2_1.citation": "Anlage 1 Nummer 2.2.1",
      "nis2.legal.de_bsig.annex_1_2_2_2.citation": "Anlage 1 Nummer 2.2.2",
      "nis2.legal.de_bsig.annex_1_2_3_1.citation": "Anlage 1 Nummer 2.3.1",
      "nis2.legal.de_bsig.annex_1_2_3_2.citation": "Anlage 1 Nummer 2.3.2",
      "nis2.legal.de_bsig.annex_1_2_3_3.citation": "Anlage 1 Nummer 2.3.3",
      "nis2.legal.de_bsig.annex_1_2_4_1.citation": "Anlage 1 Nummer 2.4.1",
      "nis2.legal.de_bsig.annex_1_2_4_2.citation": "Anlage 1 Nummer 2.4.2",
      "nis2.legal.de_bsig.annex_1_3_1_1.citation": "Anlage 1 Nummer 3.1.1",
      "nis2.legal.de_bsig.annex_1_3_2_1.citation": "Anlage 1 Nummer 3.2.1",
      "nis2.legal.de_bsig.annex_1_3_2_2.citation": "Anlage 1 Nummer 3.2.2",
      "nis2.legal.de_bsig.annex_1_4_1_1.citation": "Anlage 1 Nummer 4.1.1",
      "nis2.legal.de_bsig.annex_1_4_1_2.citation": "Anlage 1 Nummer 4.1.2",
      "nis2.legal.de_bsig.annex_1_4_1_3.citation": "Anlage 1 Nummer 4.1.3",
      "nis2.legal.de_bsig.annex_1_4_1_4.citation": "Anlage 1 Nummer 4.1.4",
      "nis2.legal.de_bsig.annex_1_4_1_5.citation": "Anlage 1 Nummer 4.1.5",
      "nis2.legal.de_bsig.annex_1_5_1_1.citation": "Anlage 1 Nummer 5.1.1",
      "nis2.legal.de_bsig.annex_1_5_2_1.citation": "Anlage 1 Nummer 5.2.1",
      "nis2.legal.de_bsig.annex_1_6_1_1.citation": "Anlage 1 Nummer 6.1.1",
      "nis2.legal.de_bsig.annex_1_6_1_2.citation": "Anlage 1 Nummer 6.1.2",
      "nis2.legal.de_bsig.annex_1_6_1_3.citation": "Anlage 1 Nummer 6.1.3",
      "nis2.legal.de_bsig.annex_1_6_1_4.citation": "Anlage 1 Nummer 6.1.4",
      "nis2.legal.de_bsig.annex_1_6_1_5.citation": "Anlage 1 Nummer 6.1.5",
      "nis2.legal.de_bsig.annex_1_6_1_6.citation": "Anlage 1 Nummer 6.1.6",
      "nis2.legal.de_bsig.annex_1_6_1_7.citation": "Anlage 1 Nummer 6.1.7",
      "nis2.legal.de_bsig.annex_1_6_1_8.citation": "Anlage 1 Nummer 6.1.8",
      "nis2.legal.de_bsig.annex_1_6_1_9.citation": "Anlage 1 Nummer 6.1.9",
      "nis2.legal.de_bsig.annex_1_6_1_10.citation": "Anlage 1 Nummer 6.1.10",
      "nis2.legal.de_bsig.annex_1_6_1_11.citation": "Anlage 1 Nummer 6.1.11",
      "nis2.legal.de_bsig.annex_1_7_1_1.citation": "Anlage 1 Nummer 7.1.1",
      "nis2.legal.de_bsig.annex_2_1_1_1.citation": "Anlage 2 Nummer 1.1.1",
      "nis2.legal.de_bsig.annex_2_2_1_1.citation": "Anlage 2 Nummer 2.1.1",
      "nis2.legal.de_bsig.annex_2_3_1_1.citation": "Anlage 2 Nummer 3.1.1",
      "nis2.legal.de_bsig.annex_2_4_1_1.citation": "Anlage 2 Nummer 4.1.1",
      "nis2.legal.de_bsig.annex_2_5_1_1.citation": "Anlage 2 Nummer 5.1.1",
      "nis2.legal.de_bsig.annex_2_5_2_1.citation": "Anlage 2 Nummer 5.2.1",
      "nis2.legal.de_bsig.annex_2_5_3_1.citation": "Anlage 2 Nummer 5.3.1",
      "nis2.legal.de_bsig.annex_2_5_4_1.citation": "Anlage 2 Nummer 5.4.1",
      "nis2.legal.de_bsig.annex_2_5_5_1.citation": "Anlage 2 Nummer 5.5.1",
      "nis2.legal.de_bsig.annex_2_5_6_1.citation": "Anlage 2 Nummer 5.6.1",
      "nis2.legal.de_bsig.annex_2_6_1_1.citation": "Anlage 2 Nummer 6.1.1",
      "nis2.legal.de_bsig.annex_2_6_1_2.citation": "Anlage 2 Nummer 6.1.2",
      "nis2.legal.de_bsig.annex_2_6_1_3.citation": "Anlage 2 Nummer 6.1.3",
      "nis2.legal.de_bsig.annex_2_7_1_1.citation": "Anlage 2 Nummer 7.1.1",
      "nis2.legal.de_enwg.title": "Energiewirtschaftsgesetz",
      "nis2.legal.de_enwg.section_3.citation": "§ 3",
      "nis2.legal.de_lsv.title": "Ladesäulenverordnung",
      "nis2.legal.de_lsv.section_2.citation": "§ 2",
      "nis2.legal.de_geg.title": "Gebäudeenergiegesetz",
      "nis2.legal.de_geg.section_3.citation": "§ 3",
      "nis2.legal.de_aeg.title": "Allgemeines Eisenbahngesetz",
      "nis2.legal.de_aeg.section_2.citation": "§ 2",
      "nis2.legal.de_wastrg.title": "Bundeswasserstraßengesetz",
      "nis2.legal.de_wastrg.section_1_6_1.citation": "§ 1 Absatz 6 Nummer 1",
      "nis2.legal.de_fstrg.title": "Bundesfernstraßengesetz",
      "nis2.legal.de_fstrg.section_1.citation": "§ 1",
      "nis2.legal.de_ivsg.title": "Intelligente Verkehrssysteme Gesetz",
      "nis2.legal.de_ivsg.section_2_1.citation": "§ 2 Nummer 1",
      "nis2.legal.de_wphg.title": "Wertpapierhandelsgesetz",
      "nis2.legal.de_wphg.section_2_22.citation": "§ 2 Absatz 22",
      "nis2.legal.de_amg.title": "Arzneimittelgesetz",
      "nis2.legal.de_amg.section_2.citation": "§ 2",
      "nis2.legal.de_trinkwv.title": "Trinkwasserverordnung",
      "nis2.legal.de_trinkwv.section_2_3.citation": "§ 2 Nummer 3",
      "nis2.legal.de_whg.title": "Wasserhaushaltsgesetz",
      "nis2.legal.de_whg.section_54_1.citation": "§ 54 Absatz 1",
      "nis2.legal.de_postg.title": "Postgesetz",
      "nis2.legal.de_postg.section_3_15.citation": "§ 3 Nummer 15",
      "nis2.legal.de_krwg.title": "Kreislaufwirtschaftsgesetz",
      "nis2.legal.de_krwg.section_3_14.citation": "§ 3 Absatz 14",
      "nis2.legal.eu_reg_2019_943.title": "Verordnung (EU) 2019/943",
      "nis2.legal.eu_reg_2019_943.article_2_8.citation": "Artikel 2 Nummer 8",
      "nis2.legal.eu_dir_2009_119.title": "Richtlinie 2009/119/EG",
      "nis2.legal.eu_dir_2009_119.article_2_f.citation":
        "Artikel 2 Buchstabe f",
      "nis2.legal.eu_reg_300_2008.title": "Verordnung (EG) Nr. 300/2008",
      "nis2.legal.eu_reg_300_2008.article_3_4.citation": "Artikel 3 Nummer 4",
      "nis2.legal.eu_reg_2017_373.title":
        "Durchführungsverordnung (EU) 2017/373",
      "nis2.legal.eu_reg_2017_373.article_2_2.citation": "Artikel 2 Nummer 2",
      "nis2.legal.eu_dir_2011_24.title": "Richtlinie 2011/24/EU",
      "nis2.legal.eu_dir_2011_24.article_3_g.citation": "Artikel 3 Buchstabe g",
      "nis2.legal.eu_reg_2022_2371.title": "Verordnung (EU) 2022/2371",
      "nis2.legal.eu_reg_2022_2371.article_15.citation": "Artikel 15",
      "nis2.legal.eu_reg_2022_123.title": "Verordnung (EU) 2022/123",
      "nis2.legal.eu_reg_2022_123.article_22.citation": "Artikel 22",
      "nis2.legal.eu_nace_rev_2.title":
        "Verordnung (EG) Nr. 1893/2006 (NACE Rev. 2)",
      "nis2.legal.eu_nace_rev_2.division_20.citation": "Anhang I, Abteilung 20",
      "nis2.legal.eu_nace_rev_2.division_21.citation": "Anhang I, Abteilung 21",
      "nis2.legal.eu_nace_rev_2.division_26.citation": "Anhang I, Abteilung 26",
      "nis2.legal.eu_nace_rev_2.division_27.citation": "Anhang I, Abteilung 27",
      "nis2.legal.eu_nace_rev_2.division_28.citation": "Anhang I, Abteilung 28",
      "nis2.legal.eu_nace_rev_2.division_29.citation": "Anhang I, Abteilung 29",
      "nis2.legal.eu_nace_rev_2.division_30.citation": "Anhang I, Abteilung 30",
      "nis2.legal.eu_reach.title": "Verordnung (EG) Nr. 1907/2006 (REACH)",
      "nis2.legal.eu_reach.article_3_9.citation": "Artikel 3 Nummer 9",
      "nis2.legal.eu_reach.article_3_11.citation": "Artikel 3 Nummer 11",
      "nis2.legal.eu_reach.article_6.citation": "Artikel 6",
      "nis2.legal.eu_reg_178_2002.title": "Verordnung (EG) Nr. 178/2002",
      "nis2.legal.eu_reg_178_2002.article_3_2.citation": "Artikel 3 Nummer 2",
      "nis2.legal.eu_reg_2017_745.title": "Verordnung (EU) 2017/745",
      "nis2.legal.eu_reg_2017_745.article_2_30.citation": "Artikel 2 Nummer 30",
      "nis2.legal.eu_reg_2017_746.title": "Verordnung (EU) 2017/746",
      "nis2.legal.eu_reg_2017_746.article_2_23.citation": "Artikel 2 Nummer 23",
      "nis2.legal.eu_nis2.title": "NIS2-Richtlinie",
      "nis2.legal.eu_sme.title": "EU-KMU-Empfehlung",
      "nis2.legal.eu_sme_recommendation.annex_article_2.citation":
        "Anhang, Artikel 2",
      "nis2.legal.eu_cer.title": "CER-Richtlinie",
      "nis2.legal.eu_cer.article_6.citation": "Artikel 6",
      "nis2.legal.de_bsig.title": "BSI-Gesetz",
      "nis2.legal.de_bsig.section_28.citation": "§ 28",
      "nis2.legal.de_bsig.section_28_1_1.citation": "§ 28 Absatz 1 Nummer 1",
      "nis2.legal.de_bsig.section_28_5.citation": "§ 28 Absatz 5",
      "nis2.legal.de_bsig.section_28_6.citation": "§ 28 Absatz 6",
      "nis2.legal.de_bsig.section_2.citation": "§ 2",
      "nis2.legal.de_bsig.section_29.citation": "§ 29",
      "nis2.legal.de_bsig.section_34.citation": "§ 34",
      "nis2.legal.de_bsig.section_59.citation": "§ 59",
      "nis2.legal.de_bsig.section_60.citation": "§ 60",
      "nis2.legal.de_bsig.section_66.citation": "§ 66",
      "nis2.legal.de_bsig.annex_1.citation": "Anlage 1",
      "nis2.legal.de_bsig.annex_2.citation": "Anlage 2",
      "nis2.legal.de_bsi_kritisv.title": "BSI-Kritisverordnung",
      "nis2.legal.de_bsi_kritisv.section_12.citation": "§ 12",
      "nis2.legal.de_kritisdachg.title": "KRITIS-Dachgesetz",
      "nis2.legal.de_kritisdachg.section_4.citation": "§ 4",
      "nis2.legal.de_kritisdachg.section_5.citation": "§ 5",
      "nis2.outcome.essential_entity.label": "Wesentliche Einrichtung",
      "nis2.outcome.important_entity.label": "Wichtige Einrichtung",
      "nis2.outcome.not_directly_in_scope.label":
        "Nicht direkt im Anwendungsbereich",
      "nis2.outcome.clarification_required.label": "Klärung erforderlich",
      "nis2.reason.outside_eu_activity": "Keine relevante Tätigkeit in der EU.",
      "nis2.reason.annex_i_large":
        "Tätigkeit nach Anhang I oberhalb der Schwelle für mittlere Unternehmen.",
      "nis2.reason.annex_i_medium":
        "Tätigkeit nach Anhang I mit mittlerer Unternehmensgröße.",
      "nis2.reason.annex_ii_medium_or_large":
        "Tätigkeit nach Anhang II mit mittlerer oder großer Unternehmensgröße.",
      "nis2.reason.below_size_cap":
        "Erfasste Tätigkeit unterhalb der allgemeinen Größenschwelle.",
      "nis2.reason.size_independent_essential":
        "Größenunabhängig wesentliche Einrichtung.",
      "nis2.reason.size_independent_important":
        "Größenunabhängig wichtige Einrichtung.",
      "nis2.reason.telecom_medium_or_large":
        "Telekommunikationsanbieter mittlerer oder großer Größe.",
      "nis2.reason.telecom_small":
        "Telekommunikationsanbieter unterhalb der mittleren Größe.",
      "nis2.reason.de_size_independent_particularly_important":
        "Nach deutschem BSIG größenunabhängig besonders wichtige Einrichtung.",
      "nis2.reason.de_size_independent_important":
        "Nach deutschem BSIG größenunabhängig wichtige Einrichtung.",
      "nis2.reason.de_telecom_medium_or_large":
        "Deutscher Telekommunikationsanbieter oberhalb der mittleren Größenschwelle.",
      "nis2.reason.de_telecom_small":
        "Deutscher Telekommunikationsanbieter unterhalb der mittleren Größenschwelle.",
      "nis2.reason.de_annex_1_large":
        "Deutsche Anlage-1-Identität oberhalb der Schwelle für besonders wichtige Einrichtungen.",
      "nis2.reason.de_annex_1_medium":
        "Deutsche Anlage-1-Identität mit mittlerer Unternehmensgröße.",
      "nis2.reason.de_annex_2_medium_or_large":
        "Deutsche Anlage-2-Identität mit mittlerer oder großer Unternehmensgröße.",
      "nis2.reason.de_below_size_cap":
        "Deutsche Annex-Identität unterhalb der allgemeinen Größenschwelle.",
      "nis2.reason.member_state_essential_designation":
        "Behördlich als wesentliche Einrichtung eingestuft.",
      "nis2.reason.member_state_important_designation":
        "Behördlich als wichtige Einrichtung eingestuft.",
      "nis2.reason.cer_critical_designation":
        "Als kritische Einrichtung nach CER benannt.",
      "nis2.reason.de_critical_installation":
        "Betreiber einer kritischen Anlage nach deutschem BSIG.",
      "nis2.reason.no_covered_entity_type":
        "Keine erfasste Einrichtungsart angegeben.",
      "nis2.reason.domain_registration_obligations":
        "Besondere Pflichten für Domänennamenregistrierungsdienste.",
      "nis2.reason.dora_lex_specialis":
        "DORA kann als sektorspezifischer Rechtsakt vorgehen.",
      "nis2.reason.de_telecom_energy_overlay":
        "Sektorspezifische deutsche Vorschriften können einzelne Pflichten ersetzen.",
      "nis2.reason.other_sector_specific_regime":
        "Ein weiteres sektorspezifisches Regelwerk ist zu berücksichtigen.",
      "nis2.reason.sector_specific_regime_unknown":
        "Das sektorspezifische Regelwerk ist unklar.",
      "nis2.reason.unresolved_eu_activity":
        "Es ist unklar, ob relevante Tätigkeiten in der EU erbracht werden.",
      "nis2.reason.unresolved_country":
        "Der zuständige Mitgliedstaat ist unklar.",
      "nis2.reason.unresolved_jurisdiction_basis":
        "Die Grundlage der EU-Zuständigkeit ist unklar.",
      "nis2.reason.unresolved_entity_type":
        "Die konkrete Einrichtungsart ist unklar.",
      "nis2.reason.unresolved_regional_administration":
        "Die nationale Risikoeinstufung der regionalen Verwaltung muss geprüft werden.",
      "nis2.reason.unresolved_designation":
        "Eine behördliche oder CER-Einstufung muss geprüft werden.",
      "nis2.reason.unresolved_german_designation_country":
        "Die deutsche Einstufung passt nicht zum ausgewählten Mitgliedstaat.",
      "nis2.reason.unresolved_size":
        "Die rechtlich maßgebliche Unternehmensgröße ist unklar.",
      "nis2.reason.unresolved_size_aggregation":
        "Die deutschen Größen- und Aggregationsregeln wurden nicht belastbar bestätigt.",
      "nis2.reason.unresolved_profile_jurisdiction":
        "Die gewählte deutsche Zuständigkeitsgrundlage passt nicht zu allen ausgewählten Einrichtungsarten.",
      "nis2.reason.unresolved_unsupported_profile":
        "Für diesen Mitgliedstaat fehlt ein unterstütztes nationales Profil.",
      "nis2.reason.unresolved_domain_registration_classification":
        "Die zusätzliche nationale Einordnung des Registrierungsdienstes muss geprüft werden.",
      "nis2.reason.unresolved_negative_profile_required":
        "Ein negatives Ergebnis erfordert ein unterstütztes nationales Profil.",
      "nis2.reason.indirect_serves_regulated_customers":
        "Die Organisation erbringt Leistungen für NIS2-relevante Kunden.",
      "nis2.reason.indirect_security_evidence_requests":
        "Kunden fordern Informationssicherheitsnachweise.",
      "nis2.reason.indirect_unknown":
        "Die indirekte Lieferkettenbetroffenheit ist unklar.",
      "nis2.result.disclaimer":
        "Diese automatisierte Einstufung ist eine nachvollziehbare Vorprüfung und ersetzt keine rechtliche Beratung oder behördliche Entscheidung.",
      "nis2.framework.name": "NIS2",
      "nis2.framework.description":
        "Rahmenwerk zur Prüfung der NIS2-Betroffenheit.",
      "nis2.module.betroffenheitscheck.name": "Betroffenheitscheck",
      "nis2.questionnaire.betroffenheitscheck.title":
        "NIS2-Betroffenheitscheck",
      "nis2.legal.de_bsig.section_30_1.citation": "BSI-Gesetz, § 30 Absatz 1",
      "nis2.legal.de_bsig.section_30_2.citation": "BSI-Gesetz, § 30 Absatz 2",
      "nis2.legal.de_bsig.section_30_2_1.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 1",
      "nis2.legal.de_bsig.section_30_2_2.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 2",
      "nis2.legal.de_bsig.section_30_2_3.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 3",
      "nis2.legal.de_bsig.section_30_2_4.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 4",
      "nis2.legal.de_bsig.section_30_2_5.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 5",
      "nis2.legal.de_bsig.section_30_2_6.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 6",
      "nis2.legal.de_bsig.section_30_2_7.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 7",
      "nis2.legal.de_bsig.section_30_2_8.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 8",
      "nis2.legal.de_bsig.section_30_2_9.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 9",
      "nis2.legal.de_bsig.section_30_2_10.citation":
        "BSI-Gesetz, § 30 Absatz 2 Nummer 10",
      "nis2.legal.de_bsig.section_32.citation": "BSI-Gesetz, § 32",
      "nis2.legal.de_bsig.section_38_1.citation": "BSI-Gesetz, § 38 Absatz 1",
      "nis2.legal.de_bsig.section_38_3.citation": "BSI-Gesetz, § 38 Absatz 3",
      "nis2.legal.eu_nis2.article_20_1.citation":
        "Richtlinie (EU) 2022/2555, Artikel 20 Absatz 1",
      "nis2.legal.eu_nis2.article_20_2.citation":
        "Richtlinie (EU) 2022/2555, Artikel 20 Absatz 2",
      "nis2.legal.eu_nis2.article_21_1.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 1",
      "nis2.legal.eu_nis2.article_21_2.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2",
      "nis2.legal.eu_nis2.article_21_2_a.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe a",
      "nis2.legal.eu_nis2.article_21_2_b.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe b",
      "nis2.legal.eu_nis2.article_21_2_c.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe c",
      "nis2.legal.eu_nis2.article_21_2_d.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe d",
      "nis2.legal.eu_nis2.article_21_2_e.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe e",
      "nis2.legal.eu_nis2.article_21_2_f.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe f",
      "nis2.legal.eu_nis2.article_21_2_g.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe g",
      "nis2.legal.eu_nis2.article_21_2_h.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe h",
      "nis2.legal.eu_nis2.article_21_2_i.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe i",
      "nis2.legal.eu_nis2.article_21_2_j.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 2 Buchstabe j",
      "nis2.legal.eu_nis2.article_21_3.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 3",
      "nis2.legal.eu_nis2.article_21_4.citation":
        "Richtlinie (EU) 2022/2555, Artikel 21 Absatz 4",
      "nis2.legal.eu_nis2.article_23.citation":
        "Richtlinie (EU) 2022/2555, Artikel 23",
    },
  },
  en: {
    nis2Release: {
      "nis2.fact.eu_activity.label": "Activity in the EU",
      "nis2.fact.eu_activity.description":
        "Whether relevant services or activities are provided within the EU.",
      "nis2.fact.jurisdiction_country.label": "Competent Member State",
      "nis2.fact.jurisdiction_country.description":
        "Member State whose jurisdiction is assessed under Article 26.",
      "nis2.fact.jurisdiction_basis.label": "Jurisdiction basis",
      "nis2.fact.jurisdiction_basis.description":
        "Establishment, service location, main establishment or EU representative.",
      "nis2.fact.nis2_entity_types.label": "NIS2 entity types",
      "nis2.fact.nis2_entity_types.description":
        "Selected activity identities mapped to NIS2 annex categories and special cases.",
      "nis2.fact.member_state_designation.label": "Authority classification",
      "nis2.fact.member_state_designation.description":
        "Formal classification or designation by a Member State.",
      "nis2.fact.employee_count_bucket.label": "Employee count",
      "nis2.fact.employee_count_bucket.description":
        "Employee count under the SME Recommendation.",
      "nis2.fact.annual_revenue_bucket.label": "Annual turnover",
      "nis2.fact.annual_revenue_bucket.description":
        "Annual turnover using the exact legal thresholds.",
      "nis2.fact.balance_sheet_total_bucket.label":
        "Annual balance-sheet total",
      "nis2.fact.balance_sheet_total_bucket.description":
        "Annual balance-sheet total using the exact legal thresholds.",
      "nis2.fact.sme_figures_verified.label": "SME figures verified",
      "nis2.fact.sme_figures_verified.description":
        "Whether the size figures were calculated correctly or there are no partner or linked enterprises.",
      "nis2.sector.energy.label": "Energy",
      "nis2.sector.transport.label": "Transport",
      "nis2.sector.banking.label": "Banking",
      "nis2.sector.financial_market_infrastructures.label":
        "Financial market infrastructures",
      "nis2.sector.health.label": "Health",
      "nis2.sector.drinking_water.label": "Drinking water",
      "nis2.sector.waste_water.label": "Waste water",
      "nis2.sector.digital_infrastructure.label": "Digital infrastructure",
      "nis2.sector.ict_service_management.label": "ICT service management",
      "nis2.sector.public_administration.label": "Public administration",
      "nis2.sector.space.label": "Space",
      "nis2.sector.postal_courier.label": "Postal and courier services",
      "nis2.sector.waste_management.label": "Waste management",
      "nis2.sector.chemicals.label": "Chemicals",
      "nis2.sector.food.label": "Food",
      "nis2.sector.manufacturing.label": "Manufacturing",
      "nis2.sector.digital_providers.label": "Digital providers",
      "nis2.sector.research.label": "Research",
      "nis2.entity.electricity_supplier.label":
        "Electricity undertaking carrying out supply",
      "nis2.entity.electricity_supplier.description":
        "Electricity undertaking carrying out the supply function under Article 2(12) and (57) of Directive (EU) 2019/944.",
      "nis2.entity.electricity_distribution_operator.label":
        "Electricity distribution system operator",
      "nis2.entity.electricity_distribution_operator.description":
        "Electricity distribution system operator under Article 2(29) of Directive (EU) 2019/944.",
      "nis2.entity.electricity_transmission_operator.label":
        "Electricity transmission system operator",
      "nis2.entity.electricity_transmission_operator.description":
        "Electricity transmission system operator under Article 2(35) of Directive (EU) 2019/944.",
      "nis2.entity.electricity_producer.label": "Electricity producer",
      "nis2.entity.electricity_producer.description":
        "Electricity producer under Article 2(38) of Directive (EU) 2019/944.",
      "nis2.entity.electricity_market_operator.label":
        "Nominated electricity market operator",
      "nis2.entity.electricity_market_operator.description":
        "Nominated electricity market operator under Article 2(8) of Regulation (EU) 2019/943.",
      "nis2.entity.electricity_flexibility_provider.label":
        "Provider of aggregation, demand response or energy storage",
      "nis2.entity.electricity_flexibility_provider.description":
        "Market participant providing aggregation, demand response or energy-storage services under the Union-law definitions cited by NIS2 Annex I point 1(a).",
      "nis2.entity.recharging_point_operator.label":
        "Operator of publicly accessible recharging points",
      "nis2.entity.recharging_point_operator.description":
        "Entity responsible for managing and operating a publicly accessible recharging point that supplies end users.",
      "nis2.entity.district_heating_cooling_operator.label":
        "District heating or cooling operator",
      "nis2.entity.district_heating_cooling_operator.description":
        "District-heating or district-cooling operator under Article 2(19) of Directive (EU) 2018/2001.",
      "nis2.entity.oil_pipeline_operator.label":
        "Oil transmission pipeline operator",
      "nis2.entity.oil_pipeline_operator.description":
        "Operator of an oil transmission pipeline.",
      "nis2.entity.oil_facility_operator.label":
        "Operator of oil production, refining, treatment, storage or transmission facilities",
      "nis2.entity.oil_facility_operator.description":
        "Operator of oil production, refining, treatment, storage or transmission facilities.",
      "nis2.entity.central_oil_stockholding_entity.label":
        "Central oil stockholding entity",
      "nis2.entity.central_oil_stockholding_entity.description":
        "Central stockholding entity under Article 2(f) of Directive 2009/119/EC.",
      "nis2.entity.gas_supply_undertaking.label": "Gas supply undertaking",
      "nis2.entity.gas_supply_undertaking.description":
        "Gas supply undertaking under Article 2(8) of Directive 2009/73/EC.",
      "nis2.entity.gas_distribution_operator.label":
        "Gas distribution system operator",
      "nis2.entity.gas_distribution_operator.description":
        "Gas distribution system operator under Article 2(6) of Directive 2009/73/EC.",
      "nis2.entity.gas_transmission_operator.label":
        "Gas transmission system operator",
      "nis2.entity.gas_transmission_operator.description":
        "Gas transmission system operator under Article 2(4) of Directive 2009/73/EC.",
      "nis2.entity.gas_storage_operator.label": "Gas storage system operator",
      "nis2.entity.gas_storage_operator.description":
        "Gas storage system operator under Article 2(10) of Directive 2009/73/EC.",
      "nis2.entity.lng_operator.label": "LNG system operator",
      "nis2.entity.lng_operator.description":
        "LNG system operator under Article 2(12) of Directive 2009/73/EC.",
      "nis2.entity.natural_gas_undertaking.label": "Natural gas undertaking",
      "nis2.entity.natural_gas_undertaking.description":
        "Natural-gas undertaking under Article 2(1) of Directive 2009/73/EC; not identical to the narrower German extraction-operator category.",
      "nis2.entity.gas_refining_treatment_operator.label":
        "Operator of natural-gas refining or treatment facilities",
      "nis2.entity.gas_refining_treatment_operator.description":
        "Operator of a natural-gas refining or treatment facility.",
      "nis2.entity.hydrogen_operator.label":
        "Hydrogen production, storage or transmission operator",
      "nis2.entity.hydrogen_operator.description":
        "Operator of hydrogen production, storage or transmission facilities.",
      "nis2.entity.air_carrier.label": "Air carrier",
      "nis2.entity.air_carrier.description":
        "Commercially used air carrier under Article 3(4) of Regulation (EC) 300/2008.",
      "nis2.entity.airport_operator.label":
        "Airport managing body, airport or operator of ancillary installations",
      "nis2.entity.airport_operator.description":
        "Airport managing body, covered airport or operator of ancillary airport installations under the acts cited by NIS2 Annex I.",
      "nis2.entity.air_traffic_management_provider.label":
        "Air traffic management or air navigation services provider",
      "nis2.entity.air_traffic_management_provider.description":
        "Air-traffic-management control operator providing air-traffic-control services under Regulation (EC) 549/2004.",
      "nis2.entity.rail_infrastructure_manager.label":
        "Railway infrastructure manager",
      "nis2.entity.rail_infrastructure_manager.description":
        "Railway infrastructure manager under Article 3(2) of Directive 2012/34/EU.",
      "nis2.entity.railway_undertaking.label": "Railway undertaking",
      "nis2.entity.railway_undertaking.description":
        "Railway undertaking, including service-facility operators, under Article 3(1) and (12) of Directive 2012/34/EU.",
      "nis2.entity.water_transport_company.label":
        "Inland, sea or coastal water transport company",
      "nis2.entity.water_transport_company.description":
        "Inland, sea or coastal passenger/freight transport company; individual vessels are excluded.",
      "nis2.entity.port_operator.label":
        "Managing body of a port or port-facility operator",
      "nis2.entity.port_operator.description":
        "Port managing body, port-facility operator or entity operating works and equipment within a port.",
      "nis2.entity.vessel_traffic_service.label":
        "Vessel traffic service operator",
      "nis2.entity.vessel_traffic_service.description":
        "Operator of a vessel traffic service under Article 3(o) of Directive 2002/59/EC.",
      "nis2.entity.road_authority.label": "Road authority",
      "nis2.entity.road_authority.description":
        "Road authority responsible for traffic-management control; merely incidental functions are excluded.",
      "nis2.entity.intelligent_transport_system_operator.label":
        "Operator of intelligent transport systems",
      "nis2.entity.intelligent_transport_system_operator.description":
        "Operator of an intelligent transport system under Article 4(1) of Directive 2010/40/EU.",
      "nis2.entity.credit_institution.label": "Credit institution",
      "nis2.entity.credit_institution.description":
        "Credit institution under Article 4(1) of Regulation (EU) 575/2013.",
      "nis2.entity.trading_venue_operator.label": "Operator of a trading venue",
      "nis2.entity.trading_venue_operator.description":
        "Operator of a trading venue under Article 4(1)(24) of Directive 2014/65/EU.",
      "nis2.entity.central_counterparty.label": "Central counterparty",
      "nis2.entity.central_counterparty.description":
        "Central counterparty under Article 2(1) of Regulation (EU) 648/2012.",
      "nis2.entity.healthcare_provider.label": "Healthcare provider",
      "nis2.entity.healthcare_provider.description":
        "Healthcare provider under Article 3(g) of Directive 2011/24/EU.",
      "nis2.entity.eu_reference_laboratory.label": "EU reference laboratory",
      "nis2.entity.eu_reference_laboratory.description":
        "EU reference laboratory referred to in Article 15 of Regulation (EU) 2022/2371.",
      "nis2.entity.medicinal_product_researcher.label":
        "Entity carrying out research and development of medicinal products",
      "nis2.entity.medicinal_product_researcher.description":
        "Entity carrying out research and development concerning medicinal products under Article 1(2) of Directive 2001/83/EC.",
      "nis2.entity.pharmaceutical_manufacturer.label":
        "Manufacturer of basic pharmaceutical products or preparations",
      "nis2.entity.pharmaceutical_manufacturer.description":
        "Manufacturer of basic pharmaceutical products or preparations carrying out a NACE Rev. 2 division 21 activity.",
      "nis2.entity.critical_medical_device_manufacturer.label":
        "Manufacturer of critical medical devices during a public-health emergency",
      "nis2.entity.critical_medical_device_manufacturer.description":
        "Manufacturer of a medical device placed on the public-health-emergency critical-devices list under Regulation (EU) 2022/123.",
      "nis2.entity.drinking_water_supplier.label":
        "Supplier or distributor of drinking water",
      "nis2.entity.drinking_water_supplier.description":
        "Supplier or distributor of water intended for human consumption; merely incidental water distribution is excluded.",
      "nis2.entity.waste_water_undertaking.label":
        "Undertaking collecting, disposing of or treating waste water",
      "nis2.entity.waste_water_undertaking.description":
        "Undertaking collecting, disposing of or treating urban, domestic or industrial waste water where this is not a non-essential incidental activity.",
      "nis2.entity.internet_exchange_point.label":
        "Internet exchange point provider",
      "nis2.entity.internet_exchange_point.description":
        "Internet exchange point under NIS2 Article 6(18), interconnecting more than two independent autonomous systems within its stated limits.",
      "nis2.entity.dns_service_provider.label": "DNS service provider",
      "nis2.entity.dns_service_provider.description":
        "Provider of public recursive DNS resolution or authoritative DNS resolution for third parties; root name servers are excluded.",
      "nis2.entity.tld_registry.label": "TLD name registry",
      "nis2.entity.tld_registry.description":
        "Entity delegated a top-level domain and responsible for its administration and technical operation; own-use-only TLDs are excluded.",
      "nis2.entity.cloud_service_provider.label":
        "Cloud computing service provider",
      "nis2.entity.cloud_service_provider.description":
        "Provider of an on-demand, remotely administered, scalable and elastic pool of shared computing resources.",
      "nis2.entity.data_centre_service_provider.label":
        "Data centre service provider",
      "nis2.entity.data_centre_service_provider.description":
        "Provider of centralized IT/network accommodation, interconnection and operation with supporting power and environmental infrastructure.",
      "nis2.entity.content_delivery_network_provider.label":
        "Content delivery network provider",
      "nis2.entity.content_delivery_network_provider.description":
        "Provider of geographically distributed servers delivering third-party content or services with high availability, accessibility and speed.",
      "nis2.entity.qualified_trust_service_provider.label":
        "Qualified trust service provider",
      "nis2.entity.qualified_trust_service_provider.description":
        "Qualified trust service provider as an application subdivision of the single NIS2 trust-service category; essential irrespective of size.",
      "nis2.entity.other_trust_service_provider.label":
        "Non-qualified trust service provider",
      "nis2.entity.other_trust_service_provider.description":
        "Non-qualified trust service provider as the complementary subdivision of the same NIS2 category; covered irrespective of size and generally important.",
      "nis2.entity.public_electronic_communications_network.label":
        "Provider of a public electronic communications network",
      "nis2.entity.public_electronic_communications_network.description":
        "Provider of a public electronic communications network under NIS2 Article 6(36) and Directive (EU) 2018/1972 Article 2(8).",
      "nis2.entity.public_electronic_communications_service.label":
        "Provider of a publicly available electronic communications service",
      "nis2.entity.public_electronic_communications_service.description":
        "Provider of a publicly available electronic communications service under NIS2 Article 6(37).",
      "nis2.entity.domain_name_registration_service.label":
        "Provider of domain-name registration services",
      "nis2.entity.domain_name_registration_service.description":
        "Registrar or service acting for registrars, including privacy/proxy services and resellers; covered irrespective of size under Article 2(4).",
      "nis2.entity.managed_service_provider.label":
        "Managed service provider (MSP)",
      "nis2.entity.managed_service_provider.description":
        "Entity actively installing, administering, operating or maintaining customers' ICT or network systems, or assisting with those tasks, locally or remotely.",
      "nis2.entity.managed_security_service_provider.label":
        "Managed security service provider (MSSP)",
      "nis2.entity.managed_security_service_provider.description":
        "Managed service provider carrying out or assisting with cybersecurity risk-management activities.",
      "nis2.entity.central_public_administration.label":
        "Central-government public administration entity",
      "nis2.entity.central_public_administration.description":
        "Central-government entity under national law satisfying the NIS2 public-administration definition, subject to security and defence exclusions.",
      "nis2.entity.regional_public_administration.label":
        "Regional public administration entity with relevant risk classification",
      "nis2.entity.regional_public_administration.description":
        "Regional-administration entity under national law that must also satisfy the national risk-based disruption assessment.",
      "nis2.entity.space_ground_infrastructure_operator.label":
        "Operator of ground-based space infrastructure",
      "nis2.entity.space_ground_infrastructure_operator.description":
        "Operator of public or private ground-based infrastructure supporting space-based services; public communications-network providers are excluded.",
      "nis2.entity.postal_courier_provider.label":
        "Postal or courier service provider",
      "nis2.entity.postal_courier_provider.description":
        "Postal-service provider under Article 2(1a) of Directive 97/67/EC, expressly including courier-service providers.",
      "nis2.entity.waste_management_undertaking.label":
        "Waste-management undertaking where waste management is a principal activity",
      "nis2.entity.waste_management_undertaking.description":
        "Waste-management undertaking under Article 3(9) of Directive 2008/98/EC where waste management is a principal activity.",
      "nis2.entity.chemical_manufacturer_distributor.label":
        "Manufacturer or distributor of chemical substances or mixtures",
      "nis2.entity.chemical_manufacturer_distributor.description":
        "Manufacturer or distributor of substances or mixtures under REACH; an application subdivision of one NIS2 Annex II category.",
      "nis2.entity.chemical_article_producer.label":
        "Producer of articles from chemical substances or mixtures",
      "nis2.entity.chemical_article_producer.description":
        "Producer of articles from substances or mixtures under REACH; the second application subdivision of the same NIS2 Annex II category.",
      "nis2.entity.food_wholesale_industrial_business.label":
        "Food business engaged in wholesale or industrial production and processing",
      "nis2.entity.food_wholesale_industrial_business.description":
        "Food business engaged in wholesale distribution or industrial production and processing; other food businesses are not covered on that basis alone.",
      "nis2.entity.medical_device_manufacturer.label":
        "Manufacturer of medical devices or in-vitro diagnostics",
      "nis2.entity.medical_device_manufacturer.description":
        "Manufacturer of medical devices or in-vitro diagnostics, excluding manufacturers already covered by the Annex I emergency category.",
      "nis2.entity.computer_electronic_optical_manufacturer.label":
        "Manufacturer of computer, electronic or optical products",
      "nis2.entity.computer_electronic_optical_manufacturer.description":
        "Undertaking carrying out a manufacturing activity in NACE Rev. 2 division 26.",
      "nis2.entity.electrical_equipment_manufacturer.label":
        "Manufacturer of electrical equipment",
      "nis2.entity.electrical_equipment_manufacturer.description":
        "Undertaking carrying out a manufacturing activity in NACE Rev. 2 division 27.",
      "nis2.entity.machinery_manufacturer.label":
        "Manufacturer of machinery and equipment n.e.c.",
      "nis2.entity.machinery_manufacturer.description":
        "Undertaking carrying out a manufacturing activity in NACE Rev. 2 division 28.",
      "nis2.entity.motor_vehicle_manufacturer.label":
        "Manufacturer of motor vehicles, trailers or semi-trailers",
      "nis2.entity.motor_vehicle_manufacturer.description":
        "Undertaking carrying out a manufacturing activity in NACE Rev. 2 division 29.",
      "nis2.entity.other_transport_equipment_manufacturer.label":
        "Manufacturer of other transport equipment",
      "nis2.entity.other_transport_equipment_manufacturer.description":
        "Undertaking carrying out a manufacturing activity in NACE Rev. 2 division 30.",
      "nis2.entity.online_marketplace_provider.label":
        "Provider of an online marketplace",
      "nis2.entity.online_marketplace_provider.description":
        "Provider of an online marketplace under NIS2 Article 6(28) and Directive 2005/29/EC Article 2(n).",
      "nis2.entity.online_search_engine_provider.label":
        "Provider of an online search engine",
      "nis2.entity.online_search_engine_provider.description":
        "Provider of an online search engine under NIS2 Article 6(29).",
      "nis2.entity.social_networking_platform_provider.label":
        "Provider of a social networking services platform",
      "nis2.entity.social_networking_platform_provider.description":
        "Platform enabling end users to connect, share, discover and communicate across devices.",
      "nis2.entity.research_organisation.label": "Research organisation",
      "nis2.entity.research_organisation.description":
        "Entity primarily conducting applied research or experimental development for commercial exploitation; educational institutions are excluded.",
      "nis2.profile.de.entity.de_bsig_electricity_supplier.label":
        "Electricity supplier",
      "nis2.profile.de.entity.de_bsig_electricity_supplier.description":
        "Electricity supplier under German BSIG Annex 1 point 1.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.label":
        "Electricity distribution operator",
      "nis2.profile.de.entity.de_bsig_electricity_distribution_operator.description":
        "Electricity distribution operator under German BSIG Annex 1 point 1.1.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.label":
        "Electricity transmission operator",
      "nis2.profile.de.entity.de_bsig_electricity_transmission_operator.description":
        "Electricity transmission operator under German BSIG Annex 1 point 1.1.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.label":
        "Electricity generation-installation operator",
      "nis2.profile.de.entity.de_bsig_electricity_generation_installation_operator.description":
        "Electricity generation-installation operator under German BSIG Annex 1 point 1.1.4; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.label":
        "Nominated electricity market operator",
      "nis2.profile.de.entity.de_bsig_nominated_electricity_market_operator.description":
        "Nominated electricity market operator under German BSIG Annex 1 point 1.1.5; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.label":
        "Electricity aggregator",
      "nis2.profile.de.entity.de_bsig_electricity_aggregator.description":
        "Electricity aggregator under German BSIG Annex 1 point 1.1.6; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.label":
        "Energy-storage installation operator",
      "nis2.profile.de.entity.de_bsig_energy_storage_installation_operator.description":
        "Energy-storage installation operator under German BSIG Annex 1 point 1.1.7; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.label":
        "Balancing-service provider",
      "nis2.profile.de.entity.de_bsig_balancing_service_provider.description":
        "Balancing-service provider under German BSIG Annex 1 point 1.1.8; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.label":
        "Recharging-point operator",
      "nis2.profile.de.entity.de_bsig_recharging_point_operator.description":
        "Recharging-point operator under German BSIG Annex 1 point 1.1.9; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.label":
        "District-heating or district-cooling operator",
      "nis2.profile.de.entity.de_bsig_district_heating_cooling_operator.description":
        "District-heating or district-cooling operator under German BSIG Annex 1 point 1.2.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.label":
        "Oil transmission-pipeline operator",
      "nis2.profile.de.entity.de_bsig_oil_transmission_pipeline_operator.description":
        "Oil transmission-pipeline operator under German BSIG Annex 1 point 1.3.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.label":
        "Oil production, refining, treatment, storage or pipeline-facility operator",
      "nis2.profile.de.entity.de_bsig_oil_facilities_operator.description":
        "Oil production, refining, treatment, storage or pipeline-facility operator under German BSIG Annex 1 point 1.3.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.label":
        "Central oil-stockholding entity",
      "nis2.profile.de.entity.de_bsig_central_oil_stockholding_entity.description":
        "Central oil-stockholding entity under German BSIG Annex 1 point 1.3.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.label":
        "Gas distribution operator",
      "nis2.profile.de.entity.de_bsig_gas_distribution_operator.description":
        "Gas distribution operator under German BSIG Annex 1 point 1.4.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.label":
        "Gas transmission operator",
      "nis2.profile.de.entity.de_bsig_gas_transmission_operator.description":
        "Gas transmission operator under German BSIG Annex 1 point 1.4.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.label":
        "Gas-storage operator",
      "nis2.profile.de.entity.de_bsig_gas_storage_operator.description":
        "Gas-storage operator under German BSIG Annex 1 point 1.4.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_lng_operator.label": "LNG operator",
      "nis2.profile.de.entity.de_bsig_lng_operator.description":
        "LNG operator under German BSIG Annex 1 point 1.4.4; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_gas_supplier.label": "Gas supplier",
      "nis2.profile.de.entity.de_bsig_gas_supplier.description":
        "Gas supplier under German BSIG Annex 1 point 1.4.5; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.label":
        "Natural-gas extraction-installation operator",
      "nis2.profile.de.entity.de_bsig_natural_gas_extraction_operator.description":
        "Natural-gas extraction-installation operator under German BSIG Annex 1 point 1.4.6; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.label":
        "Natural-gas refining or treatment operator",
      "nis2.profile.de.entity.de_bsig_natural_gas_refining_treatment_operator.description":
        "Natural-gas refining or treatment operator under German BSIG Annex 1 point 1.4.7; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_hydrogen_operator.label":
        "Hydrogen production, storage or transmission operator",
      "nis2.profile.de.entity.de_bsig_hydrogen_operator.description":
        "Hydrogen production, storage or transmission operator under German BSIG Annex 1 point 1.4.8; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.label":
        "Commercial air carrier",
      "nis2.profile.de.entity.de_bsig_commercial_air_carrier.description":
        "Commercial air carrier under German BSIG Annex 1 point 2.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_airport_entity.label":
        "Airport managing body, airport or ancillary-installation operator",
      "nis2.profile.de.entity.de_bsig_airport_entity.description":
        "Airport managing body, airport or ancillary-installation operator under German BSIG Annex 1 point 2.1.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_atm_ans_provider.label":
        "ATM or air-navigation-services provider",
      "nis2.profile.de.entity.de_bsig_atm_ans_provider.description":
        "ATM or air-navigation-services provider under German BSIG Annex 1 point 2.1.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.label":
        "Rail-infrastructure operator",
      "nis2.profile.de.entity.de_bsig_rail_infrastructure_operator.description":
        "Rail-infrastructure operator under German BSIG Annex 1 point 2.2.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_railway_undertaking.label":
        "Railway undertaking including service-facility operators",
      "nis2.profile.de.entity.de_bsig_railway_undertaking.description":
        "Railway undertaking including service-facility operators under German BSIG Annex 1 point 2.2.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_water_transport_company.label":
        "Inland, sea or coastal water-transport company",
      "nis2.profile.de.entity.de_bsig_water_transport_company.description":
        "Inland, sea or coastal water-transport company under German BSIG Annex 1 point 2.3.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_port_entity.label":
        "Port managing body, port facility or port works/equipment operator",
      "nis2.profile.de.entity.de_bsig_port_entity.description":
        "Port managing body, port facility or port works/equipment operator under German BSIG Annex 1 point 2.3.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.label":
        "Safe-waterway installation or system operator",
      "nis2.profile.de.entity.de_bsig_waterway_safe_operation_system_operator.description":
        "Safe-waterway installation or system operator under German BSIG Annex 1 point 2.3.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.label":
        "Road traffic-influence installation or system operator",
      "nis2.profile.de.entity.de_bsig_road_traffic_influence_system_operator.description":
        "Road traffic-influence installation or system operator under German BSIG Annex 1 point 2.4.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.label":
        "Intelligent-transport-system operator",
      "nis2.profile.de.entity.de_bsig_intelligent_transport_system_operator.description":
        "Intelligent-transport-system operator under German BSIG Annex 1 point 2.4.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_credit_institution.label":
        "Credit institution",
      "nis2.profile.de.entity.de_bsig_credit_institution.description":
        "Credit institution under German BSIG Annex 1 point 3.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_trading_venue.label": "Trading venue",
      "nis2.profile.de.entity.de_bsig_trading_venue.description":
        "Trading venue under German BSIG Annex 1 point 3.2.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_central_counterparty.label":
        "Central counterparty",
      "nis2.profile.de.entity.de_bsig_central_counterparty.description":
        "Central counterparty under German BSIG Annex 1 point 3.2.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_healthcare_provider.label":
        "Healthcare provider",
      "nis2.profile.de.entity.de_bsig_healthcare_provider.description":
        "Healthcare provider under German BSIG Annex 1 point 4.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.label":
        "EU reference laboratory",
      "nis2.profile.de.entity.de_bsig_eu_reference_laboratory.description":
        "EU reference laboratory under German BSIG Annex 1 point 4.1.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.label":
        "Medicinal-product research and development company",
      "nis2.profile.de.entity.de_bsig_medicinal_product_researcher.description":
        "Medicinal-product research and development company under German BSIG Annex 1 point 4.1.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.label":
        "Pharmaceutical manufacturer",
      "nis2.profile.de.entity.de_bsig_pharmaceutical_manufacturer.description":
        "Pharmaceutical manufacturer under German BSIG Annex 1 point 4.1.4; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.label":
        "Emergency-critical medical-device manufacturer",
      "nis2.profile.de.entity.de_bsig_emergency_critical_medical_device_manufacturer.description":
        "Emergency-critical medical-device manufacturer under German BSIG Annex 1 point 4.1.5; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.label":
        "Drinking-water supply-installation operator",
      "nis2.profile.de.entity.de_bsig_drinking_water_supply_operator.description":
        "Drinking-water supply-installation operator under German BSIG Annex 1 point 5.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.label":
        "Waste-water undertaking",
      "nis2.profile.de.entity.de_bsig_waste_water_undertaking.description":
        "Waste-water undertaking under German BSIG Annex 1 point 5.2.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.label":
        "Internet-exchange-point operator",
      "nis2.profile.de.entity.de_bsig_internet_exchange_point_operator.description":
        "Internet-exchange-point operator under German BSIG Annex 1 point 6.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_dns_service_provider.label":
        "DNS service provider",
      "nis2.profile.de.entity.de_bsig_dns_service_provider.description":
        "DNS service provider under German BSIG Annex 1 point 6.1.2; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_tld_registry.label":
        "Top-level-domain registry",
      "nis2.profile.de.entity.de_bsig_tld_registry.description":
        "Top-level-domain registry under German BSIG Annex 1 point 6.1.3; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.label":
        "Cloud-computing service provider",
      "nis2.profile.de.entity.de_bsig_cloud_service_provider.description":
        "Cloud-computing service provider under German BSIG Annex 1 point 6.1.4; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.label":
        "Data-centre service provider",
      "nis2.profile.de.entity.de_bsig_data_centre_service_provider.description":
        "Data-centre service provider under German BSIG Annex 1 point 6.1.5; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.label":
        "Content-delivery-network operator",
      "nis2.profile.de.entity.de_bsig_content_delivery_network_operator.description":
        "Content-delivery-network operator under German BSIG Annex 1 point 6.1.6; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.label":
        "Qualified trust-service provider",
      "nis2.profile.de.entity.de_bsig_qualified_trust_service_provider.description":
        "Qualified trust-service provider under German BSIG Annex 1 point 6.1.7; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.label":
        "Non-qualified trust-service provider",
      "nis2.profile.de.entity.de_bsig_non_qualified_trust_service_provider.description":
        "Non-qualified trust-service provider under German BSIG Annex 1 point 6.1.7; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.label":
        "Public telecommunications-network operator",
      "nis2.profile.de.entity.de_bsig_public_telecom_network_operator.description":
        "Public telecommunications-network operator under German BSIG Annex 1 point 6.1.8; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.label":
        "Publicly available telecommunications-service provider",
      "nis2.profile.de.entity.de_bsig_publicly_available_telecom_service_provider.description":
        "Publicly available telecommunications-service provider under German BSIG Annex 1 point 6.1.9; selection confirms that the incorporated definition is met.",
      "nis2.profile.de.entity.de_bsig_managed_service_provider.label":
        "Managed-service provider",
      "nis2.profile.de.entity.de_bsig_managed_service_provider.description":
        "Managed-service provider under German BSIG Annex 1 point 6.1.10; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.label":
        "Managed-security-service provider",
      "nis2.profile.de.entity.de_bsig_managed_security_service_provider.description":
        "Managed-security-service provider under German BSIG Annex 1 point 6.1.11; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.label":
        "Space ground-infrastructure operator",
      "nis2.profile.de.entity.de_bsig_space_ground_infrastructure_operator.description":
        "Space ground-infrastructure operator under German BSIG Annex 1 point 7.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.label":
        "Postal or courier-service provider",
      "nis2.profile.de.entity.de_bsig_postal_courier_provider.description":
        "Postal or courier-service provider under German BSIG Annex 2 point 1.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.label":
        "Undertaking with waste management as its principal activity",
      "nis2.profile.de.entity.de_bsig_waste_management_undertaking.description":
        "Undertaking with waste management as its principal activity under German BSIG Annex 2 point 2.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.label":
        "REACH-registered NACE-20 chemical manufacturer or importer",
      "nis2.profile.de.entity.de_bsig_reach_registered_nace20_chemical_manufacturer_importer.description":
        "REACH-registered NACE-20 chemical manufacturer or importer under German BSIG Annex 2 point 3.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.label":
        "Food wholesale or industrial production/processing business",
      "nis2.profile.de.entity.de_bsig_food_wholesale_industrial_business.description":
        "Food wholesale or industrial production/processing business under German BSIG Annex 2 point 4.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.label":
        "Medical-device or in-vitro-diagnostic manufacturer",
      "nis2.profile.de.entity.de_bsig_medical_ivd_device_manufacturer.description":
        "Medical-device or in-vitro-diagnostic manufacturer under German BSIG Annex 2 point 5.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.label":
        "NACE division-26 computer, electronic or optical manufacturer",
      "nis2.profile.de.entity.de_bsig_nace26_computer_electronic_optical_manufacturer.description":
        "NACE division-26 computer, electronic or optical manufacturer under German BSIG Annex 2 point 5.2.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.label":
        "NACE division-27 electrical-equipment manufacturer",
      "nis2.profile.de.entity.de_bsig_nace27_electrical_equipment_manufacturer.description":
        "NACE division-27 electrical-equipment manufacturer under German BSIG Annex 2 point 5.3.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.label":
        "NACE division-28 machinery manufacturer",
      "nis2.profile.de.entity.de_bsig_nace28_machinery_manufacturer.description":
        "NACE division-28 machinery manufacturer under German BSIG Annex 2 point 5.4.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.label":
        "NACE division-29 motor-vehicle manufacturer",
      "nis2.profile.de.entity.de_bsig_nace29_motor_vehicle_manufacturer.description":
        "NACE division-29 motor-vehicle manufacturer under German BSIG Annex 2 point 5.5.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.label":
        "NACE division-30 other-transport-equipment manufacturer",
      "nis2.profile.de.entity.de_bsig_nace30_other_transport_equipment_manufacturer.description":
        "NACE division-30 other-transport-equipment manufacturer under German BSIG Annex 2 point 5.6.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.label":
        "Online-marketplace provider",
      "nis2.profile.de.entity.de_bsig_online_marketplace_provider.description":
        "Online-marketplace provider under German BSIG Annex 2 point 6.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.label":
        "Online-search-engine provider",
      "nis2.profile.de.entity.de_bsig_online_search_engine_provider.description":
        "Online-search-engine provider under German BSIG Annex 2 point 6.1.2; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.label":
        "Social-networking-platform provider",
      "nis2.profile.de.entity.de_bsig_social_networking_platform_provider.description":
        "Social-networking-platform provider under German BSIG Annex 2 point 6.1.3; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_research_organisation.label":
        "Research organisation conducting commercially exploitable applied research or experimental development",
      "nis2.profile.de.entity.de_bsig_research_organisation.description":
        "Research organisation conducting commercially exploitable applied research or experimental development under German BSIG Annex 2 point 7.1.1; selection confirms that the incorporated definition is met. Selection also confirms that the activity is not merely negligible and that goods or services are offered for remuneration.",
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.label":
        "Domain-name registration-service provider",
      "nis2.profile.de.entity.de_bsig_domain_name_registry_service_provider.description":
        "Domain-name registration-service provider",
      "nis2.profile.de.entity.de_bsig_federal_authority.label":
        "Federal authority",
      "nis2.profile.de.entity.de_bsig_federal_authority.description":
        "Federal authority",
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.label":
        "Public-law federal IT provider",
      "nis2.profile.de.entity.de_bsig_federal_public_law_it_provider.description":
        "Public-law federal IT provider",
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.label":
        "Other designated federal public-law body",
      "nis2.profile.de.entity.de_bsig_other_designated_federal_public_body.description":
        "Other designated federal public-law body",
      "nis2.profile.de.entity.de_bsig_regional_public_administration.label":
        "Regional public administration requiring Land-law basis",
      "nis2.profile.de.entity.de_bsig_regional_public_administration.description":
        "Regional public administration requiring Land-law basis",
      "nis2.question.bc.germany_connection.text":
        "Which statement applies to the organisation being assessed?",
      "nis2.question.bc.germany_connection.help":
        "The answer determines whether and on which basis Germany is competent for this assessment.",
      "nis2.question.bc.germany_connection.tooltip":
        "For the German classification, the decisive factors are establishment, critical installations, the federal administration, cross-border digital services, public telecommunications services or regional administration under Land law. Your own assessment of outage impact is not sufficient.",
      "nis2.question.bc.germany_connection.option.de_established":
        "The organisation is established in Germany",
      "nis2.question.bc.germany_connection.option.de_critical_installation":
        "It is not established in Germany, but operates a critical installation in Germany",
      "nis2.question.bc.germany_connection.option.de_federal_administration":
        "It is part of the German federal administration",
      "nis2.question.bc.germany_connection.option.de_cross_border_digital_provider":
        "It is a cross-border digital provider for which Germany is the competent country",
      "nis2.question.bc.germany_connection.option.de_telecom_provider":
        "It provides a public telecommunications service or operates a public telecommunications network for which Germany is competent",
      "nis2.question.bc.germany_connection.option.de_regional_administration":
        "It is regional or state administration subject to German Land law",
      "nis2.question.bc.germany_connection.option.none": "None of these",
      "nis2.question.bc.germany_connection.option.unsure": "I'm not sure",
      "nis2.question.bc.special_status.text":
        "Does any of the following already apply to the organisation?",
      "nis2.question.bc.special_status.help":
        "This means formal classifications by an authority or a designation under the CER Directive, not your own assessment of outage impact.",
      "nis2.question.bc.special_status.tooltip":
        "Select a classification here if an authority or an EU Member State has expressly classified your organization as particularly relevant. Your own assessment that an outage would have serious consequences is not sufficient.",
      "nis2.question.bc.special_status.option.none": "None of these",
      "nis2.question.bc.special_status.option.de_critical_installation":
        "We operate a critical installation",
      "nis2.question.bc.special_status.option.essential_or_cer":
        "An authority has classified us as particularly important or designated us as critical under CER",
      "nis2.question.bc.special_status.option.important":
        "An authority has formally classified us as important",
      "nis2.question.bc.special_status.option.unsure": "I'm not sure",
      "nis2.question.bc.sector.text":
        "In which areas does your organisation itself operate?",
      "nis2.question.bc.sector.help": "Select all areas that apply.",
      "nis2.question.bc.sector.tooltip":
        "What matters is the areas in which your organisation itself provides services. Purchasing or using services from other companies does not by itself establish an area.",
      "nis2.question.bc.sector.option.energy": "Energy",
      "nis2.question.bc.sector.option.transport":
        "Transport, traffic, postal or courier services",
      "nis2.question.bc.sector.option.banking_financial":
        "Banking or financial-market infrastructure",
      "nis2.question.bc.sector.option.health":
        "Healthcare, pharmaceuticals or medical devices",
      "nis2.question.bc.sector.option.water": "Drinking water or wastewater",
      "nis2.question.bc.sector.option.digital":
        "Digital infrastructure, IT, telecommunications or online services",
      "nis2.question.bc.sector.option.space": "Space or satellite services",
      "nis2.question.bc.sector.option.waste": "Waste management",
      "nis2.question.bc.sector.option.chemicals": "Chemicals",
      "nis2.question.bc.sector.option.food": "Food",
      "nis2.question.bc.sector.option.manufacturing": "Manufacturing",
      "nis2.question.bc.sector.option.research": "Research",
      "nis2.question.bc.sector.option.none_of_these": "None of these",
      "nis2.question.bc.sector.option.unsure": "I'm not sure",
      "nis2.question.bc.activity.text":
        "Which of these activities does your organisation itself perform?",
      "nis2.question.bc.activity.help":
        "Select all that apply. Do not select something simply because your organisation purchases or uses it.",
      "nis2.question.bc.activity.tooltip":
        "Selections are mapped onto the entity identities defined in German BSIG Annexes 1 and 2 and in special cases. The sector-specific Union-law definitions referenced by the statute apply.",
      "nis2.question.bc.activity.option.energy_supply_networks":
        "We supply electricity or operate electricity networks",
      "nis2.question.bc.activity.option.energy_generation_storage_markets":
        "We generate or store electricity, aggregate electricity, operate electricity markets, provide balancing services or operate EV charging infrastructure",
      "nis2.question.bc.activity.option.energy_district_heating_cooling":
        "We operate district heating or cooling",
      "nis2.question.bc.activity.option.energy_oil":
        "We produce, refine, store or transport oil or petroleum products",
      "nis2.question.bc.activity.option.energy_gas_lng":
        "We supply, produce, process, store or transport natural gas or operate gas or LNG infrastructure",
      "nis2.question.bc.activity.option.energy_hydrogen":
        "We produce, store or transport hydrogen",
      "nis2.question.bc.activity.option.energy_none": "None of these",
      "nis2.question.bc.activity.option.energy_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.transport_air":
        "We operate commercial air transport, an airport or air-traffic or air-navigation services",
      "nis2.question.bc.activity.option.transport_rail":
        "We operate railway infrastructure, railway services or railway service facilities",
      "nis2.question.bc.activity.option.transport_water":
        "We transport passengers or freight by water or operate ports or port infrastructure",
      "nis2.question.bc.activity.option.transport_road_its":
        "We operate road-traffic management or intelligent transport systems",
      "nis2.question.bc.activity.option.transport_postal_courier":
        "We provide postal or courier services",
      "nis2.question.bc.activity.option.transport_road_hitch":
        "We only provide ordinary road haulage, freight forwarding or logistics",
      "nis2.question.bc.activity.option.transport_none": "None of these",
      "nis2.question.bc.activity.option.transport_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.banking_credit_institution":
        "We are a credit institution / bank",
      "nis2.question.bc.activity.option.banking_trading_venue":
        "We operate a trading venue",
      "nis2.question.bc.activity.option.banking_central_counterparty":
        "We are a central counterparty (CCP)",
      "nis2.question.bc.activity.option.banking_other_financial":
        "We provide other financial services only",
      "nis2.question.bc.activity.option.banking_none": "None of these",
      "nis2.question.bc.activity.option.banking_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.health_patient_care":
        "We provide healthcare services to patients",
      "nis2.question.bc.activity.option.health_eu_reference_laboratory":
        "We operate an EU reference laboratory",
      "nis2.question.bc.activity.option.health_pharma_research":
        "We research or develop pharmaceutical products",
      "nis2.question.bc.activity.option.health_pharma_manufacture":
        "We manufacture pharmaceutical products",
      "nis2.question.bc.activity.option.health_critical_medical_devices":
        "We manufacture medical devices classified as critical during a public-health emergency",
      "nis2.question.bc.activity.option.health_other_medical_devices":
        "We manufacture other medical devices or in-vitro diagnostic devices",
      "nis2.question.bc.activity.option.health_none": "None of these",
      "nis2.question.bc.activity.option.health_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.water_drinking":
        "We supply drinking water",
      "nis2.question.bc.activity.option.water_wastewater":
        "We collect, treat or dispose of wastewater",
      "nis2.question.bc.activity.option.water_none": "None of these",
      "nis2.question.bc.activity.option.water_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.digital_ixp":
        "We operate an Internet Exchange Point (IXP)",
      "nis2.question.bc.activity.option.digital_cloud":
        "We provide cloud-computing services",
      "nis2.question.bc.activity.option.digital_data_centre":
        "We provide data-centre services",
      "nis2.question.bc.activity.option.digital_cdn":
        "We operate a Content Delivery Network (CDN)",
      "nis2.question.bc.activity.option.digital_msp.helper":
        "Managed IT services: ongoing management or operation of customers' ICT systems. One-off consulting or software development alone does not count for this option.",
      "nis2.question.bc.activity.option.digital_msp":
        "We continuously manage or operate customers' IT systems",
      "nis2.question.bc.activity.option.digital_mssp.helper":
        "Managed security services: ongoing management or operation of customers' cybersecurity services. One-off consulting or software development alone does not count for this option.",
      "nis2.question.bc.activity.option.digital_mssp":
        "We continuously manage or operate cybersecurity services for customers",
      "nis2.question.bc.activity.option.digital_dns": "We provide DNS services",
      "nis2.question.bc.activity.option.digital_tld_registry":
        "We operate a top-level-domain registry",
      "nis2.question.bc.activity.option.digital_qualified_trust":
        "We provide qualified trust services",
      "nis2.question.bc.activity.option.digital_other_trust":
        "We provide other or non-qualified trust services",
      "nis2.question.bc.activity.option.digital_telecom":
        "We operate a public telecommunications network or provide publicly available telecommunications services",
      "nis2.question.bc.activity.option.digital_marketplace":
        "We operate an online marketplace",
      "nis2.question.bc.activity.option.digital_search_engine":
        "We operate an online search engine",
      "nis2.question.bc.activity.option.digital_social_network":
        "We operate a social-network platform",
      "nis2.question.bc.activity.option.digital_domain_registration":
        "We provide domain-name registration services",
      "nis2.question.bc.activity.option.digital_software_only":
        "We only develop software, provide IT consulting or operate our own internal IT",
      "nis2.question.bc.activity.option.digital_none": "None of these",
      "nis2.question.bc.activity.option.digital_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.space_ground_infrastructure":
        "We operate ground infrastructure supporting space-based services",
      "nis2.question.bc.activity.option.space_manufacture":
        "We manufacture satellites, spacecraft or related equipment",
      "nis2.question.bc.activity.option.space_none": "None of these",
      "nis2.question.bc.activity.option.space_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.waste_main_activity":
        "Waste management is one of our main business activities",
      "nis2.question.bc.activity.option.waste_own_only":
        "We only handle waste generated by our own organisation",
      "nis2.question.bc.activity.option.waste_none": "None of these",
      "nis2.question.bc.activity.option.waste_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.chemicals_manufacture_import.definition":
        "This category covers manufacturers or importers of chemical substances or mixtures that are subject to registration under the REACH Regulation and fall under NACE division 20.",
      "nis2.question.bc.activity.option.chemicals_manufacture_import":
        "We manufacture or import covered chemical substances or mixtures under the relevant REACH or chemical-manufacturing category",
      "nis2.question.bc.activity.option.chemicals_use_only":
        "We only use chemical products purchased from other companies",
      "nis2.question.bc.activity.option.chemicals_none": "None of these",
      "nis2.question.bc.activity.option.chemicals_unsure":
        "I'm not sure whether our chemicals activity meets this definition",
      "nis2.question.bc.activity.option.food_wholesale":
        "We wholesale food products",
      "nis2.question.bc.activity.option.food_industrial":
        "We industrially produce or process food products",
      "nis2.question.bc.activity.option.food_retail_only":
        "We only operate retail, restaurants or catering",
      "nis2.question.bc.activity.option.food_none": "None of these",
      "nis2.question.bc.activity.option.food_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.manufacturing_medical_devices":
        "We manufacture medical devices or in-vitro diagnostic devices",
      "nis2.question.bc.activity.option.manufacturing_computers":
        "We manufacture computers, electronic or optical products",
      "nis2.question.bc.activity.option.manufacturing_electrical":
        "We manufacture electrical equipment",
      "nis2.question.bc.activity.option.manufacturing_machinery":
        "We manufacture machinery",
      "nis2.question.bc.activity.option.manufacturing_vehicles":
        "We manufacture motor vehicles or motor-vehicle parts",
      "nis2.question.bc.activity.option.manufacturing_other_transport":
        "We manufacture other transport equipment",
      "nis2.question.bc.activity.option.manufacturing_other_only":
        "We manufacture other products only",
      "nis2.question.bc.activity.option.manufacturing_none": "None of these",
      "nis2.question.bc.activity.option.manufacturing_unsure": "I'm not sure",
      "nis2.question.bc.activity.option.research_applied_commercial":
        "Our primary purpose is applied research or experimental development intended for commercial exploitation",
      "nis2.question.bc.activity.option.research_education_only":
        "We are primarily an educational institution",
      "nis2.question.bc.activity.option.research_none": "None of these",
      "nis2.question.bc.activity.option.research_unsure": "I'm not sure",
      "nis2.question.bc.employee_count.text":
        "How many employees does the relevant enterprise have?",
      "nis2.question.bc.employee_count.help":
        "Select the applicable range. Exact figures are not required.",
      "nis2.question.bc.employee_count.tooltip":
        "This means the employee count relevant for determining company size. Depending on the company structure, linked enterprises or partner enterprises may also need to be taken into account. Select “Unsure” if you do not know the exact figure.",
      "nis2.question.bc.employee_count.option.under_50": "Fewer than 50",
      "nis2.question.bc.employee_count.option.50_249": "50–249",
      "nis2.question.bc.employee_count.option.250_plus": "250 or more",
      "nis2.question.bc.employee_count.option.unsure": "Unsure",
      "nis2.question.bc.annual_revenue.text":
        "What is the relevant annual turnover?",
      "nis2.question.bc.annual_revenue.help":
        "Select the applicable range. Exact figures are not required.",
      "nis2.question.bc.annual_revenue.tooltip":
        "This means the annual turnover taken into account when determining company size. For linked enterprises or partner enterprises, additional turnover may need to be included in full or in part.",
      "nis2.question.bc.annual_revenue.option.revenue_at_most_10m":
        "EUR 10 million or less",
      "nis2.question.bc.annual_revenue.option.revenue_over_10m_to_50m":
        "More than EUR 10 million and up to EUR 50 million",
      "nis2.question.bc.annual_revenue.option.revenue_over_50m":
        "More than EUR 50 million",
      "nis2.question.bc.annual_revenue.option.unsure": "Unsure",
      "nis2.question.bc.balance_sheet_total.text":
        "What is the relevant annual balance-sheet total?",
      "nis2.question.bc.balance_sheet_total.help":
        "Select the applicable range. Exact figures are not required.",
      "nis2.question.bc.balance_sheet_total.tooltip":
        "The annual balance-sheet total can be found in the balance sheet for the most recently completed financial year. For linked enterprises or partner enterprises, additional figures may need to be taken into account in full or in part.",
      "nis2.question.bc.balance_sheet_total.option.balance_at_most_10m":
        "EUR 10 million or less",
      "nis2.question.bc.balance_sheet_total.option.balance_over_10m_to_43m":
        "More than EUR 10 million and up to EUR 43 million",
      "nis2.question.bc.balance_sheet_total.option.balance_over_43m":
        "More than EUR 43 million",
      "nis2.question.bc.balance_sheet_total.option.unsure": "Unsure",
      "nis2.question.bc.aggregation.text":
        "Do the size ranges above already take relevant partner and linked companies into account?",
      "nis2.question.bc.aggregation.help":
        "Mere membership of a corporate group does not determine NIS2 applicability. What matters is that the employee count and financial figures were calculated correctly, including the aggregation rules.",
      "nis2.question.bc.aggregation.tooltip":
        "If your organization belongs to a corporate group or has holdings in other companies, their employee counts, turnover and balance-sheet totals may need to be included in full or in part. The German IT-independence exception may, in narrowly defined cases, exclude individual linked enterprises.",
      "nis2.question.bc.aggregation.option.verified_de_without_it_exception":
        "Yes",
      "nis2.question.bc.aggregation.option.not_applicable_no_partner_or_linked_enterprises":
        "We have no relevant partner or linked companies",
      "nis2.question.bc.aggregation.option.verified_de_with_it_exception":
        "Yes, taking the BSIG IT-independence exception into account",
      "nis2.question.bc.aggregation.option.no": "No",
      "nis2.question.bc.aggregation.option.unsure": "I'm not sure",
      "nis2.legal.eu_nis2.article_2.citation":
        "Directive (EU) 2022/2555, Article 2",
      "nis2.legal.eu_nis2.article_2_4.citation":
        "Directive (EU) 2022/2555, Article 2(4)",
      "nis2.legal.eu_nis2.article_3.citation":
        "Directive (EU) 2022/2555, Article 3",
      "nis2.legal.eu_nis2.article_4.citation":
        "Directive (EU) 2022/2555, Article 4",
      "nis2.legal.eu_nis2.article_26.citation":
        "Directive (EU) 2022/2555, Article 26",
      "nis2.legal.eu_nis2.article_28.citation":
        "Directive (EU) 2022/2555, Article 28",
      "nis2.legal.eu_nis2.annex_i_1_a.citation":
        "Directive (EU) 2022/2555, Annex I, 1(a)",
      "nis2.legal.eu_nis2.annex_i_1_b.citation":
        "Directive (EU) 2022/2555, Annex I, 1(b)",
      "nis2.legal.eu_nis2.annex_i_1_c.citation":
        "Directive (EU) 2022/2555, Annex I, 1(c)",
      "nis2.legal.eu_nis2.annex_i_1_d.citation":
        "Directive (EU) 2022/2555, Annex I, 1(d)",
      "nis2.legal.eu_nis2.annex_i_1_e.citation":
        "Directive (EU) 2022/2555, Annex I, 1(e)",
      "nis2.legal.eu_nis2.annex_i_2_a.citation":
        "Directive (EU) 2022/2555, Annex I, 2(a)",
      "nis2.legal.eu_nis2.annex_i_2_b.citation":
        "Directive (EU) 2022/2555, Annex I, 2(b)",
      "nis2.legal.eu_nis2.annex_i_2_c.citation":
        "Directive (EU) 2022/2555, Annex I, 2(c)",
      "nis2.legal.eu_nis2.annex_i_2_d.citation":
        "Directive (EU) 2022/2555, Annex I, 2(d)",
      "nis2.legal.eu_nis2.annex_i_3.citation":
        "Directive (EU) 2022/2555, Annex I, 3",
      "nis2.legal.eu_nis2.annex_i_4.citation":
        "Directive (EU) 2022/2555, Annex I, 4",
      "nis2.legal.eu_nis2.annex_i_5.citation":
        "Directive (EU) 2022/2555, Annex I, 5",
      "nis2.legal.eu_nis2.annex_i_6.citation":
        "Directive (EU) 2022/2555, Annex I, 6",
      "nis2.legal.eu_nis2.annex_i_7.citation":
        "Directive (EU) 2022/2555, Annex I, 7",
      "nis2.legal.eu_nis2.annex_i_8.citation":
        "Directive (EU) 2022/2555, Annex I, 8",
      "nis2.legal.eu_nis2.annex_i_9.citation":
        "Directive (EU) 2022/2555, Annex I, 9",
      "nis2.legal.eu_nis2.annex_i_10.citation":
        "Directive (EU) 2022/2555, Annex I, 10",
      "nis2.legal.eu_nis2.annex_i_11.citation":
        "Directive (EU) 2022/2555, Annex I, 11",
      "nis2.legal.eu_nis2.annex_ii_1.citation":
        "Directive (EU) 2022/2555, Annex II, 1",
      "nis2.legal.eu_nis2.annex_ii_2.citation":
        "Directive (EU) 2022/2555, Annex II, 2",
      "nis2.legal.eu_nis2.annex_ii_3.citation":
        "Directive (EU) 2022/2555, Annex II, 3",
      "nis2.legal.eu_nis2.annex_ii_4.citation":
        "Directive (EU) 2022/2555, Annex II, 4",
      "nis2.legal.eu_nis2.annex_ii_5_a.citation":
        "Directive (EU) 2022/2555, Annex II, 5(a)",
      "nis2.legal.eu_nis2.annex_ii_5_b.citation":
        "Directive (EU) 2022/2555, Annex II, 5(b)",
      "nis2.legal.eu_nis2.annex_ii_5_c.citation":
        "Directive (EU) 2022/2555, Annex II, 5(c)",
      "nis2.legal.eu_nis2.annex_ii_5_d.citation":
        "Directive (EU) 2022/2555, Annex II, 5(d)",
      "nis2.legal.eu_nis2.annex_ii_5_e.citation":
        "Directive (EU) 2022/2555, Annex II, 5(e)",
      "nis2.legal.eu_nis2.annex_ii_5_f.citation":
        "Directive (EU) 2022/2555, Annex II, 5(f)",
      "nis2.legal.eu_nis2.annex_ii_6.citation":
        "Directive (EU) 2022/2555, Annex II, 6",
      "nis2.legal.eu_nis2.annex_ii_7.citation":
        "Directive (EU) 2022/2555, Annex II, 7",
      "nis2.legal.de_bsig.annex_1_1_1_1.citation": "Annex 1 point 1.1.1",
      "nis2.legal.de_bsig.annex_1_1_1_2.citation": "Annex 1 point 1.1.2",
      "nis2.legal.de_bsig.annex_1_1_1_3.citation": "Annex 1 point 1.1.3",
      "nis2.legal.de_bsig.annex_1_1_1_4.citation": "Annex 1 point 1.1.4",
      "nis2.legal.de_bsig.annex_1_1_1_5.citation": "Annex 1 point 1.1.5",
      "nis2.legal.de_bsig.annex_1_1_1_6.citation": "Annex 1 point 1.1.6",
      "nis2.legal.de_bsig.annex_1_1_1_7.citation": "Annex 1 point 1.1.7",
      "nis2.legal.de_bsig.annex_1_1_1_8.citation": "Annex 1 point 1.1.8",
      "nis2.legal.de_bsig.annex_1_1_1_9.citation": "Annex 1 point 1.1.9",
      "nis2.legal.de_bsig.annex_1_1_2_1.citation": "Annex 1 point 1.2.1",
      "nis2.legal.de_bsig.annex_1_1_3_1.citation": "Annex 1 point 1.3.1",
      "nis2.legal.de_bsig.annex_1_1_3_2.citation": "Annex 1 point 1.3.2",
      "nis2.legal.de_bsig.annex_1_1_3_3.citation": "Annex 1 point 1.3.3",
      "nis2.legal.de_bsig.annex_1_1_4_1.citation": "Annex 1 point 1.4.1",
      "nis2.legal.de_bsig.annex_1_1_4_2.citation": "Annex 1 point 1.4.2",
      "nis2.legal.de_bsig.annex_1_1_4_3.citation": "Annex 1 point 1.4.3",
      "nis2.legal.de_bsig.annex_1_1_4_4.citation": "Annex 1 point 1.4.4",
      "nis2.legal.de_bsig.annex_1_1_4_5.citation": "Annex 1 point 1.4.5",
      "nis2.legal.de_bsig.annex_1_1_4_6.citation": "Annex 1 point 1.4.6",
      "nis2.legal.de_bsig.annex_1_1_4_7.citation": "Annex 1 point 1.4.7",
      "nis2.legal.de_bsig.annex_1_1_4_8.citation": "Annex 1 point 1.4.8",
      "nis2.legal.de_bsig.annex_1_2_1_1.citation": "Annex 1 point 2.1.1",
      "nis2.legal.de_bsig.annex_1_2_1_2.citation": "Annex 1 point 2.1.2",
      "nis2.legal.de_bsig.annex_1_2_1_3.citation": "Annex 1 point 2.1.3",
      "nis2.legal.de_bsig.annex_1_2_2_1.citation": "Annex 1 point 2.2.1",
      "nis2.legal.de_bsig.annex_1_2_2_2.citation": "Annex 1 point 2.2.2",
      "nis2.legal.de_bsig.annex_1_2_3_1.citation": "Annex 1 point 2.3.1",
      "nis2.legal.de_bsig.annex_1_2_3_2.citation": "Annex 1 point 2.3.2",
      "nis2.legal.de_bsig.annex_1_2_3_3.citation": "Annex 1 point 2.3.3",
      "nis2.legal.de_bsig.annex_1_2_4_1.citation": "Annex 1 point 2.4.1",
      "nis2.legal.de_bsig.annex_1_2_4_2.citation": "Annex 1 point 2.4.2",
      "nis2.legal.de_bsig.annex_1_3_1_1.citation": "Annex 1 point 3.1.1",
      "nis2.legal.de_bsig.annex_1_3_2_1.citation": "Annex 1 point 3.2.1",
      "nis2.legal.de_bsig.annex_1_3_2_2.citation": "Annex 1 point 3.2.2",
      "nis2.legal.de_bsig.annex_1_4_1_1.citation": "Annex 1 point 4.1.1",
      "nis2.legal.de_bsig.annex_1_4_1_2.citation": "Annex 1 point 4.1.2",
      "nis2.legal.de_bsig.annex_1_4_1_3.citation": "Annex 1 point 4.1.3",
      "nis2.legal.de_bsig.annex_1_4_1_4.citation": "Annex 1 point 4.1.4",
      "nis2.legal.de_bsig.annex_1_4_1_5.citation": "Annex 1 point 4.1.5",
      "nis2.legal.de_bsig.annex_1_5_1_1.citation": "Annex 1 point 5.1.1",
      "nis2.legal.de_bsig.annex_1_5_2_1.citation": "Annex 1 point 5.2.1",
      "nis2.legal.de_bsig.annex_1_6_1_1.citation": "Annex 1 point 6.1.1",
      "nis2.legal.de_bsig.annex_1_6_1_2.citation": "Annex 1 point 6.1.2",
      "nis2.legal.de_bsig.annex_1_6_1_3.citation": "Annex 1 point 6.1.3",
      "nis2.legal.de_bsig.annex_1_6_1_4.citation": "Annex 1 point 6.1.4",
      "nis2.legal.de_bsig.annex_1_6_1_5.citation": "Annex 1 point 6.1.5",
      "nis2.legal.de_bsig.annex_1_6_1_6.citation": "Annex 1 point 6.1.6",
      "nis2.legal.de_bsig.annex_1_6_1_7.citation": "Annex 1 point 6.1.7",
      "nis2.legal.de_bsig.annex_1_6_1_8.citation": "Annex 1 point 6.1.8",
      "nis2.legal.de_bsig.annex_1_6_1_9.citation": "Annex 1 point 6.1.9",
      "nis2.legal.de_bsig.annex_1_6_1_10.citation": "Annex 1 point 6.1.10",
      "nis2.legal.de_bsig.annex_1_6_1_11.citation": "Annex 1 point 6.1.11",
      "nis2.legal.de_bsig.annex_1_7_1_1.citation": "Annex 1 point 7.1.1",
      "nis2.legal.de_bsig.annex_2_1_1_1.citation": "Annex 2 point 1.1.1",
      "nis2.legal.de_bsig.annex_2_2_1_1.citation": "Annex 2 point 2.1.1",
      "nis2.legal.de_bsig.annex_2_3_1_1.citation": "Annex 2 point 3.1.1",
      "nis2.legal.de_bsig.annex_2_4_1_1.citation": "Annex 2 point 4.1.1",
      "nis2.legal.de_bsig.annex_2_5_1_1.citation": "Annex 2 point 5.1.1",
      "nis2.legal.de_bsig.annex_2_5_2_1.citation": "Annex 2 point 5.2.1",
      "nis2.legal.de_bsig.annex_2_5_3_1.citation": "Annex 2 point 5.3.1",
      "nis2.legal.de_bsig.annex_2_5_4_1.citation": "Annex 2 point 5.4.1",
      "nis2.legal.de_bsig.annex_2_5_5_1.citation": "Annex 2 point 5.5.1",
      "nis2.legal.de_bsig.annex_2_5_6_1.citation": "Annex 2 point 5.6.1",
      "nis2.legal.de_bsig.annex_2_6_1_1.citation": "Annex 2 point 6.1.1",
      "nis2.legal.de_bsig.annex_2_6_1_2.citation": "Annex 2 point 6.1.2",
      "nis2.legal.de_bsig.annex_2_6_1_3.citation": "Annex 2 point 6.1.3",
      "nis2.legal.de_bsig.annex_2_7_1_1.citation": "Annex 2 point 7.1.1",
      "nis2.legal.de_enwg.title": "German Energy Industry Act",
      "nis2.legal.de_enwg.section_3.citation": "Section 3",
      "nis2.legal.de_lsv.title": "German Charging Station Regulation",
      "nis2.legal.de_lsv.section_2.citation": "Section 2",
      "nis2.legal.de_geg.title": "German Buildings Energy Act",
      "nis2.legal.de_geg.section_3.citation": "Section 3",
      "nis2.legal.de_aeg.title": "German General Railway Act",
      "nis2.legal.de_aeg.section_2.citation": "Section 2",
      "nis2.legal.de_wastrg.title": "German Federal Waterways Act",
      "nis2.legal.de_wastrg.section_1_6_1.citation": "Section 1(6)(1)",
      "nis2.legal.de_fstrg.title": "German Federal Trunk Roads Act",
      "nis2.legal.de_fstrg.section_1.citation": "Section 1",
      "nis2.legal.de_ivsg.title": "German Intelligent Transport Systems Act",
      "nis2.legal.de_ivsg.section_2_1.citation": "Section 2(1)",
      "nis2.legal.de_wphg.title": "German Securities Trading Act",
      "nis2.legal.de_wphg.section_2_22.citation": "Section 2(22)",
      "nis2.legal.de_amg.title": "German Medicinal Products Act",
      "nis2.legal.de_amg.section_2.citation": "Section 2",
      "nis2.legal.de_trinkwv.title": "German Drinking Water Ordinance",
      "nis2.legal.de_trinkwv.section_2_3.citation": "Section 2(3)",
      "nis2.legal.de_whg.title": "German Federal Water Act",
      "nis2.legal.de_whg.section_54_1.citation": "Section 54(1)",
      "nis2.legal.de_postg.title": "German Postal Act",
      "nis2.legal.de_postg.section_3_15.citation": "Section 3(15)",
      "nis2.legal.de_krwg.title": "German Circular Economy Act",
      "nis2.legal.de_krwg.section_3_14.citation": "Section 3(14)",
      "nis2.legal.eu_reg_2019_943.title": "Regulation (EU) 2019/943",
      "nis2.legal.eu_reg_2019_943.article_2_8.citation": "Article 2(8)",
      "nis2.legal.eu_dir_2009_119.title": "Directive 2009/119/EC",
      "nis2.legal.eu_dir_2009_119.article_2_f.citation": "Article 2(f)",
      "nis2.legal.eu_reg_300_2008.title": "Regulation (EC) No 300/2008",
      "nis2.legal.eu_reg_300_2008.article_3_4.citation": "Article 3(4)",
      "nis2.legal.eu_reg_2017_373.title":
        "Implementing Regulation (EU) 2017/373",
      "nis2.legal.eu_reg_2017_373.article_2_2.citation": "Article 2(2)",
      "nis2.legal.eu_dir_2011_24.title": "Directive 2011/24/EU",
      "nis2.legal.eu_dir_2011_24.article_3_g.citation": "Article 3(g)",
      "nis2.legal.eu_reg_2022_2371.title": "Regulation (EU) 2022/2371",
      "nis2.legal.eu_reg_2022_2371.article_15.citation": "Article 15",
      "nis2.legal.eu_reg_2022_123.title": "Regulation (EU) 2022/123",
      "nis2.legal.eu_reg_2022_123.article_22.citation": "Article 22",
      "nis2.legal.eu_nace_rev_2.title":
        "Regulation (EC) No 1893/2006 (NACE Rev. 2)",
      "nis2.legal.eu_nace_rev_2.division_20.citation": "Annex I, division 20",
      "nis2.legal.eu_nace_rev_2.division_21.citation": "Annex I, division 21",
      "nis2.legal.eu_nace_rev_2.division_26.citation": "Annex I, division 26",
      "nis2.legal.eu_nace_rev_2.division_27.citation": "Annex I, division 27",
      "nis2.legal.eu_nace_rev_2.division_28.citation": "Annex I, division 28",
      "nis2.legal.eu_nace_rev_2.division_29.citation": "Annex I, division 29",
      "nis2.legal.eu_nace_rev_2.division_30.citation": "Annex I, division 30",
      "nis2.legal.eu_reach.title": "Regulation (EC) No 1907/2006 (REACH)",
      "nis2.legal.eu_reach.article_3_9.citation": "Article 3(9)",
      "nis2.legal.eu_reach.article_3_11.citation": "Article 3(11)",
      "nis2.legal.eu_reach.article_6.citation": "Article 6",
      "nis2.legal.eu_reg_178_2002.title": "Regulation (EC) No 178/2002",
      "nis2.legal.eu_reg_178_2002.article_3_2.citation": "Article 3(2)",
      "nis2.legal.eu_reg_2017_745.title": "Regulation (EU) 2017/745",
      "nis2.legal.eu_reg_2017_745.article_2_30.citation": "Article 2(30)",
      "nis2.legal.eu_reg_2017_746.title": "Regulation (EU) 2017/746",
      "nis2.legal.eu_reg_2017_746.article_2_23.citation": "Article 2(23)",
      "nis2.legal.eu_nis2.title": "NIS2 Directive",
      "nis2.legal.eu_sme.title": "EU SME Recommendation",
      "nis2.legal.eu_sme_recommendation.annex_article_2.citation":
        "Annex, Article 2",
      "nis2.legal.eu_cer.title": "CER Directive",
      "nis2.legal.eu_cer.article_6.citation": "Article 6",
      "nis2.legal.de_bsig.title": "German BSI Act",
      "nis2.legal.de_bsig.section_28.citation": "Section 28",
      "nis2.legal.de_bsig.section_28_1_1.citation": "Section 28(1)(1)",
      "nis2.legal.de_bsig.section_28_5.citation": "Section 28(5)",
      "nis2.legal.de_bsig.section_28_6.citation": "Section 28(6)",
      "nis2.legal.de_bsig.section_2.citation": "Section 2",
      "nis2.legal.de_bsig.section_29.citation": "Section 29",
      "nis2.legal.de_bsig.section_34.citation": "Section 34",
      "nis2.legal.de_bsig.section_59.citation": "Section 59",
      "nis2.legal.de_bsig.section_60.citation": "Section 60",
      "nis2.legal.de_bsig.section_66.citation": "Section 66",
      "nis2.legal.de_bsig.annex_1.citation": "Annex 1",
      "nis2.legal.de_bsig.annex_2.citation": "Annex 2",
      "nis2.legal.de_bsi_kritisv.title":
        "German BSI Critical Infrastructure Regulation",
      "nis2.legal.de_bsi_kritisv.section_12.citation": "Section 12",
      "nis2.legal.de_kritisdachg.title":
        "German Critical Infrastructure Umbrella Act",
      "nis2.legal.de_kritisdachg.section_4.citation": "Section 4",
      "nis2.legal.de_kritisdachg.section_5.citation": "Section 5",
      "nis2.outcome.essential_entity.label": "Essential entity",
      "nis2.outcome.important_entity.label": "Important entity",
      "nis2.outcome.not_directly_in_scope.label": "Not directly in scope",
      "nis2.outcome.clarification_required.label": "Clarification required",
      "nis2.reason.outside_eu_activity": "No relevant activity in the EU.",
      "nis2.reason.annex_i_large":
        "Annex I activity above the medium-enterprise ceiling.",
      "nis2.reason.annex_i_medium":
        "Annex I activity with medium enterprise size.",
      "nis2.reason.annex_ii_medium_or_large":
        "Annex II activity with medium or large enterprise size.",
      "nis2.reason.below_size_cap":
        "Covered activity below the general size threshold.",
      "nis2.reason.size_independent_essential":
        "Essential entity irrespective of size.",
      "nis2.reason.size_independent_important":
        "Important entity irrespective of size.",
      "nis2.reason.telecom_medium_or_large":
        "Medium or large telecommunications provider.",
      "nis2.reason.telecom_small":
        "Telecommunications provider below medium size.",
      "nis2.reason.de_size_independent_particularly_important":
        "Particularly important entity under the German BSI Act irrespective of size.",
      "nis2.reason.de_size_independent_important":
        "Important entity under the German BSI Act irrespective of size.",
      "nis2.reason.de_telecom_medium_or_large":
        "German telecommunications provider at or above the medium-size threshold.",
      "nis2.reason.de_telecom_small":
        "German telecommunications provider below the medium-size threshold.",
      "nis2.reason.de_annex_1_large":
        "German Annex-1 identity above the particularly-important-entity threshold.",
      "nis2.reason.de_annex_1_medium":
        "German Annex-1 identity with medium enterprise size.",
      "nis2.reason.de_annex_2_medium_or_large":
        "German Annex-2 identity with medium or large enterprise size.",
      "nis2.reason.de_below_size_cap":
        "German Annex identity below the general size threshold.",
      "nis2.reason.member_state_essential_designation":
        "Classified by an authority as an essential entity.",
      "nis2.reason.member_state_important_designation":
        "Classified by an authority as an important entity.",
      "nis2.reason.cer_critical_designation":
        "Designated as a critical entity under CER.",
      "nis2.reason.de_critical_installation":
        "Operator of a critical installation under the German BSI Act.",
      "nis2.reason.no_covered_entity_type": "No covered entity type reported.",
      "nis2.reason.domain_registration_obligations":
        "Specific duties for domain-name registration services.",
      "nis2.reason.dora_lex_specialis":
        "DORA may prevail as a sector-specific act.",
      "nis2.reason.de_telecom_energy_overlay":
        "German sector rules may replace individual duties.",
      "nis2.reason.other_sector_specific_regime":
        "Another sector-specific regime must be considered.",
      "nis2.reason.sector_specific_regime_unknown":
        "The sector-specific regime is unclear.",
      "nis2.reason.unresolved_eu_activity":
        "It is unclear whether relevant activities are provided in the EU.",
      "nis2.reason.unresolved_country":
        "The competent Member State is unclear.",
      "nis2.reason.unresolved_jurisdiction_basis":
        "The basis for EU jurisdiction is unclear.",
      "nis2.reason.unresolved_entity_type": "The exact entity type is unclear.",
      "nis2.reason.unresolved_regional_administration":
        "The national risk classification for regional administration must be checked.",
      "nis2.reason.unresolved_designation":
        "An authority or CER designation must be checked.",
      "nis2.reason.unresolved_german_designation_country":
        "The German classification does not match the selected Member State.",
      "nis2.reason.unresolved_size":
        "The legally relevant enterprise size is unclear.",
      "nis2.reason.unresolved_size_aggregation":
        "The German size and aggregation rules were not confirmed reliably.",
      "nis2.reason.unresolved_profile_jurisdiction":
        "The selected German jurisdiction basis does not apply to every selected entity identity.",
      "nis2.reason.unresolved_unsupported_profile":
        "No supported national profile exists for this Member State.",
      "nis2.reason.unresolved_domain_registration_classification":
        "The additional national classification of the registration service must be checked.",
      "nis2.reason.unresolved_negative_profile_required":
        "A negative conclusion requires a supported national profile.",
      "nis2.reason.indirect_serves_regulated_customers":
        "The organization serves customers in NIS2-relevant sectors.",
      "nis2.reason.indirect_security_evidence_requests":
        "Customers request information-security evidence.",
      "nis2.reason.indirect_unknown":
        "Indirect supply-chain exposure is unclear.",
      "nis2.result.disclaimer":
        "This automated classification is a traceable preliminary assessment and does not replace legal advice or an authority decision.",
      "nis2.framework.name": "NIS2",
      "nis2.framework.description":
        "Framework for assessing NIS2 applicability.",
      "nis2.module.betroffenheitscheck.name": "Applicability check",
      "nis2.questionnaire.betroffenheitscheck.title":
        "NIS2 applicability check",
      "nis2.legal.de_bsig.section_30_1.citation":
        "German BSI Act, Section 30(1)",
      "nis2.legal.de_bsig.section_30_2.citation":
        "German BSI Act, Section 30(2)",
      "nis2.legal.de_bsig.section_30_2_1.citation":
        "German BSI Act, Section 30(2) point 1",
      "nis2.legal.de_bsig.section_30_2_2.citation":
        "German BSI Act, Section 30(2) point 2",
      "nis2.legal.de_bsig.section_30_2_3.citation":
        "German BSI Act, Section 30(2) point 3",
      "nis2.legal.de_bsig.section_30_2_4.citation":
        "German BSI Act, Section 30(2) point 4",
      "nis2.legal.de_bsig.section_30_2_5.citation":
        "German BSI Act, Section 30(2) point 5",
      "nis2.legal.de_bsig.section_30_2_6.citation":
        "German BSI Act, Section 30(2) point 6",
      "nis2.legal.de_bsig.section_30_2_7.citation":
        "German BSI Act, Section 30(2) point 7",
      "nis2.legal.de_bsig.section_30_2_8.citation":
        "German BSI Act, Section 30(2) point 8",
      "nis2.legal.de_bsig.section_30_2_9.citation":
        "German BSI Act, Section 30(2) point 9",
      "nis2.legal.de_bsig.section_30_2_10.citation":
        "German BSI Act, Section 30(2) point 10",
      "nis2.legal.de_bsig.section_32.citation": "German BSI Act, Section 32",
      "nis2.legal.de_bsig.section_38_1.citation":
        "German BSI Act, Section 38(1)",
      "nis2.legal.de_bsig.section_38_3.citation":
        "German BSI Act, Section 38(3)",
      "nis2.legal.eu_nis2.article_20_1.citation":
        "Directive (EU) 2022/2555, Article 20(1)",
      "nis2.legal.eu_nis2.article_20_2.citation":
        "Directive (EU) 2022/2555, Article 20(2)",
      "nis2.legal.eu_nis2.article_21_1.citation":
        "Directive (EU) 2022/2555, Article 21(1)",
      "nis2.legal.eu_nis2.article_21_2.citation":
        "Directive (EU) 2022/2555, Article 21(2)",
      "nis2.legal.eu_nis2.article_21_2_a.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (a)",
      "nis2.legal.eu_nis2.article_21_2_b.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (b)",
      "nis2.legal.eu_nis2.article_21_2_c.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (c)",
      "nis2.legal.eu_nis2.article_21_2_d.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (d)",
      "nis2.legal.eu_nis2.article_21_2_e.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (e)",
      "nis2.legal.eu_nis2.article_21_2_f.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (f)",
      "nis2.legal.eu_nis2.article_21_2_g.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (g)",
      "nis2.legal.eu_nis2.article_21_2_h.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (h)",
      "nis2.legal.eu_nis2.article_21_2_i.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (i)",
      "nis2.legal.eu_nis2.article_21_2_j.citation":
        "Directive (EU) 2022/2555, Article 21(2) point (j)",
      "nis2.legal.eu_nis2.article_21_3.citation":
        "Directive (EU) 2022/2555, Article 21(3)",
      "nis2.legal.eu_nis2.article_21_4.citation":
        "Directive (EU) 2022/2555, Article 21(4)",
      "nis2.legal.eu_nis2.article_23.citation":
        "Directive (EU) 2022/2555, Article 23",
    },
  },
});

type Nis2ReleaseMessageKey = keyof typeof nis2ReleaseMessages.de.nis2Release;

export function hasNis2ReleaseMessage(
  key: string,
): key is Nis2ReleaseMessageKey {
  return (
    key in nis2ReleaseMessages.de.nis2Release &&
    key in nis2ReleaseMessages.en.nis2Release
  );
}

export function getNis2ReleaseMessage(
  locale: Locale,
  key: string,
): string | undefined {
  if (!hasNis2ReleaseMessage(key)) return undefined;
  return nis2ReleaseMessages[locale].nis2Release[key];
}

export function getNis2ReleaseMessageKeys(): Nis2ReleaseMessageKey[] {
  return Object.keys(
    nis2ReleaseMessages.de.nis2Release,
  ) as Nis2ReleaseMessageKey[];
}
