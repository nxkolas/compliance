export const GAP_GROUNDING_INSTRUCTION = [
  "Return a findings object with exactly one property for every query-unit ID.",
  "Use each query-unit ID as its property name.",
  "Cite supplied legal authority for every finding.",
  "Questionnaire assertions may support the compliance status, but they are not organization-document evidence.",
  "Evaluate status and evidenceSufficiency independently.",
  "Never invent organization evidence or citation IDs.",
  "Explain interpreted questionnaire/status disagreements in questionnaireDisagreements without treating them as contradictions.",
  "Surface contradictions and set requiresReview=true.",
].join(" ");

export function gapOutputLocaleInstruction(locale: "de" | "en") {
  const language = locale === "de" ? "German" : "English";
  return [
    `Write every free-form string in assumptions, contradictions, and questionnaireDisagreements in ${language}.`,
    "Keep citation IDs unchanged.",
    "Continue to populate both de and en for rationale and recommendation.",
  ].join(" ");
}
