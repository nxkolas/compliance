export const GAP_GROUNDING_INSTRUCTION = [
  "Return a findings object with exactly one property for every query-unit ID.",
  "Use each query-unit ID as its property name.",
  "Cite supplied legal authority for every finding.",
  "Questionnaire assertions may support the compliance status, but they are not organization-document evidence.",
  "Evaluate status and evidenceSufficiency independently.",
  "Never invent organization evidence or citation IDs.",
  "Surface contradictions and set requiresReview=true.",
].join(" ");
