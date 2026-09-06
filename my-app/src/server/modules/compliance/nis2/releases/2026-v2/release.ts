import { nis2ReleaseDefinition as previousRelease } from "../2026-v1/release";
import type { LegalProvisionSource, Nis2ReleaseDefinition } from "../types";

type ProvisionDefinition = {
  instrument: "de_bsig" | "eu_nis2";
  code: string;
  url: string;
};

const addedProvisions: ProvisionDefinition[] = [
  bsig("section_30_1", "30"),
  bsig("section_30_2", "30"),
  ...Array.from({ length: 10 }, (_, index) =>
    bsig(`section_30_2_${index + 1}`, "30"),
  ),
  bsig("section_32", "32"),
  bsig("section_38_1", "38"),
  bsig("section_38_3", "38"),
  nis2("article_20_1"),
  nis2("article_20_2"),
  nis2("article_21_1"),
  nis2("article_21_2"),
  ...["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((letter) =>
    nis2(`article_21_2_${letter}`),
  ),
  nis2("article_21_3"),
  nis2("article_21_4"),
  nis2("article_23"),
];

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
  legalInstruments,
};

function bsig(code: string, section: string): ProvisionDefinition {
  return {
    instrument: "de_bsig",
    code,
    url: `https://www.gesetze-im-internet.de/bsig_2025/__${section}.html`,
  };
}

function nis2(code: string): ProvisionDefinition {
  return {
    instrument: "eu_nis2",
    code,
    url: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
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
