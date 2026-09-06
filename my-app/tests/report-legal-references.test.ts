import { describe, expect, it } from "vitest";
import { buildLegalReferenceResolver } from "@/src/server/modules/reports/legal-references";
import {
  formatLegalCitations,
  legalCitationContentKey,
  splitLegalCitation,
} from "@/src/server/modules/compliance/legal-citation";
import { getCurrentGapDefinition } from "@/src/server/modules/gap-analysis/release/current";

describe("legalCitationContentKey", () => {
  it("derives the release content key from a provision key", () => {
    expect(legalCitationContentKey("de_bsig.section_30_2_1")).toBe(
      "nis2.legal.de_bsig.section_30_2_1.citation",
    );
  });

  it("rejects keys without an instrument prefix", () => {
    expect(legalCitationContentKey("section_30")).toBeNull();
    expect(legalCitationContentKey(".section_30")).toBeNull();
  });
});

describe("splitLegalCitation", () => {
  it("separates the instrument from the provision", () => {
    expect(splitLegalCitation("BSI-Gesetz, § 30 Absatz 2 Nummer 1")).toEqual({
      instrument: "BSI-Gesetz",
      provision: "§ 30 Absatz 2 Nummer 1",
    });
  });

  it("keeps an unstructured label as the provision", () => {
    expect(splitLegalCitation("de_bsig.section_30")).toEqual({
      instrument: "",
      provision: "de_bsig.section_30",
    });
  });
});

describe("buildLegalReferenceResolver", () => {
  it("resolves a provision key to its localized citation", () => {
    const de = buildLegalReferenceResolver("de");
    const en = buildLegalReferenceResolver("en");

    expect(de.forProvisionKey("de_bsig.section_30_2_1")).toEqual({
      instrument: "BSI-Gesetz",
      provision: "§ 30 Absatz 2 Nummer 1",
    });
    expect(en.forProvisionKey("de_bsig.section_30_2_1")).toEqual({
      instrument: "German BSI Act",
      provision: "Section 30(2) point 1",
    });
  });

  it("derives paragraph-level citations for a Gap requirement", () => {
    const resolver = buildLegalReferenceResolver("de");
    const [requirement] = getCurrentGapDefinition("de").requirements;

    const references = resolver.forRequirement(requirement.code);

    expect(references.length).toBeGreaterThan(0);
    expect(references.some((reference) => reference.provision.includes("§"))).toBe(true);
  });

  it("collapses repeated instruments when formatting", () => {
    expect(
      formatLegalCitations([
        { instrument: "BSI-Gesetz", provision: "§ 30 Absatz 1" },
        { instrument: "BSI-Gesetz", provision: "§ 38 Absatz 1" },
        { instrument: "BSI-Gesetz", provision: "§ 30 Absatz 1" },
        { instrument: "Richtlinie (EU) 2022/2555", provision: "Artikel 20 Absatz 1" },
      ]),
    ).toBe(
      "BSI-Gesetz: § 30 Absatz 1, § 38 Absatz 1 · Richtlinie (EU) 2022/2555: Artikel 20 Absatz 1",
    );
  });

  it("gives every requirement in the current release a legal basis", () => {
    const resolver = buildLegalReferenceResolver("de");
    const { requirements } = getCurrentGapDefinition("de");

    for (const requirement of requirements) {
      expect(
        resolver.forRequirement(requirement.code),
        `requirement ${requirement.code} has no legal reference`,
      ).not.toHaveLength(0);
    }
  });

  it("falls back to the raw key for an unknown provision", () => {
    const resolver = buildLegalReferenceResolver("de");
    expect(resolver.forProvisionKey("de_bsig.section_does_not_exist")).toEqual({
      instrument: "",
      provision: "de_bsig.section_does_not_exist",
    });
    expect(resolver.forRequirement("does_not_exist")).toEqual([]);
  });
});
