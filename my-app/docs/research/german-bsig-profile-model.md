# German BSIG profile model from official primary sources

Research snapshot: 2026-07-16  
Target: a versioned German national profile that maps the current BSIG model to the 70 EU/application entity codes  
Sources: current official `Gesetze im Internet`, EUR-Lex, and Federal Law Gazette-linked materials only

## Model conclusion

The German profile needs its own immutable entity-identity layer. [BSIG Anlage 1][bsig-a1] contains 53 numbered leaf identities and [Anlage 2][bsig-a2] contains 14, but those 67 identities are not the same partition as NIS2's 67 Annex-I/II rows. A shared application code may map to several German identities, one German identity may map to several application codes, and some identities only overlap conditionally.

The proposed stable codes below use the namespace `de_bsig_`. They identify German legal categories across releases; the exact wording, incorporated definition, effective dates, and mappings belong in immutable version rows.

Mapping markers:

- **exact** — the German row and application identity have the same operative boundary for this purpose;
- **aggregate/subset** — usable only with the additional fact stated later;
- **overlap** — not safe as an automatic positive or negative mapping;
- **none** — no German Annex identity exists.

## All 67 German Annex identities and application mappings

Every row locator below links to the official current BSIG Annex that owns the claim.

### Anlage 1 — 53 identities

| No. | Proposed stable German code | Official type and incorporated locator | Existing application code mapping |
| --- | --- | --- | --- |
| 1.1.1 | `de_bsig_electricity_supplier` | Stromlieferant, EnWG § 3 no. 31c ([A1 1.1.1][bsig-a1]) | `electricity_supplier` — exact |
| 1.1.2 | `de_bsig_electricity_distribution_operator` | Betreiber eines Elektrizitätsverteilernetzes, EnWG § 3 no. 3 ([A1 1.1.2][bsig-a1]) | `electricity_distribution_operator` — exact |
| 1.1.3 | `de_bsig_electricity_transmission_operator` | Betreiber eines Übertragungsnetzes, EnWG § 3 no. 10 ([A1 1.1.3][bsig-a1]) | `electricity_transmission_operator` — exact |
| 1.1.4 | `de_bsig_electricity_generation_installation_operator` | Betreiber einer Erzeugungsanlage, EnWG § 3 no. 18d ([A1 1.1.4][bsig-a1]) | `electricity_producer` — exact for the German profile |
| 1.1.5 | `de_bsig_nominated_electricity_market_operator` | Nominierter Strommarktbetreiber, Regulation 2019/943 Art. 2(8) ([A1 1.1.5][bsig-a1]) | `electricity_market_operator` — exact |
| 1.1.6 | `de_bsig_electricity_aggregator` | Aggregator, EnWG § 3 no. 1a ([A1 1.1.6][bsig-a1]) | `electricity_flexibility_provider` — aggregate/subset |
| 1.1.7 | `de_bsig_energy_storage_installation_operator` | Betreiber einer Energiespeicheranlage, EnWG § 3 no. 15d ([A1 1.1.7][bsig-a1]) | `electricity_flexibility_provider` — aggregate/subset |
| 1.1.8 | `de_bsig_balancing_service_provider` | Anbieter von Ausgleichsleistungen, EnWG § 3 no. 1b ([A1 1.1.8][bsig-a1]) | `electricity_flexibility_provider` — aggregate/subset |
| 1.1.9 | `de_bsig_recharging_point_operator` | Ladepunktbetreiber, LSV § 2 no. 8 ([A1 1.1.9][bsig-a1]) | `recharging_point_operator` — exact for Germany |
| 1.2.1 | `de_bsig_district_heating_cooling_operator` | Betreiber von Fernwärme-/Fernkälteversorgung, GEG § 3 nos. 19-20 ([A1 1.2.1][bsig-a1]) | `district_heating_cooling_operator` — exact |
| 1.3.1 | `de_bsig_oil_transmission_pipeline_operator` | Betreiber einer Erdöl-Fernleitung ([A1 1.3.1][bsig-a1]) | `oil_pipeline_operator` — exact; also overlaps 1.3.2 |
| 1.3.2 | `de_bsig_oil_facilities_operator` | Produktion, Raffination, Aufbereitung, Lagerung and Erdöl-Fernleitungen ([A1 1.3.2][bsig-a1]) | `oil_facility_operator` and `oil_pipeline_operator` — many-to-many/overlap |
| 1.3.3 | `de_bsig_central_oil_stockholding_entity` | Zentrale Bevorratungsstelle, Directive 2009/119/EC Art. 2(f) ([A1 1.3.3][bsig-a1]) | `central_oil_stockholding_entity` — exact |
| 1.4.1 | `de_bsig_gas_distribution_operator` | Gasverteilernetzbetreiber, EnWG § 3 no. 8 ([A1 1.4.1][bsig-a1]) | `gas_distribution_operator` — exact |
| 1.4.2 | `de_bsig_gas_transmission_operator` | Fernleitungsnetzbetreiber, EnWG § 3 no. 5 ([A1 1.4.2][bsig-a1]) | `gas_transmission_operator` — exact |
| 1.4.3 | `de_bsig_gas_storage_operator` | Gasspeicheranlagenbetreiber, EnWG § 3 no. 6 ([A1 1.4.3][bsig-a1]) | `gas_storage_operator` — exact |
| 1.4.4 | `de_bsig_lng_operator` | LNG-Anlagenbetreiber, EnWG § 3 no. 9 ([A1 1.4.4][bsig-a1]) | `lng_operator` — exact |
| 1.4.5 | `de_bsig_gas_supplier` | Gaslieferant, EnWG § 3 no. 19b ([A1 1.4.5][bsig-a1]) | `gas_supply_undertaking` — exact for Germany |
| 1.4.6 | `de_bsig_natural_gas_extraction_operator` | Betreiber einer Anlage zur Erdgasgewinnung ([A1 1.4.6][bsig-a1]) | `natural_gas_undertaking` — subset only; no exact current application identity |
| 1.4.7 | `de_bsig_natural_gas_refining_treatment_operator` | Betreiber einer Erdgasraffinerie/-aufbereitungsanlage ([A1 1.4.7][bsig-a1]) | `gas_refining_treatment_operator` — exact |
| 1.4.8 | `de_bsig_hydrogen_operator` | Betreiber in Wasserstofferzeugung, -speicherung or -fernleitung ([A1 1.4.8][bsig-a1]) | `hydrogen_operator` — exact aggregate |
| 2.1.1 | `de_bsig_commercial_air_carrier` | Gewerblich genutztes Luftfahrtunternehmen, Regulation 300/2008 Art. 3(4) ([A1 2.1.1][bsig-a1]) | `air_carrier` — exact |
| 2.1.2 | `de_bsig_airport_entity` | Flughafenleitungsorgan, Flughafen/core airport, or ancillary-installation operator ([A1 2.1.2][bsig-a1]) | `airport_operator` — exact aggregate |
| 2.1.3 | `de_bsig_atm_ans_provider` | ATM/ANS-Anbieter, Implementing Regulation 2017/373 Art. 2(2) ([A1 2.1.3][bsig-a1]) | `air_traffic_management_provider` — overlap; German row is broader than NIS2's ATC-only row |
| 2.2.1 | `de_bsig_rail_infrastructure_operator` | Eisenbahninfrastrukturbetreiber under AEG § 2(6), (6a), including named central dispatch facilities ([A1 2.2.1][bsig-a1]) | `rail_infrastructure_manager` — exact aggregate for Germany |
| 2.2.2 | `de_bsig_railway_undertaking` | Eisenbahnverkehrsunternehmen, including service-facility operator, AEG § 2(3), no. 9 ([A1 2.2.2][bsig-a1]) | `railway_undertaking` — exact aggregate |
| 2.3.1 | `de_bsig_water_transport_company` | Inland/sea/coastal passenger or freight company; individual vessels excluded ([A1 2.3.1][bsig-a1]) | `water_transport_company` — exact |
| 2.3.2 | `de_bsig_port_entity` | Port managing body, port facility, or operator of port works/equipment ([A1 2.3.2][bsig-a1]) | `port_operator` — exact aggregate |
| 2.3.3 | `de_bsig_waterway_safe_operation_system_operator` | Betreiber einer Anlage/eines Systems zum sicheren Betrieb einer Wasserstraße, WaStrG § 1(6) no. 1 ([A1 2.3.3][bsig-a1]) | `vessel_traffic_service` — overlap only; German-only remainder |
| 2.4.1 | `de_bsig_road_traffic_influence_system_operator` | Betreiber einer Anlage/eines Systems zur Verkehrsbeeinflussung, including listed FStrG infrastructure ([A1 2.4.1][bsig-a1]) | `road_authority` — overlap only; not equivalent |
| 2.4.2 | `de_bsig_intelligent_transport_system_operator` | Betreiber eines intelligenten Verkehrssystems, IVSG § 2 no. 1 ([A1 2.4.2][bsig-a1]) | `intelligent_transport_system_operator` — exact for Germany |
| 3.1.1 | `de_bsig_credit_institution` | Deposit-taking and own-account lending institution ([A1 3.1.1][bsig-a1]) | `credit_institution` — exact |
| 3.2.1 | `de_bsig_trading_venue` | Handelsplatz, WpHG § 2(22) ([A1 3.2.1][bsig-a1]) | `trading_venue_operator` — exact for Germany |
| 3.2.2 | `de_bsig_central_counterparty` | Zentrale Gegenpartei as described in the row ([A1 3.2.2][bsig-a1]) | `central_counterparty` — exact |
| 4.1.1 | `de_bsig_healthcare_provider` | Gesundheitsdienstleister under Directive 2011/24/EU ([A1 4.1.1][bsig-a1]) | `healthcare_provider` — exact |
| 4.1.2 | `de_bsig_eu_reference_laboratory` | EU reference laboratory, Regulation 2022/2371 Art. 15 ([A1 4.1.2][bsig-a1]) | `eu_reference_laboratory` — exact |
| 4.1.3 | `de_bsig_medicinal_product_researcher` | R&D concerning medicinal products under AMG § 2 ([A1 4.1.3][bsig-a1]) | `medicinal_product_researcher` — exact for Germany |
| 4.1.4 | `de_bsig_pharmaceutical_manufacturer` | NACE Rev. 2 section C division 21 manufacturer ([A1 4.1.4][bsig-a1]) | `pharmaceutical_manufacturer` — exact |
| 4.1.5 | `de_bsig_emergency_critical_medical_device_manufacturer` | Device manufacturer on Regulation 2022/123 Art. 22 emergency critical list ([A1 4.1.5][bsig-a1]) | `critical_medical_device_manufacturer` — exact |
| 5.1.1 | `de_bsig_drinking_water_supply_operator` | Betreiber einer Wasserversorgungsanlage, TrinkwV § 2 no. 3; incidental commodity supply excluded ([A1 5.1.1][bsig-a1]) | `drinking_water_supplier` — exact for Germany |
| 5.2.1 | `de_bsig_waste_water_undertaking` | Sammlung/Entsorgung/Behandlung of WHG § 54(1) waste water; incidental activity excluded ([A1 5.2.1][bsig-a1]) | `waste_water_undertaking` — exact for Germany |
| 6.1.1 | `de_bsig_internet_exchange_point_operator` | Betreiber eines Internet Exchange Point ([A1 6.1.1][bsig-a1]); BSIG § 2 no. 20 | `internet_exchange_point` — exact |
| 6.1.2 | `de_bsig_dns_service_provider` | DNS-Diensteanbieter excluding root name servers ([A1 6.1.2][bsig-a1]); BSIG § 2 no. 8 | `dns_service_provider` — exact |
| 6.1.3 | `de_bsig_tld_registry` | Top Level Domain Name Registry ([A1 6.1.3][bsig-a1]) | `tld_registry` — exact |
| 6.1.4 | `de_bsig_cloud_service_provider` | Anbieter eines Cloud-Computing-Dienstes ([A1 6.1.4][bsig-a1]); BSIG § 2 no. 4 | `cloud_service_provider` — exact |
| 6.1.5 | `de_bsig_data_centre_service_provider` | Anbieter eines Rechenzentrumsdienstes ([A1 6.1.5][bsig-a1]); BSIG § 2 no. 35 | `data_centre_service_provider` — exact |
| 6.1.6 | `de_bsig_content_delivery_network_operator` | Betreiber eines Content Delivery Network ([A1 6.1.6][bsig-a1]); BSIG § 2 no. 5 | `content_delivery_network_provider` — exact for Germany |
| 6.1.7 | `de_bsig_trust_service_provider` | Vertrauensdiensteanbieter ([A1 6.1.7][bsig-a1]) | `qualified_trust_service_provider` **and** `other_trust_service_provider` — one-to-many; qualification fact required |
| 6.1.8 | `de_bsig_public_telecom_network_operator` | Betreiber eines öffentlichen Telekommunikationsnetzes ([A1 6.1.8][bsig-a1]) | `public_electronic_communications_network` — exact |
| 6.1.9 | `de_bsig_publicly_available_telecom_service_provider` | Anbieter öffentlich zugänglicher Telekommunikationsdienste ([A1 6.1.9][bsig-a1]) | `public_electronic_communications_service` — exact |
| 6.1.10 | `de_bsig_managed_service_provider` | Managed Services Provider ([A1 6.1.10][bsig-a1]); BSIG § 2 no. 26 | `managed_service_provider` — exact |
| 6.1.11 | `de_bsig_managed_security_service_provider` | Managed Security Services Provider ([A1 6.1.11][bsig-a1]); BSIG § 2 no. 25 | `managed_security_service_provider` — exact |
| 7.1.1 | `de_bsig_space_ground_infrastructure_operator` | Ground infrastructure supporting space services; public telecom networks excluded ([A1 7.1.1][bsig-a1]) | `space_ground_infrastructure_operator` — exact |

### Anlage 2 — 14 identities

| No. | Proposed stable German code | Official type and incorporated locator | Existing application code mapping |
| --- | --- | --- | --- |
| 1.1.1 | `de_bsig_postal_courier_provider` | Postdienstleister, PostG § 3 no. 15, including couriers ([A2 1.1.1][bsig-a2]) | `postal_courier_provider` — exact |
| 2.1.1 | `de_bsig_waste_management_undertaking` | Abfallbewirtschaftung, KrWG § 3(14); must be principal economic activity ([A2 2.1.1][bsig-a2]) | `waste_management_undertaking` — exact for Germany |
| 3.1.1 | `de_bsig_reach_registered_nace20_chemical_manufacturer_importer` | Manufacturer/importer under REACH Art. 3(9), (11), NACE division 20, subject to REACH Art. 6 registration ([A2 3.1.1][bsig-a2]) | `chemical_manufacturer_distributor` — partial only; importer is German-only and distributor-only is not covered; no mapping to `chemical_article_producer` |
| 4.1.1 | `de_bsig_food_wholesale_industrial_business` | Food business under Regulation 178/2002 Art. 3(2), wholesale or industrial production/processing ([A2 4.1.1][bsig-a2]) | `food_wholesale_industrial_business` — exact |
| 5.1.1 | `de_bsig_medical_ivd_device_manufacturer` | Medical-device/IVD manufacturer; emergency critical devices excluded ([A2 5.1.1][bsig-a2]) | `medical_device_manufacturer` — exact |
| 5.2.1 | `de_bsig_nace26_computer_electronic_optical_manufacturer` | NACE Rev. 2 section C division 26 activity ([A2 5.2.1][bsig-a2]) | `computer_electronic_optical_manufacturer` — exact |
| 5.3.1 | `de_bsig_nace27_electrical_equipment_manufacturer` | NACE Rev. 2 section C division 27 activity ([A2 5.3.1][bsig-a2]) | `electrical_equipment_manufacturer` — exact |
| 5.4.1 | `de_bsig_nace28_machinery_manufacturer` | NACE Rev. 2 section C division 28 activity ([A2 5.4.1][bsig-a2]) | `machinery_manufacturer` — exact |
| 5.5.1 | `de_bsig_nace29_motor_vehicle_manufacturer` | NACE Rev. 2 section C division 29 activity ([A2 5.5.1][bsig-a2]) | `motor_vehicle_manufacturer` — exact |
| 5.6.1 | `de_bsig_nace30_other_transport_equipment_manufacturer` | NACE Rev. 2 section C division 30 activity ([A2 5.6.1][bsig-a2]) | `other_transport_equipment_manufacturer` — exact |
| 6.1.1 | `de_bsig_online_marketplace_provider` | Anbieter eines Online-Marktplatzes ([A2 6.1.1][bsig-a2]); BSIG § 2 no. 28 | `online_marketplace_provider` — exact for Germany |
| 6.1.2 | `de_bsig_online_search_engine_provider` | Anbieter einer Online-Suchmaschine ([A2 6.1.2][bsig-a2]); BSIG § 2 no. 29 | `online_search_engine_provider` — exact |
| 6.1.3 | `de_bsig_social_networking_platform_provider` | Anbieter einer Plattform für soziale Netzwerkdienste ([A2 6.1.3][bsig-a2]); BSIG § 2 no. 30 | `social_networking_platform_provider` — exact |
| 7.1.1 | `de_bsig_research_organisation` | Applied/experimental research for commercial exploitation; education excluded ([A2 7.1.1][bsig-a2]); BSIG § 2 no. 12 | `research_organisation` — exact |

## Reverse mapping exceptions across all 70 application codes

The tables above cover every current application code except the following non-Annex/special cases. These must remain explicit rather than being forced into a German Annex row:

| Application code or branch | German treatment |
| --- | --- |
| `domain_name_registration_service` | No Anlage 1/2 identity. BSIG § 2 no. 9 defines `Domain-Name-Registry-Dienstleister`; §§ 34 and 60 impose registration/jurisdiction duties, but § 28 does not classify it as besonders wichtig/wichtig solely on that basis. [BSIG §§ 2, 34, 60][bsig-60] |
| `central_public_administration` | No Annex identity. A federal entity may instead be a § 29 `Einrichtung der Bundesverwaltung`, to which rules for besonders wichtige Einrichtungen generally apply. The application code is only an overlap until § 29(1)'s federal categories are established. [BSIG § 29][bsig-29] |
| `regional_public_administration` | No Annex identity and no complete federal-BSIG classification. It requires the relevant Land's NIS2 implementation and risk-based designation; the official BSIG only recognizes Land authorities for this purpose in § 2 no. 2(b). [BSIG § 2][bsig-2] |
| `chemical_article_producer` | No German Annex match. German A2 3.1.1 does not include the EU article-producer branch. |
| Distributor-only part of `chemical_manufacturer_distributor` | No German Annex match; German A2 3.1.1 instead includes a qualifying importer and imposes NACE-20 plus REACH-registration conditions. |
| `natural_gas_undertaking` | The broad EU identity has no one-to-one German row; German rows 1.4.1-1.4.7 enumerate concrete network, storage, LNG, supply, extraction, and refining/treatment activities. |
| `air_traffic_management_provider` | German A1 2.1.3 uses all ATM/ANS providers under Regulation 2017/373 Art. 2(2), while the NIS2/application identity is ATC-specific. |
| `vessel_traffic_service` | German A1 2.3.3 is a national safe-waterway installation/system category; VTS status alone and German status do not imply each other without evidence. |
| `road_authority` | German A1 2.4.1 regulates operators of traffic-influence installations/systems, not the EU road-authority category as such. |
| `qualified_trust_service_provider`, `other_trust_service_provider` | Both map to German A1 6.1.7; qualification splits classification under § 28(1)(2) and § 28(2)(1), not the Annex identity. [BSIG § 28][bsig-28] |
| `electricity_flexibility_provider` | Maps to three German identities (aggregator, storage-installation operator, balancing-service provider); the selected German activity must be preserved. |
| `oil_pipeline_operator`, `oil_facility_operator` | German A1 1.3.1 and 1.3.2 overlap on Erdöl-Fernleitungen; evidence must retain the exact German row(s), not deduplicate by application code. |

Required German identities outside the 67 Annex leaves:

| Proposed stable code | Source and use |
| --- | --- |
| `de_bsig_domain_name_registry_service_provider` | BSIG § 2 no. 9 definition; separate §§ 34 and 60 duties. Not classified by an Annex leaf. |
| `de_bsig_federal_authority` | BSIG § 29(1) no. 1. |
| `de_bsig_federal_public_law_it_provider` | BSIG § 29(1) no. 2. |
| `de_bsig_other_designated_federal_public_body` | BSIG § 29(1) no. 3; only after the required BSI order in agreement with the responsible federal department. |

`de_critical_installation_status` should remain a designation/status tied to an effective regulation and installation evidence, not a 68th Annex-1 identity.

German identities or legal limbs without an exact current application identity are therefore:

- `de_bsig_electricity_aggregator`, `de_bsig_energy_storage_installation_operator`, and `de_bsig_balancing_service_provider` (only the broad `electricity_flexibility_provider` exists);
- `de_bsig_natural_gas_extraction_operator` (only the broader `natural_gas_undertaking` exists);
- the non-VTS remainder of `de_bsig_waterway_safe_operation_system_operator`;
- the non-EU-road-authority remainder of `de_bsig_road_traffic_influence_system_operator`;
- the importer limb of `de_bsig_reach_registered_nace20_chemical_manufacturer_importer`; and
- the four out-of-annex German identities listed above.

Conversely, `chemical_article_producer`, distributor-only chemical activity, and regional public administration have no German federal-Annex match.

## Minimum additional discriminating facts/options

These are the smallest facts needed to make the mappings above deterministic. Every fact should support `yes`, `no`, and `unknown` where a legal conclusion cannot safely be inferred.

| Fact key | Type / options | Why required and primary basis |
| --- | --- | --- |
| `de_electricity_flexibility_activities` | multi-enum: `aggregation`, `energy_storage_installation`, `balancing_service` | Separates A1 1.1.6-1.1.8, which one application code currently collapses. [BSIG A1 1.1.6-1.1.8][bsig-a1] |
| `de_oil_activities` | multi-enum: `transmission_pipeline`, `production`, `refining`, `treatment`, `storage` | Preserves the overlap between A1 1.3.1 and 1.3.2. [BSIG A1 1.3.1-1.3.2][bsig-a1] |
| `de_natural_gas_activities` | multi-enum: `distribution`, `transmission`, `storage`, `lng`, `supply`, `extraction_installation`, `refining_treatment` | The broad EU natural-gas identity cannot select the German row. [BSIG A1 1.4.1-1.4.7][bsig-a1] |
| `de_air_navigation_provider_kind` | multi-enum: `atc`, `other_atm_ans` | Distinguishes the NIS2 ATC boundary from German ATM/ANS A1 2.1.3. |
| `de_waterway_operator_kind` | multi-enum: `vts`, `other_safe_waterway_installation_or_system` | Required because German A1 2.3.3 is not a synonym for VTS. |
| `de_road_operator_kind` | multi-enum: `road_authority_traffic_control`, `traffic_influence_installation_or_system`, `intelligent_transport_system` | Separates the EU road-authority rule, German A1 2.4.1, and German A1 2.4.2. |
| `de_trust_service_qualification` | enum: `qualified`, `non_qualified`, `unknown` | A1 has one row, while § 28 classifies qualified and other trust providers differently. [BSIG § 28(1)(2), (2)(1)][bsig-28] |
| `de_chemical_roles` | multi-enum: `manufacturer`, `importer`, `distributor`, `article_producer` | German A2 3.1.1 covers only manufacturer/importer; the EU/application model also contains distributor and article-producer branches. [BSIG A2 3.1.1][bsig-a2] |
| `de_chemical_nace20` | boolean/unknown | German chemical scope expressly requires NACE Rev. 2 division 20. [BSIG A2 3.1.1][bsig-a2] |
| `de_chemical_reach_article6_registration_required` | boolean/unknown | German chemical scope expressly requires REACH Article 6 registration. [BSIG A2 3.1.1][bsig-a2] |
| `de_public_administration_level` | enum: `federal`, `regional`, `local`, `none`, `unknown` | Separates § 29 federal administration from Land-governed regional administration. |
| `de_federal_administration_kind` | enum: `federal_authority`, `public_law_federal_it_provider`, `other_public_law_body_by_bsi_order`, `social_security_institution`, `bundesbank`, `unknown` | § 29(1) includes the first three (the third only after BSI/department order) and excludes social-security institutions and Bundesbank. [BSIG § 29][bsig-29] |
| `de_regional_admin_legal_basis` | structured: Land code, official provision/designation identifier, effective date | Federal BSIG cannot establish regional inclusion; a Land source is mandatory. |
| `de_annex_activity_non_negligible` | boolean/unknown per selected German row | § 28(3) permits negligible business activities to be disregarded. [BSIG § 28(3)][bsig-28] |
| `de_offers_goods_or_services_for_remuneration` | boolean/unknown | The general § 28(1)(4) and (2)(3) catch-all applies to persons/units offering goods or services to others for remuneration. [BSIG § 28][bsig-28] |
| `de_critical_installation_status` | enum: `formally_qualifies_under_active_regime`, `does_not_qualify`, `unknown`; plus exact instrument/version/provision | § 28(1)(1) is size-independent, but § 66 makes the definition transitional. [BSIG §§ 28, 66][bsig-66] |
| `de_sector_specific_exclusion` | multi-enum: `public_telecom`, `energy_enwg`, `dora_financial`, `statutory_telematics`, `none`, `unknown` | § 28(5)-(6) changes which BSIG obligations apply; it must not alter the entity mapping itself. [BSIG § 28(5)-(6)][bsig-28] |

Facts such as NACE classification, REACH registration status, BSI/department orders, Land designations, and critical-installation qualification cannot be reliably inferred from an organization's display name or selected broad EU activity. They require user evidence, authoritative registers/decisions, or `unknown`.

## Typed German size and aggregation parameters

The German release should compile the following typed values and formula operators from § 28 rather than reuse an opaque “SME size” label.

| Parameter | Typed value | Operative rule |
| --- | --- | --- |
| `employee_measure` | enum `annual_work_units` | Recommendation Annex Art. 5 annual work units. [SME Recommendation][sme] |
| `medium_employee_min` | integer `50`, inclusive | General important threshold and telecom essential threshold. |
| `medium_turnover_min_eur` | money `10_000_000.00`, exclusive | Used only together with balance-sheet amount. |
| `medium_balance_min_eur` | money `10_000_000.00`, exclusive | Used only together with turnover. |
| `large_employee_min` | integer `250`, inclusive | General Anlage-1 essential threshold. |
| `large_turnover_min_eur` | money `50_000_000.00`, exclusive | Used only together with the large balance threshold. |
| `large_balance_min_eur` | money `43_000_000.00`, exclusive | Used only together with the large turnover threshold. |
| `financial_pair_operator` | enum `and` | Both turnover and balance must exceed their paired values where § 28 says “und zudem”/“jeweils”. |
| `size_alternative_operator` | enum `or` | Employee threshold is an alternative to the paired financial test. |
| `sme_public_body_rule` | enum `exclude_recommendation_annex_article_3_4` | § 28(4), like NIS2, disapplies Recommendation Annex Art. 3(4). |
| `partner_linked_aggregation` | enum `recommendation_articles_3_to_6_with_de_it_independence_exception` | Recommendation data normally aggregate, but § 28(4) prohibits adding partner/linked data when legal, economic, factual, IT-system, and service circumstances establish independence. |
| `negligible_activity_rule` | enum `may_disregard` | § 28(3), not a numeric threshold. |

Compiled classification predicates:

1. `critical_installation_operator -> particularly_important`, regardless of size (§ 28(1)(1)).
2. `qualified_trust OR tld_registry OR dns -> particularly_important`, regardless of size (§ 28(1)(2)).
3. `public_telecom AND (employees >= 50 OR (turnover > 10m AND balance > 10m)) -> particularly_important` (§ 28(1)(3)).
4. `A1 general paid-goods/services entity AND (employees >= 250 OR (turnover > 50m AND balance > 43m)) -> particularly_important` (§ 28(1)(4)).
5. `non-qualified trust -> important`, regardless of size (§ 28(2)(1)), unless already particularly important.
6. `public_telecom AND employees < 50 AND (turnover <= 10m OR balance <= 10m) -> important` (§ 28(2)(2)); this is the logical complement of predicate 3's size test.
7. `A1-or-A2 general paid-goods/services entity AND (employees >= 50 OR (turnover > 10m AND balance > 10m)) -> important`, excluding particularly important entities and federal administration (§ 28(2)(3)).
8. `federal_administration_under_29 -> rules_for_particularly_important`, subject to § 29(2)-(3)'s explicit exceptions; it is not an Annex classification.

The source does not convert § 28(3)'s “vernachlässigbar” or § 28(4)'s IT-independence test into numeric parameters. Those are evidence-backed legal judgments and must support `unknown`, not invented thresholds.

## Jurisdiction-basis mappings

National supervisory jurisdiction and the NIS2 Member-State basis should be stored separately; the same answer is not valid for every entity type.

| Typed German basis | Applies to | Official provision | Existing questionnaire basis |
| --- | --- | --- | --- |
| `de_establishment` | Particularly important/important entity established in Germany | BSIG § 59 no. 1 | `establishment` |
| `de_critical_installation_location` | Operator whose critical installation is on German territory | BSIG § 59 no. 2 | **new option required** |
| `de_federal_administration` | § 29 federal administration | BSIG § 59 no. 3 | Refine current `public_administration` |
| `de_main_eu_establishment` | DNS, TLD, domain-registration, cloud, data-centre, CDN, MSP, MSSP, marketplace, search, social-platform providers | BSIG § 60(1)-(2) | `main_eu_establishment` |
| `de_eu_representative` | Same § 60 list, no EU establishment but services offered in the EU and representative in Germany | BSIG § 60(3) | `eu_representative` |
| `de_bsi_discretion_absent_representative` | Same § 60 list with no appointed EU representative; BSI may declare jurisdiction | BSIG § 60(3), sentence 4 | **new authority-state option; not user-inferable** |
| `nis2_telecom_service_location` | Public telecom network/service provider | NIS2 Art. 26(1)(a) | `telecom_service_location`; **no direct §§ 59-60 equivalent**, so do not cite § 60 |
| `de_regional_public_administration` | Regional administration | Relevant Land law/authority, not established by §§ 59-60 | Current `public_administration` is insufficient |

[BSIG § 59][bsig-59] supplies the first three bases; [§ 60][bsig-60] supplies the main-establishment/representative bases. Trust-service providers are not in § 60's special list and therefore must not be routed through that rule solely because they are “digital”.

## Required legal instruments and provisions

At minimum, a publishable German profile needs immutable versions/provisions for:

- **BSIG:** full instrument identity/effective dates; § 2 nos. 2-5, 8-9, 12, 20, 22, 25-30, 33-35; § 28(1)-(8); § 29; § 34; §§ 59-60; § 66; Anlagen 1 and 2. [Current BSIG][bsig]
- **Critical-installation transition:** current BSI-KritisV, especially § 12 and its sector annexes; KRITISDachG §§ 2, 4(3), 5(1); and the future regulation/effective-date announcement that triggers BSIG § 66 and BSI-KritisV § 12. [BSIG § 66][bsig-66] [BSI-KritisV § 12][bsi-kritisv-12] [KRITISDachG][kritis-dachg]
- **Size calculation:** Commission Recommendation 2003/361/EC Annex Arts. 1-6, with the § 28(4) German deviations stored explicitly. [SME Recommendation][sme]
- **German incorporated laws used by Annex rows:** EnWG § 3; GEG § 3; LSV § 2; AEG § 2; WaStrG § 1; FStrG § 1; IVSG § 2; WpHG § 2; AMG § 2; TrinkwV § 2; WHG § 54; PostG § 3; KrWG § 3; and the NACE Rev. 2 classification. These are part of the entity definition graph, not optional explanatory citations. [BSIG Anlagen 1-2][bsig-a1]
- **EU instruments incorporated directly by the German Annexes:** Regulation 2019/943, Directives 2009/119/EC and 2009/12/EC, Regulations 1315/2013, 300/2008, 2017/373, 725/2004, 2022/2371, 2022/123, 2017/745, 2017/746, Directives 2005/65/EC and 2011/24/EU, Regulations 1907/2006 and 178/2002. The exact cited provisions are recorded in the 67-row tables.
- **Jurisdiction and EU-core relation:** NIS2 Articles 2, 3, 6, and 26, because § 60 implements only a defined subset of Article 26 and regional administration remains outside the federal Annex model. [NIS2][nis2]

## Transitional publication checks

Before compiling or activating a German release, the publisher must fail closed unless it records:

1. the BSIG consolidated version and effective-from date (current full citation: Act of 2 December 2025, amended by Article 4 of the Act of 11 March 2026); [official BSIG full text][bsig]
2. whether the regulation under KRITISDachG §§ 4(3), 5(1) is legally in force on the release effective date;
3. whether the Federal Ministry's announcement referenced by BSI-KritisV § 12 has occurred;
4. consequently, whether BSIG § 2 nos. 22/24 use the pre-17-March-2026 definition preserved by § 66 or the KRITISDachG-linked definition;
5. the effective BSI-KritisV/KRITIS regulation version and threshold annex used for `de_critical_installation_status`;
6. effective versions of every incorporated national/EU definition and NACE classification; and
7. any BSI order required by § 29(1) no. 3 and any Land act/decision required for regional administration.

The official sources establish the transition mechanism, but they do not let a static release definition infer that a future regulation or individual designation/order exists. Those are external effective-state facts that must be verified at publication time and captured with provenance.

At this research snapshot, the official consolidated BSI-KritisV publication is the Regulation of 22 April 2016, most recently amended by Article 3(1) of the Act of 15 May 2026 (BGBl. 2026 I no. 148). It still presents nine sector annexes, and § 12 still conditions repeal on the future KRITISDachG regulation. No replacement regulation promulgation was located in the official sources reviewed. This is a time-sensitive finding: the publisher must recheck the Federal Law Gazette and consolidated official pages rather than treating this note as an activation flag. [Current BSI-KritisV][bsi-kritisv]

## Facts that official legislation alone cannot reliably supply

- whether a specific organization's selected activity is non-negligible under § 28(3);
- whether partner/linked companies are sufficiently independent under § 28(4)'s legal, economic, factual, IT-system, and service test;
- the organization's correct AWU, turnover, balance sheet, partner proportions, linked-enterprise totals, and two-period history;
- NACE division, REACH Article 6 registration duty/status, or whether a particular device is on the emergency critical-device list;
- whether the entity has received a BSI/department order under § 29(1) no. 3, a Land regional-administration designation, or a BSI jurisdiction declaration under § 60(3);
- whether an installation crosses the active BSI-KritisV/KRITIS regulation threshold;
- whether a sector-specific exclusion under § 28(5)-(6) applies to all or only part of the entity's activities; and
- whether an ATM/ANS, waterway, or road operator also satisfies the narrower EU application identity.

These must remain evidence-bearing answers or `unknown`. The evaluator must not derive them from sector labels.

## Official primary sources

- [BSIG official consolidated text][bsig]
- [BSIG § 2][bsig-2], [§ 28][bsig-28], [§ 29][bsig-29], [§ 34][bsig-34], [§ 59][bsig-59], [§ 60][bsig-60], [§ 66][bsig-66]
- [BSIG Anlage 1][bsig-a1] and [Anlage 2][bsig-a2]
- [BSI-KritisV § 12][bsi-kritisv-12] and [current BSI-KritisV][bsi-kritisv]
- [KRITISDachG official text][kritis-dachg], [§ 4][kritis-dachg-4], [§ 5][kritis-dachg-5]
- [Recommendation 2003/361/EC][sme]
- [Directive (EU) 2022/2555][nis2]

[bsig]: https://www.gesetze-im-internet.de/bsig_2025/BJNR12D0B0025.html
[bsig-2]: https://www.gesetze-im-internet.de/bsig_2025/__2.html
[bsig-28]: https://www.gesetze-im-internet.de/bsig_2025/__28.html
[bsig-29]: https://www.gesetze-im-internet.de/bsig_2025/__29.html
[bsig-34]: https://www.gesetze-im-internet.de/bsig_2025/__34.html
[bsig-59]: https://www.gesetze-im-internet.de/bsig_2025/__59.html
[bsig-60]: https://www.gesetze-im-internet.de/bsig_2025/__60.html
[bsig-66]: https://www.gesetze-im-internet.de/bsig_2025/__66.html
[bsig-a1]: https://www.gesetze-im-internet.de/bsig_2025/anlage_1.html
[bsig-a2]: https://www.gesetze-im-internet.de/bsig_2025/anlage_2.html
[bsi-kritisv]: https://www.gesetze-im-internet.de/bsi-kritisv/BJNR095800016.html
[bsi-kritisv-12]: https://www.gesetze-im-internet.de/bsi-kritisv/__12.html
[kritis-dachg]: https://www.gesetze-im-internet.de/kritisdachg/BJNR0420B0026.html
[kritis-dachg-4]: https://www.gesetze-im-internet.de/kritisdachg/__4.html
[kritis-dachg-5]: https://www.gesetze-im-internet.de/kritisdachg/__5.html
[sme]: https://eur-lex.europa.eu/eli/reco/2003/361/oj/eng
[nis2]: https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng
