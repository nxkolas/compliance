import { describe, expect, it } from "vitest";
import {
  catalogOptionsForCountry,
  reconcileCatalogAnswers,
} from "@/src/server/applicability-check/entity-catalog";

const options = [
  option("electricity_supplier", "eu_core"),
  option("de_bsig_electricity_supplier", "country:DE"),
  option("none_of_these", "all"),
];

describe("country-specific applicability catalogs", () => {
  it("selects the national catalog when one exists and otherwise uses EU core", () => {
    expect(catalogOptionsForCountry(options, "DE").map((item) => item.stableValue)).toEqual([
      "de_bsig_electricity_supplier",
      "none_of_these",
    ]);
    expect(catalogOptionsForCountry(options, "FR").map((item) => item.stableValue)).toEqual([
      "electricity_supplier",
      "none_of_these",
    ]);
  });

  it("clears stale catalog answers when the country changes", () => {
    const questions = [
      {
        id: "country-question",
        stableKey: "bc.jurisdiction_country",
        options: [],
      },
      {
        id: "entity-question",
        stableKey: "bc.entity_types",
        options,
      },
    ];

    expect(
      reconcileCatalogAnswers(questions, {
        "country-question": "FR",
        "entity-question": ["de_bsig_electricity_supplier"],
      }),
    ).toEqual({ "country-question": "FR" });
  });
});

function option(stableValue: string, catalogCode: string) {
  return { stableValue, catalogCode };
}
