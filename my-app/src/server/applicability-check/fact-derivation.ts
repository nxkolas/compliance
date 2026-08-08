import type { RuntimeReleaseQuestion } from "@/src/server/compliance/runtime-release/types";
import type { ApplicabilityAnswerValue } from "./question-visibility";

type FactMappingQuestion = Pick<RuntimeReleaseQuestion, "id" | "factMappings">;

/**
 * Derives language-neutral decisive facts from answered questions.
 *
 * The wizard questions carry per-option fact mappings (`byOption`): a single
 * answer such as "the organisation operates a critical installation in
 * Germany" expands into the equivalent `eu_activity`, `jurisdiction_country`,
 * `jurisdiction_basis`, `member_state_designation`, entity, and size facts so
 * the unchanged evaluator produces the matching outcome. Questions without a
 * per-option mapping write their raw answer value to the mapped fact.
 */
export function deriveFactsForAnswers(
  questions: FactMappingQuestion[],
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
): Record<string, unknown> {
  const facts: Record<string, unknown> = {};

  for (const question of questions) {
    const value = answers[question.id];
    if (value === undefined) continue;

    for (const mapping of question.factMappings) {
      if (!mapping.byOption) {
        facts[mapping.factKey] = value;
        continue;
      }

      const selected = Array.isArray(value) ? value : [value];
      const collected: string[] = [];
      let producesArray = Array.isArray(value);
      for (const selectedValue of selected) {
        const mapped = mapping.byOption[selectedValue];
        if (mapped === undefined || mapped === null) continue;
        if (Array.isArray(mapped)) {
          producesArray = true;
          collected.push(...mapped);
        } else {
          collected.push(mapped);
        }
      }
      if (collected.length === 0) continue;

      const unique = [...new Set(collected)];
      if (unique.includes("none_of_these") && unique.length > 1) {
        unique.splice(unique.indexOf("none_of_these"), 1);
      }
      facts[mapping.factKey] =
        producesArray || unique.length > 1 ? unique : unique[0];
    }
  }

  return facts;
}
