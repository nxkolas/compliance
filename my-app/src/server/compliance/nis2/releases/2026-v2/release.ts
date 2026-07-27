import { nis2ReleaseDefinition as previousRelease } from "../2026-v1/release";
import type {
  LegalProvisionSource,
  LocalizedContentSource,
  Nis2ReleaseDefinition,
} from "../types";

type ProvisionDefinition = {
  instrument: "de_bsig" | "eu_nis2";
  code: string;
  url: string;
  de: string;
  en: string;
};

const addedProvisions: ProvisionDefinition[] = [
  bsig("section_30_1", "30", "§ 30 Absatz 1", "Section 30(1)"),
  bsig("section_30_2", "30", "§ 30 Absatz 2", "Section 30(2)"),
  ...Array.from({ length: 10 }, (_, index) =>
    bsig(
      `section_30_2_${index + 1}`,
      "30",
      `§ 30 Absatz 2 Nummer ${index + 1}`,
      `Section 30(2) point ${index + 1}`,
    ),
  ),
  bsig("section_32", "32", "§ 32", "Section 32"),
  bsig("section_38_1", "38", "§ 38 Absatz 1", "Section 38(1)"),
  bsig("section_38_3", "38", "§ 38 Absatz 3", "Section 38(3)"),
  nis2("article_20_1", "Artikel 20 Absatz 1", "Article 20(1)"),
  nis2("article_20_2", "Artikel 20 Absatz 2", "Article 20(2)"),
  nis2("article_21_1", "Artikel 21 Absatz 1", "Article 21(1)"),
  nis2("article_21_2", "Artikel 21 Absatz 2", "Article 21(2)"),
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((letter) =>
    nis2(
      `article_21_2_${letter}`,
      `Artikel 21 Absatz 2 Buchstabe ${letter}`,
      `Article 21(2) point (${letter})`,
    ),
  ),
  nis2("article_21_3", "Artikel 21 Absatz 3", "Article 21(3)"),
  nis2("article_21_4", "Artikel 21 Absatz 4", "Article 21(4)"),
  nis2("article_23", "Artikel 23", "Article 23"),
];

const addedContent: LocalizedContentSource[] = addedProvisions.map(
  (provision) => ({
    stableKey: citationContentKey(provision),
    format: "plain_text",
    translations: { de: provision.de, en: provision.en },
  }),
);

const legalInstruments = previousRelease.legalInstruments.map((instrument) => {
  const additions = addedProvisions.filter(
    (provision) => provision.instrument === instrument.code,
  );
  if (additions.length === 0) return instrument;
  const existingCodes = new Set(
    instrument.provisions.map((provision) => provision.code),
  );
  return {
    ...instrument,
    versionLabel:
      instrument.code === "de_bsig"
        ? "official-reviewed-2026-07-25"
        : instrument.versionLabel,
    provisions: [
      ...instrument.provisions,
      ...additions
        .filter((provision) => !existingCodes.has(provision.code))
        .map(toLegalProvision),
    ],
  };
});

/**
 * Immutable successor to 2026-v1. The applicability model, questionnaire,
 * thresholds, profiles, fixtures, and evaluator remain unchanged; only the
 * versioned legal catalogue is extended for the current guided-v6 Gap release.
 */
export const nis2ReleaseDefinition2026V2: Nis2ReleaseDefinition = {
  ...previousRelease,
  versionLabel: "2026-v2",
  content: [...previousRelease.content, ...addedContent],
  legalInstruments,
};

function bsig(
  code: string,
  section: string,
  de: string,
  en: string,
): ProvisionDefinition {
  return {
    instrument: "de_bsig",
    code,
    url: `https://www.gesetze-im-internet.de/bsig_2025/__${section}.html`,
    de: `BSI-Gesetz, ${de}`,
    en: `German BSI Act, ${en}`,
  };
}

function nis2(code: string, de: string, en: string): ProvisionDefinition {
  return {
    instrument: "eu_nis2",
    code,
    url: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    de: `Richtlinie (EU) 2022/2555, ${de}`,
    en: `Directive (EU) 2022/2555, ${en}`,
  };
}

function citationContentKey(provision: ProvisionDefinition) {
  return `nis2.legal.${provision.instrument}.${provision.code}.citation`;
}

function toLegalProvision(
  provision: ProvisionDefinition,
): LegalProvisionSource {
  return {
    code: provision.code,
    officialSourceUrl: provision.url,
    citationContentKey: citationContentKey(provision),
  };
}
