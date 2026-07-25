import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import type { ApplicabilityResultDto } from "@/src/server/applicability-check/service";
import { storedApplicabilityResult } from "./support/stored-applicability-result";

const labels = {
  ruleSet: "Rule set",
  release: "Release",
  outdated: "Outdated",
  startCurrent: "Start current",
  unknown: "Unknown",
  revision: "Revision",
  outcome: "Outcome",
  profile: "Profile",
  jurisdiction: "Jurisdiction",
  size: "Size",
  reasoning: "Reasoning",
  entityTypes: "Entity types",
  legalBasis: "Legal basis",
  unresolved: "Unresolved",
  overlays: "Overlays",
  indirect: "Indirect",
  indirectNone: "None",
  unsupportedCountryTitle: "This country is not supported yet",
  unsupportedCountryBody:
    "Only {countries} is supported. The saved result cannot start Gap Analysis.",
  outcomes: {
    essentialEntity: "Essential",
    importantEntity: "Important",
    notDirectlyInScope: "Not in scope",
    clarificationRequired: "Clarification",
  },
};

const result = {
  artifactRevisionId: "00000000-0000-4000-8000-000000000020",
  artifactRevisionNumber: 1,
  createdAt: "2026-07-25T12:00:00.000Z",
  ruleSetId: "00000000-0000-4000-8000-000000000011",
  ruleSetVersionLabel: "2026-v1",
  assessmentRevisionId: null,
  evidence: storedApplicabilityResult({
    outcome: "clarification_required",
    countryCode: "FR",
    unresolvedFactCodes: ["unresolved_unsupported_profile"],
  }),
  result: {
    outcome: "clarification_required",
    label: "Klärung erforderlich",
    labelEn: "Clarification required",
    reasons: ["Gespeicherte Begründung"],
    reasonsEn: ["Saved reasoning"],
    jurisdiction: {
      countryCode: "FR",
      countryProfileVersion: null,
    },
    sizeClassification: "unknown",
    matchedEntityTypes: [],
    scopeBases: [],
    unresolvedFacts: ["Nationales Profil fehlt"],
    unresolvedFactsEn: ["National profile missing"],
    obligationOverlays: [],
    indirectExposure: {
      status: "none",
      reasons: [],
      reasonsEn: [],
    },
    disclaimer: "Hinweis",
    disclaimerEn: "Notice",
  },
  release: {
    id: "00000000-0000-4000-8000-000000000010",
    versionLabel: "2026-v1",
    isOutdated: false,
    activeVersionLabel: "2026-v1",
    supportedCountryCodes: ["DE"],
  },
} as ApplicabilityResultDto;

describe("unsupported-country applicability result", () => {
  it("shows a release-derived localized support notice and keeps result detail", () => {
    const html = renderToStaticMarkup(
      <ApplicabilityResultCard
        result={result}
        locale="en"
        labels={labels}
        title="Clarification required"
        startCurrentHref="/new"
      />,
    );
    expect(html).toContain("This country is not supported yet");
    expect(html).toContain("Germany");
    expect(html).toContain("Saved reasoning");
    expect(html).toContain("National profile missing");
  });
});
