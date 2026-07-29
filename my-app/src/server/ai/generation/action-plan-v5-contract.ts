import { contentHash } from "@/src/server/compliance/domain";
import type { GenerationIssueCode } from "./diagnostics";

export const ACTION_PLAN_PROMPT_V5_NAME = "nis2_action_plan";
export const ACTION_PLAN_PROMPT_V5_VERSION = "5";
export const ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION = "5";

export function actionPlanPromptV5(locale: "de" | "en") {
  const language =
    locale === "de"
      ? "Schreibe alle Texte auf Deutsch."
      : "Write all prose in English.";
  return `Create operational actions for exactly one supplied category and only its supplied gaps.
Category identity, priority, final position, Gap coverage, action mode eligibility, mandatory citations, locale, and persistence metadata are server-owned.
Cover every supplied gap. Do not reference another category. Same-kind gaps may be grouped and a confirmed gap may be split into ordered actions.
Use mode "remediation" only for confirmed missing or partial gaps. Use mode "verification" only for uncertain gaps. Never mix uncertain and confirmed gaps in one action.
For verification mode, conditionalRemediation contains only remediation content, or null. The server adds the localized condition.
Use an imperative title of at most 12 words. Make each result one or two sentences and at most 40 words. Use one to five concrete evidence names, each at most 12 words.
For verification mode, describe the completed, documented verification outcome first; keep any remediation conditional.
Do not name or discuss laws, directives, statutes, articles, sections, obligations, regulators, or citations in customer-visible prose. Write only operational work and outcomes.
These are writing constraints for offline qualification, not additional response fields or runtime lexical gates.
Mandatory citations are server-owned; select only optional organization-document citation IDs exposed by the schema.
Do not put URLs or opaque internal identifiers in customer-visible prose. This includes UUID values, database keys, and citation IDs.
${language}
Return only the strict category response object.`;
}

export const ACTION_PLAN_PROMPT_V5_TEMPLATE = actionPlanPromptV5("en");
export const ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH = contentHash({
  en: actionPlanPromptV5("en"),
  de: actionPlanPromptV5("de"),
});

export function actionPlanRepairPromptV5(input: {
  locale: "de" | "en";
  categoryCode: string;
  issues: Array<{
    code: GenerationIssueCode;
    path: Array<string | number>;
  }>;
}) {
  return `${actionPlanPromptV5(input.locale)}
Repair only category ${input.categoryCode}. The prior complete category object was rejected.
Return the complete corrected category object. Preserve valid structured facts and change only the fields identified by these objective issue codes and paths:
${JSON.stringify(input.issues.map(({ code, path }) => ({ code, path })))}
Issue code guidance: action_raw_identifier means remove every URL, UUID, or opaque internal identifier from the identified customer-visible prose field.
Do not alter category identity, Gap coverage, action modes, priority, ordering, citations, locale, or other server-owned facts.`;
}
