import type { Locale } from "@/lib/i18n-config";
import {
  legalCitationLabel,
  splitLegalCitation,
  type LegalCitation,
} from "@/src/server/compliance/legal-citation";
import { getCurrentApplicabilityDefinition } from "@/src/server/definitions/applicability";
import { getCurrentGapDefinition } from "@/src/server/definitions/gap";

export type LegalReferenceResolver = {
  /**
   * Localized citations for a Gap requirement, e.g.
   * `{ instrument: "BSI-Gesetz", provision: "§ 30 Absatz 2 Nummer 1" }`.
   */
  forRequirement(requirementKey: string): LegalCitation[];
  /** Localized citation for a single provision key from retrieval metadata. */
  forProvisionKey(provisionKey: string): LegalCitation;
};

/**
 * Gap findings do not store a legal reference. The requirement catalogue does:
 * every requirement lists the questions it is derived from, and every question
 * carries the provision keys it implements. Resolving that chain gives a stable
 * paragraph-level citation for each finding without touching the schema.
 */
export function buildLegalReferenceResolver(locale: Locale): LegalReferenceResolver {
  const gapDefinition = getCurrentGapDefinition(locale);
  const { contentByStableKey } = getCurrentApplicabilityDefinition(locale);

  const provisionKeysByQuestion = new Map(
    gapDefinition.questions.map((question) => [
      question.stableKey,
      question.legalProvisions.map((provision) => provision.key),
    ]),
  );

  const provisionKeysByRequirement = new Map(
    gapDefinition.requirements.map((requirement) => [
      requirement.code,
      distinct(
        requirement.questionStableKeys.flatMap(
          (questionKey) => provisionKeysByQuestion.get(questionKey) ?? [],
        ),
      ),
    ]),
  );

  const citation = (provisionKey: string) =>
    splitLegalCitation(legalCitationLabel(contentByStableKey, provisionKey));

  return {
    forRequirement(requirementKey) {
      return (provisionKeysByRequirement.get(requirementKey) ?? []).map(citation);
    },
    forProvisionKey: citation,
  };
}

function distinct(values: string[]) {
  return [...new Set(values)];
}
