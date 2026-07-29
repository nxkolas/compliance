import { reliabilityV1GapRelease } from "../reliability-v1/release";
import {
  GAP_PROMPT_V9_NAME,
  GAP_PROMPT_V9_TEMPLATE_HASH,
  GAP_PROMPT_V9_VERSION,
  GAP_RESPONSE_SCHEMA_V9_VERSION,
} from "../../prompt-contract-v9";
import {
  ACTION_PLAN_PROMPT_V3_NAME,
  ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V3_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION,
} from "../../../ai/generation";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV2GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV1GapRelease,
  versionLabel: "reliability-v2",
  prompt: {
    name: GAP_PROMPT_V9_NAME,
    version: GAP_PROMPT_V9_VERSION,
    templateHash: GAP_PROMPT_V9_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V9_VERSION,
  },
  actionPlanPrompt: {
    name: ACTION_PLAN_PROMPT_V3_NAME,
    version: ACTION_PLAN_PROMPT_V3_VERSION,
    templateHash: ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH,
    responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION,
  },
  questionnaire: {
    ...reliabilityV1GapRelease.questionnaire,
    questions: reliabilityV1GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV1GapRelease.requirementSet,
    versionLabel: "reliability-v2",
    requirements: reliabilityV1GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v2",
      }),
    ),
  },
};
