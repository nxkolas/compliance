import { guidedV6GapRelease } from "./releases/guided-v6/release";
import type { GapAnalysisReleaseDefinition } from "./releases/types";
import {
  GAP_PROMPT_NAME,
  GAP_PROMPT_TEMPLATE,
  GAP_PROMPT_TEMPLATE_HASH,
  GAP_PROMPT_VERSION,
  GAP_RESPONSE_SCHEMA_VERSION,
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapQuery,
  buildAtomicGapRetrievalQuery,
  gapPrompt,
  gapRepairPrompt,
} from "./prompt-contract";
import {
  buildGapCategoryResponseSchema,
  defaultGapStatementMaximum,
  deriveAtomicGapKind,
  normalizeGapCategoryResponse,
  type AtomicGapKind,
  type GapCategoryResponse,
  type GapResponsePolicy,
  type GapStatementBasis,
  type GapStatementSemanticContext,
  type ValidatedCategoryGapResult,
} from "./generation-schema";
import { CURRENT_ACTION_PLAN_PROMPT_METADATA } from "../action-plans/current-contract";

export const CURRENT_GAP_PROMPT_METADATA = {
  name: GAP_PROMPT_NAME,
  version: GAP_PROMPT_VERSION,
  templateHash: GAP_PROMPT_TEMPLATE_HASH,
  responseSchemaVersion: GAP_RESPONSE_SCHEMA_VERSION,
} as const;

/** The single executable Gap definition selected by deployed code. */
export const currentGapContractDefinition: GapAnalysisReleaseDefinition = {
  ...guidedV6GapRelease,
  versionLabel: "reliability-v8",
  prompt: CURRENT_GAP_PROMPT_METADATA,
  actionPlanPrompt: CURRENT_ACTION_PLAN_PROMPT_METADATA,
  questionnaire: {
    ...guidedV6GapRelease.questionnaire,
    questions: guidedV6GapRelease.questionnaire.questions.map((question) => ({
      ...question,
    })),
  },
  requirementSet: {
    ...guidedV6GapRelease.requirementSet,
    versionLabel: "reliability-v8",
    requirements: guidedV6GapRelease.requirementSet.requirements.map(
      (requirement) => ({ ...requirement, versionLabel: "reliability-v8" }),
    ),
  },
};

export {
  GAP_PROMPT_TEMPLATE,
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapQuery,
  buildAtomicGapRetrievalQuery,
  buildGapCategoryResponseSchema,
  defaultGapStatementMaximum,
  deriveAtomicGapKind,
  gapPrompt,
  gapRepairPrompt,
  normalizeGapCategoryResponse,
};

export type {
  AtomicGapKind,
  GapCategoryResponse,
  GapResponsePolicy,
  GapStatementBasis,
  GapStatementSemanticContext,
  ValidatedCategoryGapResult,
};
