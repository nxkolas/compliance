# NIS2 entity types: primary legal-source review

Research snapshot: 2026-07-16  
Scope: the 70 entity codes originally in `src/server/applicability-check/nis2-scope-definition.ts`, now in `src/server/compliance/nis2/releases/2026-v1/release-source.ts`  
Sources: official EUR-Lex and German Federal Ministry of Justice publications only

## Decision-relevant conclusion

The source file does contain exactly **70 application entity codes**, but neither NIS2 nor the German BSIG defines a canonical set of exactly 70 legal entity types.

| Source/model | Count | Reconciliation |
| --- | ---: | --- |
| NIS2 Annex I | 53 | Statutory rows/bullets in the third column of Annex I. |
| NIS2 Annex II | 14 | Statutory rows/bullets in the third column of Annex II. |
| NIS2 Article 2(4) | 1 | Domain-name registration services sit outside Annexes I and II. |
| Repository | **70** | 54 Annex-I codes + 15 Annex-II codes + 1 domain-registration code. The extra two codes result from splitting one Annex-I trust-service row into qualified/non-qualified providers and one Annex-II chemicals row into two activity branches. |
| German BSIG Anlagen 1 and 2 | 53 + 14 | The count happens to be 67, but the categories and splits are not the same as NIS2's 67 annex rows. |

The plan remains implementable if “70 entity types” means **stable evaluator/application identities**. It is not valid if it means 70 one-to-one statutory categories. Publication must preserve the many-to-one split provenance and separate EU and German mappings. This is especially important for trust services, chemicals, electricity, gas, air traffic, road/waterway operations, and public administration. [NIS2 Articles 2, 3 and 6 and Annexes I-II][nis2] [BSIG § 28 and Anlagen 1-2][bsig-28]

## NIS2 coverage matrix for all 70 repository codes

The wording below records the legal boundary that the eventual parallel German and English descriptions must preserve. “NIS2-native” means the definition is in NIS2 itself; otherwise the Annex incorporates the cited instrument or classification.

### Annex I — sectors of high criticality

| Repository code | Primary legal locator | Definition boundary to preserve |
| --- | --- | --- |
| `electricity_supplier` | Annex I 1(a); Directive 2019/944 Art. 2(57), (12) | An electricity undertaking carrying out the function of supply. |
| `electricity_distribution_operator` | Annex I 1(a); Directive 2019/944 Art. 2(29) | Distribution system operator, not every electricity-sector business. |
| `electricity_transmission_operator` | Annex I 1(a); Directive 2019/944 Art. 2(35) | Transmission system operator. |
| `electricity_producer` | Annex I 1(a); Directive 2019/944 Art. 2(38) | Producer as legally defined. |
| `electricity_market_operator` | Annex I 1(a); Regulation 2019/943 Art. 2(8) | Nominated electricity market operator. |
| `electricity_flexibility_provider` | Annex I 1(a); Regulation 2019/943 Art. 2(25), Directive 2019/944 Art. 2(18), (20), (59) | Must first be a market participant and provide aggregation, demand response, or energy-storage services; “any flexibility provider” is too broad. |
| `recharging_point_operator` | Annex I 1(a), NIS2-native text | Entity responsible for managing and operating a recharging point that supplies end users, including for a mobility service provider. |
| `district_heating_cooling_operator` | Annex I 1(b); Directive 2018/2001 Art. 2(19) | Operator of district heating or district cooling. |
| `oil_pipeline_operator` | Annex I 1(c), NIS2-native text | Operator of an oil transmission pipeline. |
| `oil_facility_operator` | Annex I 1(c), NIS2-native text | Operator of oil production, refining/treatment, storage, or transmission facilities. |
| `central_oil_stockholding_entity` | Annex I 1(c); Directive 2009/119/EC Art. 2(f) | Central stockholding entity as defined by that Directive. |
| `gas_supply_undertaking` | Annex I 1(d); Directive 2009/73/EC Art. 2(8) | Supply undertaking. |
| `gas_distribution_operator` | Annex I 1(d); Directive 2009/73/EC Art. 2(6) | Distribution system operator. |
| `gas_transmission_operator` | Annex I 1(d); Directive 2009/73/EC Art. 2(4) | Transmission system operator. |
| `gas_storage_operator` | Annex I 1(d); Directive 2009/73/EC Art. 2(10) | Storage system operator. |
| `lng_operator` | Annex I 1(d); Directive 2009/73/EC Art. 2(12) | LNG system operator. |
| `natural_gas_undertaking` | Annex I 1(d); Directive 2009/73/EC Art. 2(1) | Natural-gas undertaking; this broad EU identity is not identical to the German extraction-operator row. |
| `gas_refining_treatment_operator` | Annex I 1(d), NIS2-native text | Operator of natural-gas refining or treatment facilities. |
| `hydrogen_operator` | Annex I 1(e), NIS2-native text | Operator of hydrogen production, storage, or transmission. |
| `air_carrier` | Annex I 2(a); Regulation 300/2008 Art. 3(4) | Commercially used air carrier. |
| `airport_operator` | Annex I 2(a); Directive 2009/12/EC Art. 2(1)-(2), Regulation 1315/2013 Annex II §2 | One application code combines airport managing bodies, airports (including listed core airports), and operators of ancillary airport installations. |
| `air_traffic_management_provider` | Annex I 2(a); Regulation 549/2004 Art. 2(1) | EU-core text is limited to traffic-management control operators providing ATC services. The current label “ATM or air-navigation-services provider” is broader and matches the German implementation more closely than the NIS2 row. |
| `rail_infrastructure_manager` | Annex I 2(b); Directive 2012/34/EU Art. 3(2) | Infrastructure manager. |
| `railway_undertaking` | Annex I 2(b); Directive 2012/34/EU Art. 3(1), (12) | Railway undertaking, expressly including service-facility operators. |
| `water_transport_company` | Annex I 2(c); Regulation 725/2004 Annex I | Inland, sea, or coastal passenger/freight transport company; individual vessels are excluded. |
| `port_operator` | Annex I 2(c); Directive 2005/65/EC Art. 3(1), Regulation 725/2004 Art. 2(11) | One code combines port managing bodies, their port facilities, and entities operating works/equipment in ports. |
| `vessel_traffic_service` | Annex I 2(c); Directive 2002/59/EC Art. 3(o) | Operator of a legally defined vessel traffic service. |
| `road_authority` | Annex I 2(d); Delegated Regulation 2015/962 Art. 2(12) | Road authority responsible for traffic-management control; public bodies where that function is non-essential are excluded. |
| `intelligent_transport_system_operator` | Annex I 2(d); Directive 2010/40/EU Art. 4(1) | Operator of an intelligent transport system. |
| `credit_institution` | Annex I 3; Regulation 575/2013 Art. 4(1) | Credit institution as prudentially defined. |
| `trading_venue_operator` | Annex I 4; Directive 2014/65/EU Art. 4(1)(24) | Operator of a trading venue. |
| `central_counterparty` | Annex I 4; Regulation 648/2012 Art. 2(1) | Central counterparty. |
| `healthcare_provider` | Annex I 5; Directive 2011/24/EU Art. 3(g) | Healthcare provider as defined for cross-border healthcare. |
| `eu_reference_laboratory` | Annex I 5; Regulation 2022/2371 Art. 15 | EU reference laboratory referred to in Article 15. |
| `medicinal_product_researcher` | Annex I 5; Directive 2001/83/EC Art. 1(2) | Entity conducting R&D activities concerning legally defined medicinal products. |
| `pharmaceutical_manufacturer` | Annex I 5; NACE Rev. 2 section C division 21 | Entity manufacturing basic pharmaceutical products or preparations in division 21. |
| `critical_medical_device_manufacturer` | Annex I 5; Regulation 2022/123 Art. 22 | Manufacturer of devices placed on the public-health-emergency critical-devices list; ordinary device manufacturers belong to Annex II. |
| `drinking_water_supplier` | Annex I 6; Directive 2020/2184 Art. 2(1)(a) | Supplier/distributor of water intended for human consumption; distribution incidental to other commodity distribution is excluded. |
| `waste_water_undertaking` | Annex I 7; Directive 91/271/EEC Art. 2(1)-(3) | Undertaking collecting, disposing of, or treating urban, domestic, or industrial waste water; non-essential/incidental activity is excluded. |
| `internet_exchange_point` | Annex I 8; NIS2 Art. 6(18) | Facility interconnecting more than two independent autonomous systems under the detailed no-third-system/no-interference limits. |
| `dns_service_provider` | Annex I 8; NIS2 Art. 6(19)-(20) | Public recursive resolution or third-party authoritative resolution; root name servers are excluded. |
| `tld_registry` | Annex I 8; NIS2 Art. 6(21) | Entity delegated a TLD and responsible for its administration/technical operation; own-use-only TLDs are excluded. |
| `cloud_service_provider` | Annex I 8; NIS2 Art. 6(23), (30) | Provider of an on-demand, remotely administered, scalable and elastic pool of shared computing resources. |
| `data_centre_service_provider` | Annex I 8; NIS2 Art. 6(23), (31) | Provider of centralized IT/network accommodation, interconnection and operation with supporting power/environment infrastructure. |
| `content_delivery_network_provider` | Annex I 8; NIS2 Art. 6(23), (32) | Provider of geographically distributed servers delivering content/services for third parties with high availability/accessibility/speed. |
| `qualified_trust_service_provider` | Annex I 8; NIS2 Art. 6(24)-(27), Art. 3(1)(b) | Application subdivision of the single Annex-I “trust service providers” row; qualified providers are essential regardless of size. |
| `other_trust_service_provider` | Annex I 8; NIS2 Art. 6(24)-(27), Arts. 2(2)(a)(ii), 3(2) | Complementary application subdivision of the same Annex row; non-qualified trust-service providers are in scope regardless of size and are important unless otherwise designated essential. |
| `public_electronic_communications_network` | Annex I 8; NIS2 Art. 6(36), Directive 2018/1972 Art. 2(8) | Provider of a public electronic communications network. |
| `public_electronic_communications_service` | Annex I 8; NIS2 Art. 6(37), Directive 2018/1972 Art. 2(4) | Provider of a publicly available electronic communications service. |
| `managed_service_provider` | Annex I 9; NIS2 Art. 6(39) | Entity actively administering or assisting with installation, management, operation, or maintenance of customers' ICT/network systems, locally or remotely. |
| `managed_security_service_provider` | Annex I 9; NIS2 Art. 6(40) | MSP carrying out or assisting with cybersecurity risk-management activities. |
| `central_public_administration` | Annex I 10; NIS2 Arts. 6(35), 2(2)(f)(i), 3(1)(d) | Must satisfy the NIS2 public-administration definition and be central government under national law; essential regardless of size, subject to security/defence exclusions. |
| `regional_public_administration` | Annex I 10; NIS2 Arts. 6(35), 2(2)(f)(ii) | Must be regional administration under national law and pass the required risk-based disruption assessment; selection alone cannot produce a definitive positive classification. |
| `space_ground_infrastructure_operator` | Annex I 11, NIS2-native text | Operator of Member-State/private ground infrastructure supporting space-based services; public electronic communications network providers are excluded from this row. |

The incorporated energy, transport, finance, health, and water definitions above are all explicitly cross-referenced by [NIS2 Annex I][nis2]. Their owning instruments are linked in the official source register below.

### Article 2(4) — non-annex scope

| Repository code | Primary legal locator | Definition boundary to preserve |
| --- | --- | --- |
| `domain_name_registration_service` | NIS2 Arts. 2(4), 6(22), 28 | Registrar or agent acting for registrars, including privacy/proxy services and resellers. It is in scope regardless of size, but Article 3 does not automatically classify it as essential or important; Article 28 imposes registration-data obligations. |

### Annex II — other critical sectors

| Repository code | Primary legal locator | Definition boundary to preserve |
| --- | --- | --- |
| `postal_courier_provider` | Annex II 1; Directive 97/67/EC Art. 2(1a) | Postal-service provider, expressly including courier-service providers. |
| `waste_management_undertaking` | Annex II 2; Directive 2008/98/EC Art. 3(9) | Waste-management undertaking only where waste management is a principal economic activity. |
| `chemical_manufacturer_distributor` | Annex II 3; REACH Regulation 1907/2006 Art. 3(9), (14) | First branch of one Annex-II row: undertaking manufacturing substances or distributing substances/mixtures. The repository split is not a separate statutory row. |
| `chemical_article_producer` | Annex II 3; REACH Regulation 1907/2006 Art. 3(3) | Second branch of the same Annex-II row: undertaking producing articles from substances or mixtures. The repository split is not a separate statutory row. |
| `food_wholesale_industrial_business` | Annex II 4; Regulation 178/2002 Art. 3(2) | Food business engaged in wholesale distribution or industrial production/processing; not every food business. |
| `medical_device_manufacturer` | Annex II 5(a); Regulations 2017/745 Art. 2(1), 2017/746 Art. 2(2) | Manufacturer of medical devices or in-vitro diagnostics, excluding manufacturers covered by the Annex-I emergency critical-device row. |
| `computer_electronic_optical_manufacturer` | Annex II 5(b); NACE Rev. 2 division 26 | Undertaking carrying out a division-26 economic activity. |
| `electrical_equipment_manufacturer` | Annex II 5(c); NACE Rev. 2 division 27 | Undertaking carrying out a division-27 economic activity. |
| `machinery_manufacturer` | Annex II 5(d); NACE Rev. 2 division 28 | Undertaking carrying out a division-28 economic activity. |
| `motor_vehicle_manufacturer` | Annex II 5(e); NACE Rev. 2 division 29 | Undertaking carrying out a division-29 economic activity. |
| `other_transport_equipment_manufacturer` | Annex II 5(f); NACE Rev. 2 division 30 | Undertaking carrying out a division-30 economic activity. |
| `online_marketplace_provider` | Annex II 6; NIS2 Art. 6(28), Directive 2005/29/EC Art. 2(n) | Provider of a legally defined online marketplace. |
| `online_search_engine_provider` | Annex II 6; NIS2 Art. 6(29), Regulation 2019/1150 Art. 2(5) | Provider of a legally defined online search engine. |
| `social_networking_platform_provider` | Annex II 6; NIS2 Art. 6(33) | Platform enabling end users to connect, share, discover, and communicate across devices. |
| `research_organisation` | Annex II 7; NIS2 Art. 6(41) | Entity primarily conducting applied research or experimental development for commercial exploitation; educational institutions are excluded. |

The incorporated postal, waste, chemical, food, device, and NACE definitions above are explicitly cross-referenced by [NIS2 Annex II][nis2].

## Cross-cutting provisions the release must encode

- **General size gate:** NIS2 Article 2(1) applies to Annex-I/II entities that are medium-sized under Recommendation 2003/361/EC or exceed its medium ceilings. The Recommendation's Annex Article 2 uses `<250 employees AND (turnover <= EUR 50m OR balance sheet <= EUR 43m)` for an SME; therefore exceeding medium size is `>=250 employees OR (turnover > EUR 50m AND balance sheet > EUR 43m)`. [Recommendation 2003/361/EC, Annex Art. 2][sme]
- **Calculation is more than three thresholds:** Recommendation Annex Articles 3-6 define autonomous/partner/linked enterprises, the reference period and two-period status rule, annual work units, and proportional/100% aggregation. NIS2 disapplies Recommendation Annex Article 3(4). [NIS2 Art. 2(1)][nis2] [Recommendation 2003/361/EC][sme]
- **Size-independent scope:** NIS2 Article 2(2) covers telecom, trust services, TLD/DNS and designated exceptional entities regardless of size; Articles 2(3) and 3(1)(f) make entities identified under CER essential, while Article 2(4) separately covers domain registrars. [NIS2 Arts. 2-3][nis2]
- **CER is an official designation, not a self-assessed impact:** CER Article 6 requires the Member State to identify an entity after applying all three statutory criteria and to notify it. The corresponding questionnaire answer must represent a formal designation. [CER Art. 6][cer]
- **Jurisdiction is entity-specific:** NIS2 Article 26 uses establishment by default, service location for public telecom, main EU establishment/representative for listed digital and managed providers, and the establishing state for public administration. [NIS2 Art. 26][nis2]

## German BSIG profile findings

The official consolidated BSIG is dated 2 December 2025, effective from 6 December 2025, and currently records amendment by Article 4 of the Act of 11 March 2026. That matches the repository profile version label's legal snapshot. [Official BSIG full text][bsig]

The German profile cannot reuse the EU 70-code mapping without explicit overrides:

1. **Classification and thresholds:** § 28(1)-(2) defines besonders wichtige/wichtige Einrichtungen; § 28(4) applies Recommendation 2003/361/EC but excludes its Annex Article 3(4), and adds a German IT-independence exception under which partner/linked-enterprise data are not added. That exception must be represented in German profile parameters/evidence. [BSIG § 28][bsig-28]
2. **Different category partition:** Anlage 1 has 53 numbered types and Anlage 2 has 14, but they do not align one-to-one with NIS2's rows. For example, German electricity separates aggregators, storage operators and balancing-service providers; German gas uses a natural-gas extraction operator instead of the broad EU `natural_gas_undertaking`; German air traffic uses ATM/ANS providers; and German waterway/road rows use national infrastructure concepts. [BSIG Anlage 1][bsig-a1]
3. **Chemicals are materially narrower:** German Anlage 2 has one row for manufacturers and importers in NACE division 20 that are subject to REACH Article 6 registration. It does not reproduce the EU Annex-II distributor/article-producer branches. `chemical_manufacturer_distributor` and `chemical_article_producer` therefore require national mapping/clarification rather than direct German matches. [BSIG Anlage 2][bsig-a2]
4. **Public administration is separate:** Public administration does not appear in BSIG Anlagen 1 or 2. Federal administration is governed by § 29 and treated broadly like besonders wichtige Einrichtungen. Regional administration depends on Länder implementation/risk designation; BSIG alone is not a complete positive/negative source for that code. [BSIG § 29][bsig-29]
5. **Critical installations:** `de_critical_installation` must mean an operator of a “kritische Anlage”; § 28(1)(1) classifies its operator as particularly important. The definition is transitional: § 66 preserves the earlier § 2(22)/(24) until the new KRITIS-Dachgesetz regulation applies, and BSI-KritisV § 12 links its own expiry to that regulation. The release publisher must verify which definition/regulation is effective on the release date. This status is distinct from merely selecting an Annex entity type. [BSIG §§ 2, 28 and 66][bsig-66] [BSI-KritisV § 12][bsi-kritisv-12]
6. **German jurisdiction:** § 59 uses German establishment/installation location; § 60 implements the main-establishment and representative rule for specified digital/managed providers. These provisions should back the national jurisdiction paths instead of a generic BSIG citation. [BSIG §§ 59-60][bsig-59]
7. **Sector-specific displacement:** § 28(5)-(6) contains the telecom/energy and DORA/telematics carve-outs currently surfaced by the checker. They affect obligations, not the underlying entity identity, and should be modeled as profile-level legal provisions. [BSIG § 28][bsig-28]

## Publication requirements derived from the sources

- Retain all 70 stable codes if compatibility requires them, but mark the two split pairs with shared legal-row provenance.
- Do not describe “70” as the number of NIS2 or BSIG statutory entity types.
- Store one entity version's links to multiple provisions/instruments where its definition is incorporated by reference.
- Store EU-core and German mappings independently; a shared stable code does not imply identical scope text.
- Version the official instrument snapshot/effective dates. A mutable bare URL is not enough for an immutable release, especially where referenced sector legislation is amended or replaced.
- Treat the present generic descriptions (`Legally defined entity type: ...`) as non-publishable. The coverage matrix above supplies the minimum legal constraints for reviewed parallel DE/EN wording, not final legal advice.

## Official primary-source register

### Core scope, classification, definitions and national implementation

- [Directive (EU) 2022/2555 (NIS2), Articles 2, 3, 6, 26, 28 and Annexes I-II][nis2]
- [Commission Recommendation 2003/361/EC, Annex Articles 1-6][sme]
- [Directive (EU) 2022/2557 (CER), Article 6][cer]
- [German BSIG official consolidated full text][bsig], [§ 2][bsig-2], [§ 28][bsig-28], [§ 29][bsig-29], [§ 59][bsig-59], [§ 60][bsig-60], [§ 66][bsig-66], [Anlage 1][bsig-a1], [Anlage 2][bsig-a2], [BSI-KritisV § 12][bsi-kritisv-12]

### Instruments incorporated by NIS2 Annex I

- Energy: [Directive 2019/944][eu-2019-944], [Regulation 2019/943][eu-2019-943], [Directive 2018/2001][eu-2018-2001], [Directive 2009/119/EC][eu-2009-119], [Directive 2009/73/EC][eu-2009-73]
- Transport: [Regulation 300/2008][eu-300-2008], [Directive 2009/12/EC][eu-2009-12], [Regulation 1315/2013][eu-1315-2013], [Regulation 549/2004][eu-549-2004], [Directive 2012/34/EU][eu-2012-34], [Regulation 725/2004][eu-725-2004], [Directive 2005/65/EC][eu-2005-65], [Directive 2002/59/EC][eu-2002-59], [Delegated Regulation 2015/962][eu-2015-962], [Directive 2010/40/EU][eu-2010-40]
- Finance and health: [Regulation 575/2013][eu-575-2013], [Directive 2014/65/EU][eu-2014-65], [Regulation 648/2012][eu-648-2012], [Directive 2011/24/EU][eu-2011-24], [Regulation 2022/2371][eu-2022-2371], [Directive 2001/83/EC][eu-2001-83], [Regulation 2022/123][eu-2022-123]
- Water and communications: [Directive 2020/2184][eu-2020-2184], [Directive 91/271/EEC][eu-91-271], [Regulation 910/2014 (eIDAS)][eu-910-2014], [Directive 2018/1972][eu-2018-1972]

### Instruments incorporated by NIS2 Annex II

- [Directive 97/67/EC][eu-97-67], [Directive 2008/98/EC][eu-2008-98], [Regulation 1907/2006 (REACH)][eu-1907-2006], [Regulation 178/2002][eu-178-2002], [Regulation 2017/745][eu-2017-745], [Regulation 2017/746][eu-2017-746], [Regulation 1893/2006 establishing NACE Rev. 2][eu-1893-2006], [Directive 2005/29/EC][eu-2005-29], [Regulation 2019/1150][eu-2019-1150]

[nis2]: https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng
[sme]: https://eur-lex.europa.eu/eli/reco/2003/361/oj/eng
[cer]: https://eur-lex.europa.eu/eli/dir/2022/2557/oj/eng
[bsig]: https://www.gesetze-im-internet.de/bsig_2025/BJNR12D0B0025.html
[bsig-2]: https://www.gesetze-im-internet.de/bsig_2025/__2.html
[bsig-28]: https://www.gesetze-im-internet.de/bsig_2025/__28.html
[bsig-29]: https://www.gesetze-im-internet.de/bsig_2025/__29.html
[bsig-59]: https://www.gesetze-im-internet.de/bsig_2025/__59.html
[bsig-60]: https://www.gesetze-im-internet.de/bsig_2025/__60.html
[bsig-66]: https://www.gesetze-im-internet.de/bsig_2025/__66.html
[bsig-a1]: https://www.gesetze-im-internet.de/bsig_2025/anlage_1.html
[bsig-a2]: https://www.gesetze-im-internet.de/bsig_2025/anlage_2.html
[bsi-kritisv-12]: https://www.gesetze-im-internet.de/bsi-kritisv/__12.html
[eu-2019-944]: https://eur-lex.europa.eu/eli/dir/2019/944/oj/eng
[eu-2019-943]: https://eur-lex.europa.eu/eli/reg/2019/943/oj/eng
[eu-2018-2001]: https://eur-lex.europa.eu/eli/dir/2018/2001/oj/eng
[eu-2009-119]: https://eur-lex.europa.eu/eli/dir/2009/119/oj/eng
[eu-2009-73]: https://eur-lex.europa.eu/eli/dir/2009/73/oj/eng
[eu-300-2008]: https://eur-lex.europa.eu/eli/reg/2008/300/oj/eng
[eu-2009-12]: https://eur-lex.europa.eu/eli/dir/2009/12/oj/eng
[eu-1315-2013]: https://eur-lex.europa.eu/eli/reg/2013/1315/oj/eng
[eu-549-2004]: https://eur-lex.europa.eu/eli/reg/2004/549/oj/eng
[eu-2012-34]: https://eur-lex.europa.eu/eli/dir/2012/34/oj/eng
[eu-725-2004]: https://eur-lex.europa.eu/eli/reg/2004/725/oj/eng
[eu-2005-65]: https://eur-lex.europa.eu/eli/dir/2005/65/oj/eng
[eu-2002-59]: https://eur-lex.europa.eu/eli/dir/2002/59/oj/eng
[eu-2015-962]: https://eur-lex.europa.eu/eli/reg_del/2015/962/oj/eng
[eu-2010-40]: https://eur-lex.europa.eu/eli/dir/2010/40/oj/eng
[eu-575-2013]: https://eur-lex.europa.eu/eli/reg/2013/575/oj/eng
[eu-2014-65]: https://eur-lex.europa.eu/eli/dir/2014/65/oj/eng
[eu-648-2012]: https://eur-lex.europa.eu/eli/reg/2012/648/oj/eng
[eu-2011-24]: https://eur-lex.europa.eu/eli/dir/2011/24/oj/eng
[eu-2022-2371]: https://eur-lex.europa.eu/eli/reg/2022/2371/oj/eng
[eu-2001-83]: https://eur-lex.europa.eu/eli/dir/2001/83/oj/eng
[eu-2022-123]: https://eur-lex.europa.eu/eli/reg/2022/123/oj/eng
[eu-2020-2184]: https://eur-lex.europa.eu/eli/dir/2020/2184/oj/eng
[eu-91-271]: https://eur-lex.europa.eu/eli/dir/1991/271/oj/eng
[eu-910-2014]: https://eur-lex.europa.eu/eli/reg/2014/910/oj/eng
[eu-2018-1972]: https://eur-lex.europa.eu/eli/dir/2018/1972/oj/eng
[eu-97-67]: https://eur-lex.europa.eu/eli/dir/1997/67/oj/eng
[eu-2008-98]: https://eur-lex.europa.eu/eli/dir/2008/98/oj/eng
[eu-1907-2006]: https://eur-lex.europa.eu/eli/reg/2006/1907/oj/eng
[eu-178-2002]: https://eur-lex.europa.eu/eli/reg/2002/178/oj/eng
[eu-2017-745]: https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng
[eu-2017-746]: https://eur-lex.europa.eu/eli/reg/2017/746/oj/eng
[eu-1893-2006]: https://eur-lex.europa.eu/eli/reg/2006/1893/oj/eng
[eu-2005-29]: https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng
[eu-2019-1150]: https://eur-lex.europa.eu/eli/reg/2019/1150/oj/eng
