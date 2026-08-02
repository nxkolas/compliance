import { guidedV6GapRelease } from "./releases/guided-v6/release";
import type { GapAnalysisReleaseDefinition } from "./releases/types";
import {
  GAP_PROMPT_V12_NAME,
  GAP_PROMPT_V12_TEMPLATE,
  GAP_PROMPT_V12_TEMPLATE_HASH,
  GAP_PROMPT_V12_VERSION,
  GAP_RESPONSE_SCHEMA_V12_VERSION,
  gapPromptV12,
  gapRepairPromptV12,
} from "./prompt-contract-v12";
import {
  buildGapCategoryResponseSchemaV12,
  normalizeGapCategoryResponseV12,
  type GapCategoryResponseV12,
  type GapResponsePolicyV12,
  type GapStatementSemanticContext,
} from "./generation-schema-v12";
import { CURRENT_ACTION_PLAN_PROMPT_METADATA } from "../action-plans/current-contract";
import {
  deriveAtomicGapKind,
  type AtomicGapKind,
  type GapStatementBasis,
  type ValidatedCategoryGapResult,
} from "./generation-schema-v7";
import { defaultGapStatementMaximum } from "./generation-schema-v8";
import {
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapQuery,
  buildAtomicGapRetrievalQuery,
} from "./prompt-contract-v7";

export const CURRENT_GAP_PROMPT_METADATA = {
  name: GAP_PROMPT_V12_NAME,
  version: GAP_PROMPT_V12_VERSION,
  templateHash: GAP_PROMPT_V12_TEMPLATE_HASH,
  responseSchemaVersion: GAP_RESPONSE_SCHEMA_V12_VERSION,
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

export const gapPrompt = gapPromptV12;
export const gapRepairPrompt = gapRepairPromptV12;
export const GAP_PROMPT_TEMPLATE = GAP_PROMPT_V12_TEMPLATE;
export const buildGapCategoryResponseSchema = buildGapCategoryResponseSchemaV12;
export const normalizeGapCategoryResponse = normalizeGapCategoryResponseV12;
export {
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapQuery,
  buildAtomicGapRetrievalQuery,
  defaultGapStatementMaximum,
  deriveAtomicGapKind,
};

export type GapCategoryResponse = GapCategoryResponseV12;
export type GapResponsePolicy = GapResponsePolicyV12;
export type { GapStatementSemanticContext };
export type { AtomicGapKind, GapStatementBasis, ValidatedCategoryGapResult };
