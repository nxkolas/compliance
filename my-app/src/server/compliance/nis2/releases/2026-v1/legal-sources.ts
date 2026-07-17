import type { LegalInstrumentSource } from "../types";

type AddContent = (stableKey: string, de: string, en: string) => string;

type InstrumentDefinition = {
  code: string;
  jurisdictionCode: "DE" | "EU";
  instrumentType: string;
  versionLabel: string;
  officialIdentifier: string;
  officialSourceUrl: string;
  titleDe: string;
  titleEn: string;
  provisions: Array<{ code: string; url: string; de: string; en: string }>;
};

export function buildGermanIncorporatedLegalInstruments(
  addContent: AddContent,
): LegalInstrumentSource[] {
  return definitions.map((instrument) => ({
    code: instrument.code,
    jurisdictionCode: instrument.jurisdictionCode,
    instrumentType: instrument.instrumentType,
    versionLabel: instrument.versionLabel,
    officialIdentifier: instrument.officialIdentifier,
    officialSourceUrl: instrument.officialSourceUrl,
    titleContentKey: addContent(
      `nis2.legal.${instrument.code}.title`,
      instrument.titleDe,
      instrument.titleEn,
    ),
    provisions: instrument.provisions.map((provision) => ({
      code: provision.code,
      officialSourceUrl: provision.url,
      citationContentKey: addContent(
        `nis2.legal.${instrument.code}.${provision.code}.citation`,
        provision.de,
        provision.en,
      ),
    })),
  }));
}

const definitions: InstrumentDefinition[] = [
  german("de_enwg", "Energiewirtschaftsgesetz", "German Energy Industry Act", "https://www.gesetze-im-internet.de/enwg_2005/", [["section_3", "https://www.gesetze-im-internet.de/enwg_2005/__3.html", "§ 3", "Section 3"]]),
  german("de_lsv", "Ladesäulenverordnung", "German Charging Station Regulation", "https://www.gesetze-im-internet.de/lsv/", [["section_2", "https://www.gesetze-im-internet.de/lsv/__2.html", "§ 2", "Section 2"]]),
  german("de_geg", "Gebäudeenergiegesetz", "German Buildings Energy Act", "https://www.gesetze-im-internet.de/geg/", [["section_3", "https://www.gesetze-im-internet.de/geg/__3.html", "§ 3", "Section 3"]]),
  german("de_aeg", "Allgemeines Eisenbahngesetz", "German General Railway Act", "https://www.gesetze-im-internet.de/aeg_1994/", [["section_2", "https://www.gesetze-im-internet.de/aeg_1994/__2.html", "§ 2", "Section 2"]]),
  german("de_wastrg", "Bundeswasserstraßengesetz", "German Federal Waterways Act", "https://www.gesetze-im-internet.de/wastrg/", [["section_1_6_1", "https://www.gesetze-im-internet.de/wastrg/__1.html", "§ 1 Absatz 6 Nummer 1", "Section 1(6)(1)"]]),
  german("de_fstrg", "Bundesfernstraßengesetz", "German Federal Trunk Roads Act", "https://www.gesetze-im-internet.de/fstrg/", [["section_1", "https://www.gesetze-im-internet.de/fstrg/__1.html", "§ 1", "Section 1"]]),
  german("de_ivsg", "Intelligente Verkehrssysteme Gesetz", "German Intelligent Transport Systems Act", "https://www.gesetze-im-internet.de/ivsg/", [["section_2_1", "https://www.gesetze-im-internet.de/ivsg/__2.html", "§ 2 Nummer 1", "Section 2(1)"]]),
  german("de_wphg", "Wertpapierhandelsgesetz", "German Securities Trading Act", "https://www.gesetze-im-internet.de/wphg/", [["section_2_22", "https://www.gesetze-im-internet.de/wphg/__2.html", "§ 2 Absatz 22", "Section 2(22)"]]),
  german("de_amg", "Arzneimittelgesetz", "German Medicinal Products Act", "https://www.gesetze-im-internet.de/amg_1976/", [["section_2", "https://www.gesetze-im-internet.de/amg_1976/__2.html", "§ 2", "Section 2"]]),
  german("de_trinkwv", "Trinkwasserverordnung", "German Drinking Water Ordinance", "https://www.gesetze-im-internet.de/trinkwv_2023/", [["section_2_3", "https://www.gesetze-im-internet.de/trinkwv_2023/__2.html", "§ 2 Nummer 3", "Section 2(3)"]]),
  german("de_whg", "Wasserhaushaltsgesetz", "German Federal Water Act", "https://www.gesetze-im-internet.de/whg_2009/", [["section_54_1", "https://www.gesetze-im-internet.de/whg_2009/__54.html", "§ 54 Absatz 1", "Section 54(1)"]]),
  german("de_postg", "Postgesetz", "German Postal Act", "https://www.gesetze-im-internet.de/postg_2024/", [["section_3_15", "https://www.gesetze-im-internet.de/postg_2024/__3.html", "§ 3 Nummer 15", "Section 3(15)"]]),
  german("de_krwg", "Kreislaufwirtschaftsgesetz", "German Circular Economy Act", "https://www.gesetze-im-internet.de/krwg/", [["section_3_14", "https://www.gesetze-im-internet.de/krwg/__3.html", "§ 3 Absatz 14", "Section 3(14)"]]),
  eu("eu_reg_2019_943", "Verordnung (EU) 2019/943", "Regulation (EU) 2019/943", "https://eur-lex.europa.eu/eli/reg/2019/943/oj", [["article_2_8", "Artikel 2 Nummer 8", "Article 2(8)"]]),
  eu("eu_dir_2009_119", "Richtlinie 2009/119/EG", "Directive 2009/119/EC", "https://eur-lex.europa.eu/eli/dir/2009/119/oj", [["article_2_f", "Artikel 2 Buchstabe f", "Article 2(f)"]]),
  eu("eu_reg_300_2008", "Verordnung (EG) Nr. 300/2008", "Regulation (EC) No 300/2008", "https://eur-lex.europa.eu/eli/reg/2008/300/oj", [["article_3_4", "Artikel 3 Nummer 4", "Article 3(4)"]]),
  eu("eu_reg_2017_373", "Durchführungsverordnung (EU) 2017/373", "Implementing Regulation (EU) 2017/373", "https://eur-lex.europa.eu/eli/reg_impl/2017/373/oj", [["article_2_2", "Artikel 2 Nummer 2", "Article 2(2)"]]),
  eu("eu_dir_2011_24", "Richtlinie 2011/24/EU", "Directive 2011/24/EU", "https://eur-lex.europa.eu/eli/dir/2011/24/oj", [["article_3_g", "Artikel 3 Buchstabe g", "Article 3(g)"]]),
  eu("eu_reg_2022_2371", "Verordnung (EU) 2022/2371", "Regulation (EU) 2022/2371", "https://eur-lex.europa.eu/eli/reg/2022/2371/oj", [["article_15", "Artikel 15", "Article 15"]]),
  eu("eu_reg_2022_123", "Verordnung (EU) 2022/123", "Regulation (EU) 2022/123", "https://eur-lex.europa.eu/eli/reg/2022/123/oj", [["article_22", "Artikel 22", "Article 22"]]),
  eu("eu_nace_rev_2", "Verordnung (EG) Nr. 1893/2006 (NACE Rev. 2)", "Regulation (EC) No 1893/2006 (NACE Rev. 2)", "https://eur-lex.europa.eu/eli/reg/2006/1893/oj", [["division_20", "Anhang I, Abteilung 20", "Annex I, division 20"], ["division_21", "Anhang I, Abteilung 21", "Annex I, division 21"], ["division_26", "Anhang I, Abteilung 26", "Annex I, division 26"], ["division_27", "Anhang I, Abteilung 27", "Annex I, division 27"], ["division_28", "Anhang I, Abteilung 28", "Annex I, division 28"], ["division_29", "Anhang I, Abteilung 29", "Annex I, division 29"], ["division_30", "Anhang I, Abteilung 30", "Annex I, division 30"]]),
  eu("eu_reach", "Verordnung (EG) Nr. 1907/2006 (REACH)", "Regulation (EC) No 1907/2006 (REACH)", "https://eur-lex.europa.eu/eli/reg/2006/1907/oj", [["article_3_9", "Artikel 3 Nummer 9", "Article 3(9)"], ["article_3_11", "Artikel 3 Nummer 11", "Article 3(11)"], ["article_6", "Artikel 6", "Article 6"]]),
  eu("eu_reg_178_2002", "Verordnung (EG) Nr. 178/2002", "Regulation (EC) No 178/2002", "https://eur-lex.europa.eu/eli/reg/2002/178/oj", [["article_3_2", "Artikel 3 Nummer 2", "Article 3(2)"]]),
  eu("eu_reg_2017_745", "Verordnung (EU) 2017/745", "Regulation (EU) 2017/745", "https://eur-lex.europa.eu/eli/reg/2017/745/oj", [["article_2_30", "Artikel 2 Nummer 30", "Article 2(30)"]]),
  eu("eu_reg_2017_746", "Verordnung (EU) 2017/746", "Regulation (EU) 2017/746", "https://eur-lex.europa.eu/eli/reg/2017/746/oj", [["article_2_23", "Artikel 2 Nummer 23", "Article 2(23)"]]),
];

function german(
  code: string,
  titleDe: string,
  titleEn: string,
  officialSourceUrl: string,
  provisions: Array<[string, string, string, string]>,
): InstrumentDefinition {
  return {
    code,
    jurisdictionCode: "DE",
    instrumentType: "statute_or_regulation",
    versionLabel: "official-reviewed-2026-07-16",
    officialIdentifier: titleDe,
    officialSourceUrl,
    titleDe,
    titleEn,
    provisions: provisions.map(([provisionCode, url, de, en]) => ({ code: provisionCode, url, de, en })),
  };
}

function eu(
  code: string,
  titleDe: string,
  titleEn: string,
  officialSourceUrl: string,
  provisions: Array<[string, string, string]>,
): InstrumentDefinition {
  return {
    code,
    jurisdictionCode: "EU",
    instrumentType: "eu_act",
    versionLabel: "official-journal",
    officialIdentifier: titleEn,
    officialSourceUrl,
    titleDe,
    titleEn,
    provisions: provisions.map(([provisionCode, de, en]) => ({
      code: provisionCode,
      url: officialSourceUrl,
      de,
      en,
    })),
  };
}
