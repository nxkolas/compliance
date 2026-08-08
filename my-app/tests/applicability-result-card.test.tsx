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
  outputRevisionId: "00000000-0000-4000-8000-000000000020",
  outputRevisionNumber: 1,
  createdAt: "2026-07-25T12:00:00.000Z",
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
  definition: {
    hash: "definition-hash",
    versionLabel: "2026-v1",
    isOutdated: false,
    supportedJurisdictionCodes: ["DE"],
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
    definition: {
      ...result.definition,
      supportedJurisdictionCodes: ["DE"],
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
    expect(html).toContain("data-unsupported-country-alert");
    expect(html).toContain("-mt-[14px] rounded-lg p-4");
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
  it.each([
    [
      "essential_entity",
      "border-[rgba(70,169,90,0.70)]",
      "border-[rgba(70,169,90,0.60)]",
    ],
    [
      "important_entity",
      "border-[rgba(255,210,109,0.70)]",
      "border-[rgba(234,180,70,0.60)]",
    ],
    [
      "not_directly_in_scope",
      "border-[rgba(217,96,94,0.70)]",
      "border-[rgba(217,96,94,0.60)]",
    ],
    [
      "clarification_required",
      "border-[#6C4275]",
      "border-[rgba(178,25,248,0.60)]",
    ],
  ] as const)(
    "keeps the %s outcome border above the shared card border",
    (outcome, expectedBorderClass, expectedMetricBorderClass) => {
      const html = renderOutcome(outcome, "en");
      const cardClassNames = Array.from(
        html.matchAll(/data-slot="card" class="([^"]*)"/g),
        (match) => match[1],
      );
      const resultCardClassName = cardClassNames[0] ?? "";
      const metricCardClassNames = cardClassNames.filter((className) =>
        className.includes(expectedMetricBorderClass),
      );

      expect(resultCardClassName).toContain(expectedBorderClass);
      expect(resultCardClassName).toContain("bg-[var(--card)]");
      expect(resultCardClassName).not.toMatch(/(?:^|\s)bg-card(?:\s|$)/);
      expect(metricCardClassNames).toHaveLength(3);
      for (const className of metricCardClassNames) {
        expect(className).not.toMatch(/(?:^|\s)bg-card(?:\s|$)/);
      }
    },
  );

  it("uses the available content width for responsive layout changes", () => {
    const html = renderOutcome("important_entity", "de");

    expect(html).toContain("@container/result-card");
    expect(html).toContain(
      "@5xl/result-card:grid-cols-[minmax(0,1.46fr)_minmax(0,1fr)]",
    );
    expect(html).not.toContain("min-[1280px]");
    expect(html).not.toContain("max-w-[1278.5px]");
  });

  it("renders the meaning dialogue with the supplied speech-bubble colors", () => {
    const html = renderOutcome("important_entity", "de");
    const meaningTitleClass = classNameOfOpeningTagBefore(
      html,
      "Was bedeutet das für Sie?",
      "h2",
    );

    expect(html).toContain("data-applicability-result-speech-bubble");
    expect(html).toContain('viewBox="0 0 761 278"');
    expect(html).toContain('stop-color="#1A2540"');
    expect(html).toContain('stop-color="#111825"');
    expect(html).toContain('stroke="#3D4049"');
    expect(html).toContain("@5xl/result-card:pt-[50px]");
    expect(html).not.toContain("@5xl/result-card:pt-[65px]");
    expect(meaningTitleClass).toContain("text-card-foreground");
  });

  it("positions the not-in-scope speech-bubble content slightly lower", () => {
    const html = renderOutcome("not_directly_in_scope", "de");

    expect(html).toContain("@5xl/result-card:px-[58px]");
    expect(html).toContain("@5xl/result-card:pt-[80px]");
    expect(html).toContain("@5xl/result-card:pb-[20px]");
  });

  it("positions the clarification speech-bubble content lower", () => {
    const html = renderOutcome("clarification_required", "de");

    expect(html).toContain("@5xl/result-card:px-[58px]");
    expect(html).toContain("@5xl/result-card:pt-[60px]");
    expect(html).toContain("@5xl/result-card:pb-[20px]");
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
    "shows the recalculation CTA only for clarification-required in $locale",
    ({ locale, outcome }) => {
      const html = renderOutcome(outcome, locale);
      const recalculateLabel =
        locale === "en"
          ? "Recalculate applicability check"
          : "Betroffenheitscheck neu berechnen";

      if (outcome === "clarification_required") {
        expect(html).toContain('href="/new"');
        expect(html).toContain(recalculateLabel);
        const recalculateButtonClass = classNameOfOpeningTagBefore(
          html,
          recalculateLabel,
          "a",
        );
        expect(recalculateButtonClass).toContain("justify-center");
        expect(recalculateButtonClass).toContain("gap-2");
        expect(recalculateButtonClass).toContain("px-5");
      } else {
        expect(html).not.toContain('href="/new"');
        expect(html).not.toContain(recalculateLabel);
      }
    },
  );

  it.each(outcomeCases)(
    "keeps all three metric cards equally sized for $outcome in $locale",
    ({ locale, outcome }) => {
      const html = renderOutcome(outcome, locale);

      expect(html).toContain(
        "auto-rows-fr grid-cols-1 gap-4 @3xl/result-card:grid-cols-3",
      );

      const metricCardClasses = Array.from(
        html.matchAll(
          /<div data-slot="card" class="([^"]*\bh-full\b[^"]*\bmin-h-24\b[^"]*)"/g,
        ),
        (match) => match[1],
      );

      expect(metricCardClasses).toHaveLength(3);
      expect(metricCardClasses.every((classes) => classes.includes("h-full"))).toBe(
        true,
      );
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
