import { contentHash } from "@/src/server/compliance/domain";
import { GAP_GROUNDING_INSTRUCTION } from "../gap-analysis/domain";

export const ACTION_PLAN_PROMPT_NAME = "nis2_action_plan";
export const ACTION_PLAN_PROMPT_VERSION = "1";
export const ACTION_PLAN_RESPONSE_SCHEMA_VERSION = "1";

export const ACTION_PLAN_PROMPT_TEMPLATE = `Create a practical Action Plan only for the finalized atomic gaps and full category context supplied by the server.
Never create an action unrelated to a supplied gap and never move or combine work across category boundaries.
Within one category, you may combine several gaps into one action or split one gap into several ordered actions.
Cover every supplied gap with at least one action. Every action must reference at least one supplied gap. Return at most ten actions per category.
Respect satisfied controls in the full category context and do not contradict or repeat them as work.
Each action contains only a short imperative title of at most 12 words and 120 characters, a plain-language result of one or two sentences and at most 40 words and 320 characters, one to five concrete recommended evidence names of at most 12 words and 120 characters each, opaque gap keys, and supporting citations.
Do not return priority, status, owner, due date, execution notes, recommendations, objectives, deliverables, acceptance criteria, category metadata, or database identifiers.
For an uncertain gap, begin with verification. State remediation only as conditional on verification identifying a deficiency.
When uncertain work is split, order verification first and make every later remediation action explicitly conditional.
For uncertain work, begin the verification title with Verify, Determine, Confirm, Assess, Check, Document, or Review. The result must explicitly say that any remediation depends on an identified or confirmed deficiency.
Write every generated prose field in the pinned output locale.
${GAP_GROUNDING_INSTRUCTION}
Return exactly the requested strict category keys and no fields outside the response schema.`;

export const ACTION_PLAN_PROMPT_TEMPLATE_HASH = contentHash(
  ACTION_PLAN_PROMPT_TEMPLATE,
);

export function buildActionPlanCategoryQuery(input: {
  requirement: {
    code: string;
    title: string;
    requirementText: string;
  };
  gaps: Array<{ key: string; kind: string; statement: string }>;
  questionsAndAnswers: Array<{
    question: string;
    answer: string;
    satisfied: boolean;
  }>;
}) {
  return JSON.stringify(input);
}
