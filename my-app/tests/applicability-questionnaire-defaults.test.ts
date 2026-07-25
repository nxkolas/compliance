import { describe, expect, it, vi } from "vitest";
import { getOrganizationCountryDefault } from "@/src/server/applicability-check/service";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

const countryQuestion = {
  id: "country-question",
  stableKey: "bc.jurisdiction_country",
  position: 2,
  questionText: "Country",
  helpText: null,
  tooltipText: null,
  answerType: "single_choice",
  required: true,
  config: {},
  options: [
    {
      id: "de",
      stableValue: "DE",
      catalogCode: "all",
      label: "Germany",
      position: 1,
      metadata: {},
    },
    {
      id: "fr",
      stableValue: "FR",
      catalogCode: "all",
      label: "France",
      position: 2,
      metadata: {},
    },
    {
      id: "unsure",
      stableValue: "unsure",
      catalogCode: "all",
      label: "Unsure",
      position: 3,
      metadata: {},
    },
  ],
};

describe("applicability questionnaire organization-country defaults", () => {
  it("prefills an offered EU country even when it is unsupported", () => {
    expect(
      getOrganizationCountryDefault({
        questions: [countryQuestion],
        latestAnswers: {},
        organizationCountry: "fr",
      }),
    ).toEqual({ "country-question": "FR" });
  });

  it("does not override a persisted answer", () => {
    expect(
      getOrganizationCountryDefault({
        questions: [countryQuestion],
        latestAnswers: { "country-question": "DE" },
        organizationCountry: "FR",
      }),
    ).toEqual({});
  });

  it.each(["US", "GB", null])(
    "does not synthesize unsure for non-EU country %s",
    (organizationCountry) => {
      expect(
        getOrganizationCountryDefault({
          questions: [countryQuestion],
          latestAnswers: {},
          organizationCountry,
        }),
      ).toEqual({});
    },
  );
});
