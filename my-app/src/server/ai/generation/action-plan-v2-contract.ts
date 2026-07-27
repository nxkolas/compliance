import { contentHash } from "@/src/server/compliance/domain";

export const ACTION_PLAN_PROMPT_V2_NAME = "nis2_action_plan";
export const ACTION_PLAN_PROMPT_V2_VERSION = "2";
export const ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION = "2";

export function actionPlanPromptV2(locale: "de" | "en") {
  const examples =
    locale === "de"
      ? `Verifikation: "Backup-Wiederherstellung prüfen"; Ergebnis: "Die Wiederherstellbarkeit ist dokumentiert bewertet."`
      : `Verification: "Verify backup restoration"; result: "Restorability has been assessed and documented."`;
  return `Create operational actions for exactly one supplied category and only its supplied gaps.
Category identity, priority, final position, mandatory questionnaire and legal citations, locale, and persistence metadata are server-owned.
Cover every supplied gap. Do not reference another category. Same-kind gaps may be grouped and a confirmed gap may be split into ordered actions.
Use mode "remediation" only for confirmed missing or partial gaps. Use mode "verification" only for uncertain gaps. Never mix uncertain and confirmed gaps in one action.
For verification mode, conditionalRemediation contains only remediation content, or null. The server adds the localized condition.
Titles are imperative and at most 12 words/120 characters. Results are one or two sentences and at most 40 words/320 characters. For verification mode, verificationResult is at most 20 words/160 characters and conditionalRemediation is at most 14 words/100 characters. Evidence names are concrete and at most 12 words/120 characters.
Do not include legal analysis. Mandatory citations are server-owned; select only optional organization-document citation IDs exposed by the schema.
${locale === "de" ? "Schreibe alle Texte auf Deutsch." : "Write all prose in English."} ${examples}
Return only the strict category response object.`;
}

export const ACTION_PLAN_PROMPT_V2_TEMPLATE = actionPlanPromptV2("en");
export const ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH = contentHash({
  en: actionPlanPromptV2("en"),
  de: actionPlanPromptV2("de"),
});

export function actionPlanRepairPromptV2(input: {
  locale: "de" | "en";
  categoryCode: string;
  issues: Array<{ code: string; path: Array<string | number> }>;
}) {
  return `${actionPlanPromptV2(input.locale)}
Repair only category ${input.categoryCode}. Change only fields identified by these stable validation issues:
${JSON.stringify(input.issues)}
Issue code guidance: action_legal_analysis means remove every legal, regulatory, NIS2, statute, or obligation reference and keep only operational work. action_raw_identifier means remove opaque IDs from prose. action_example_leakage means replace a copied example subject such as backup restoration with the supplied gap's own control subject. action_verification_result_state means state the completed, documented outcome of the verification rather than restating that the current state is unclear. action_result_length means shorten the complete result; for verification mode the server adds the conditional prefix, so verificationResult plus conditionalRemediation must use at most 34 words and 270 characters. action_result_sentences means make the complete rendered result one or two sentences. action_title_length and action_evidence_length mean shorten only that field. action_blank, action_multiline, action_evidence_count, action_forbidden_label, and action_content_invalid mean correct that named presentation constraint without changing gap coverage.`;
}
