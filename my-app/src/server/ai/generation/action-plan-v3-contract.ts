import { contentHash } from "@/src/server/compliance/domain";
import type { GenerationIssueCode } from "./diagnostics";

export const ACTION_PLAN_PROMPT_V3_NAME = "nis2_action_plan";
export const ACTION_PLAN_PROMPT_V3_VERSION = "3";
export const ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION = "3";

export function actionPlanPromptV3(locale: "de" | "en") {
  const language =
    locale === "de"
      ? "Schreibe alle Texte auf Deutsch."
      : "Write all prose in English.";
  return `Create operational actions for exactly one supplied category and only its supplied gaps.
Category identity, priority, final position, Gap coverage, action mode eligibility, mandatory citations, locale, and persistence metadata are server-owned.
Cover every supplied gap. Do not reference another category. Same-kind gaps may be grouped and a confirmed gap may be split into ordered actions.
Use mode "remediation" only for confirmed missing or partial gaps. Use mode "verification" only for uncertain gaps. Never mix uncertain and confirmed gaps in one action.
For verification mode, conditionalRemediation contains only remediation content, or null. The server adds the localized condition.
Prefer concise imperative titles, concrete evidence names, and verification-first outcome wording. Avoid legal exposition and do not copy prompt examples. These are writing goals, not runtime response fields.
Mandatory citations are server-owned; select only optional organization-document citation IDs exposed by the schema.
${language}
Return only the strict category response object.`;
}

export const ACTION_PLAN_PROMPT_V3_TEMPLATE = actionPlanPromptV3("en");
export const ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH = contentHash({
  en: actionPlanPromptV3("en"),
  de: actionPlanPromptV3("de"),
});

export function actionPlanRepairPromptV3(input: {
  locale: "de" | "en";
  categoryCode: string;
  issues: Array<{
    code: GenerationIssueCode;
    path: Array<string | number>;
  }>;
}) {
  return `${actionPlanPromptV3(input.locale)}
Repair only category ${input.categoryCode}. The prior complete category object was rejected.
Return the complete corrected category object. Preserve valid structured facts and change only the fields identified by these objective issue codes and paths:
${JSON.stringify(input.issues.map(({ code, path }) => ({ code, path })))}
Do not alter category identity, Gap coverage, action modes, priority, ordering, citations, locale, or other server-owned facts.`;
}
