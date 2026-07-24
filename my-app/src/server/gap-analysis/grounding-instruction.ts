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
    `Write every generated free-form field in ${language}: rationale, recommendation, assumptions, contradictions, and questionnaireDisagreements.`,
    "Keep citation IDs unchanged.",
    "Evidence excerpts are source quotations: they may be in another language and must not be translated, rewritten, or included as generated prose.",
  ].join(" ");
}
