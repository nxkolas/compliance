import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import type { ApplicabilityResultDto } from "@/src/server/applicability-check/service";
import { storedApplicabilityResult } from "./support/stored-applicability-result";

type Outcome = ApplicabilityResultDto["result"]["outcome"];

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

const longEntityLabels = {
  de: "Post- oder Kurierdienstanbieter und Cloud-Computing-Dienstanbieter mit einem besonders langen Namen",
  en: "Postal or courier service provider and cloud computing service provider with a deliberately long name",
};

const longReasons = {
  de: "Ihr Unternehmen erfüllt nach den angegebenen Informationen mehrere relevante Größenkriterien für eine direkte Einstufung nach NIS2.",
  en: "Based on the information provided, the organization meets several relevant size criteria for a direct NIS2 classification.",
};

const outcomeLabels: Record<Outcome, { de: string; en: string }> = {
  essential_entity: {
    de: "Wesentliche Einrichtung",
    en: "Essential entity",
  },
  important_entity: {
    de: "Wichtige Einrichtung",
    en: "Important entity",
  },
  not_directly_in_scope: {
    de: "Nicht direkt im Anwendungsbereich",
    en: "Not directly in scope",
  },
  clarification_required: {
    de: "Klärung erforderlich",
    en: "Clarification required",
  },
};

const outcomeSummaries: Record<Outcome, { de: string; en: string }> = {
  essential_entity: {
    de: "Ihr Unternehmen fällt direkt in den Anwendungsbereich und gehört zu einer besonders relevanten Einrichtungsgruppe.",
    en: "Based on the information provided, your organization is likely directly in scope of NIS2 as an essential entity.",
  },
  important_entity: {
    de: "Ihr Unternehmen fällt nach den angegebenen Informationen voraussichtlich direkt als wichtige Einrichtung in den Anwendungsbereich der NIS2-Regelungen.",
    en: "Based on the information provided, your organization is likely directly in scope of NIS2 as an important entity.",
  },
  not_directly_in_scope: {
    de: "Auf Grundlage Ihrer Angaben besteht voraussichtlich keine unmittelbare gesetzliche NIS2-Betroffenheit. Indirekte Anforderungen können dennoch bestehen.",
    en: "Based on your information, there is likely no immediate statutory NIS2 applicability. Indirect requirements may still apply.",
  },
  clarification_required: {
    de: "Eine eindeutige Einstufung ist anhand Ihrer Angaben nicht möglich. Einzelne Punkte müssen genauer geprüft werden.",
    en: "A clear classification is not possible from the information provided. Individual points require further review.",
  },
};

const outcomeCases = (
  Object.keys(outcomeLabels) as Array<Outcome>
).flatMap((outcome) =>
  (["de", "en"] as const).map((locale) => ({
    locale,
    outcome,
    shouldShowGapCta:
      outcome === "essential_entity" || outcome === "important_entity",
  })),
);

function applicabilityResultFor(outcome: Outcome): ApplicabilityResultDto {
  return {
    ...result,
    evidence: storedApplicabilityResult({
      outcome,
      countryCode: "DE",
    }),
    result: {
      ...result.result,
      outcome,
      label: outcomeLabels[outcome].de,
      labelEn: outcomeLabels[outcome].en,
      reasons: [longReasons.de],
      reasonsEn: [longReasons.en],
      jurisdiction: {
        countryCode: "DE",
        countryProfileVersion: "de-profile-2026",
      },
      sizeClassification: "medium",
      matchedEntityTypes: [
        {
          code: "long_entity_type",
          label: longEntityLabels.de,
          labelEn: longEntityLabels.en,
          legalReference: "NIS2 Annex",
        },
      ],
      unresolvedFacts: [],
      unresolvedFactsEn: [],
      disclaimer: "Automatisierte Einstufung",
      disclaimerEn: "Automated classification",
    },
    release: {
      ...result.release,
      supportedCountryCodes: ["DE"],
    },
  };
}

function renderOutcome(outcome: Outcome, locale: "de" | "en") {
  return renderToStaticMarkup(
    <ApplicabilityResultCard
      result={applicabilityResultFor(outcome)}
      locale={locale}
      labels={labels}
      title={outcomeLabels[outcome][locale]}
      startCurrentHref="/new"
      gapAnalysisHref="/gap-analysis"
    />,
  );
}

function classNameOfOpeningTagBefore(
  html: string,
  text: string,
  tagName: string,
) {
  const textIndex = html.indexOf(text);
  expect(textIndex, `Expected rendered text: ${text}`).toBeGreaterThan(-1);

  const tagStart = html.lastIndexOf(`<${tagName}`, textIndex);
  expect(tagStart, `Expected a <${tagName}> containing: ${text}`).toBeGreaterThan(
    -1,
  );

  const tagEnd = html.indexOf(">", tagStart);
  const openingTag = html.slice(tagStart, tagEnd + 1);
  return openingTag.match(/\bclass="([^"]*)"/)?.[1] ?? "";
}

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

  it("does not offer Gap Analysis when the country profile is unsupported", () => {
    const unsupportedEssential = {
      ...applicabilityResultFor("essential_entity"),
      evidence: storedApplicabilityResult({
        outcome: "essential_entity",
        countryCode: "FR",
        unresolvedFactCodes: ["unresolved_unsupported_profile"],
      }),
    } as ApplicabilityResultDto;
    const html = renderToStaticMarkup(
      <ApplicabilityResultCard
        result={unsupportedEssential}
        locale="en"
        labels={labels}
        title="Essential entity"
        startCurrentHref="/new"
        gapAnalysisHref="/gap-analysis"
      />,
    );

    expect(html).toContain("This country is not supported yet");
    expect(html).not.toContain('href="/gap-analysis"');
  });
});

describe("applicability result outcomes", () => {
  it("uses the available content width for responsive layout changes", () => {
    const html = renderOutcome("important_entity", "de");

    expect(html).toContain("@container/result-card");
    expect(html).toContain(
      "@5xl/result-card:grid-cols-[minmax(0,1.46fr)_minmax(0,1fr)]",
    );
    expect(html).not.toContain("min-[1280px]");
    expect(html).not.toContain("max-w-[1278.5px]");
  });

  it.each(outcomeCases)(
    "renders $outcome in $locale with the correct Gap Analysis CTA eligibility",
    ({ locale, outcome, shouldShowGapCta }) => {
      const html = renderOutcome(outcome, locale);
      const ctaLabel =
        locale === "en" ? "Start Gap Analysis" : "Gap-Analyse starten";

      expect(html).toContain(outcomeLabels[outcome][locale]);
      expect(html).toContain(longReasons[locale]);

      if (shouldShowGapCta) {
        expect(html).toContain('href="/gap-analysis"');
        expect(html).toContain(ctaLabel);
      } else {
        expect(html).not.toContain('href="/gap-analysis"');
        expect(html).not.toContain(ctaLabel);
      }
    },
  );

  it.each(outcomeCases)(
    "allows long result content to wrap for $outcome in $locale",
    ({ locale, outcome }) => {
      const html = renderOutcome(outcome, locale);
      const entityValueClass = classNameOfOpeningTagBefore(
        html,
        longEntityLabels[locale],
        "p",
      );
      const reasonItemClass = classNameOfOpeningTagBefore(
        html,
        longReasons[locale],
        "li",
      );
      const summaryClass = classNameOfOpeningTagBefore(
        html,
        outcomeSummaries[outcome][locale],
        "p",
      );

      expect(entityValueClass).not.toMatch(/\b(?:whitespace|text)-nowrap\b/);
      expect(reasonItemClass).not.toMatch(/\b(?:whitespace|text)-nowrap\b/);
      expect(summaryClass).not.toMatch(/\b(?:whitespace|text)-nowrap\b/);
    },
  );
});
