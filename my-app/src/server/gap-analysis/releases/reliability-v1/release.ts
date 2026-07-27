import { guidedV6GapRelease } from "../guided-v6/release";
import {
  GAP_PROMPT_V8_NAME,
  GAP_PROMPT_V8_TEMPLATE_HASH,
  GAP_PROMPT_V8_VERSION,
  GAP_RESPONSE_SCHEMA_V8_VERSION,
} from "../../prompt-contract-v8";
import {
  ACTION_PLAN_PROMPT_V2_NAME,
  ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V2_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION,
} from "../../../ai/generation";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV1GapRelease: GapAnalysisReleaseDefinition = {
  ...guidedV6GapRelease,
  versionLabel: "reliability-v1",
  prompt: {
    name: GAP_PROMPT_V8_NAME,
    version: GAP_PROMPT_V8_VERSION,
    templateHash: GAP_PROMPT_V8_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V8_VERSION,
  },
  actionPlanPrompt: {
    name: ACTION_PLAN_PROMPT_V2_NAME,
    version: ACTION_PLAN_PROMPT_V2_VERSION,
    templateHash: ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
    responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION,
  },
  questionnaire: {
    ...guidedV6GapRelease.questionnaire,
    questions: guidedV6GapRelease.questionnaire.questions.map((question) => ({
      ...question,
    })),
  },
  requirementSet: {
    ...guidedV6GapRelease.requirementSet,
    versionLabel: "reliability-v1",
    requirements: guidedV6GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v1",
      }),
    ),
  },
};
