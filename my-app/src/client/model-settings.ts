import * as z from "zod";
import { request } from "./api-client";
import type { OrganizationModelSettingsInput } from "@/src/contracts/organizations/model-settings";

const embeddingChangeSchema = z.object({
  embeddingChange: z.object({
    applied: z.boolean(),
    migrationId: z.string().optional(),
  }),
});

const settingsSchema = z.object({
  settings: z
    .object({
      generationModelId: z.string(),
      generationMaxContextTokens: z.number(),
      generationSupportsStructuredOutputs: z.boolean(),
      generationThinkingStyle: z.string(),
      embeddingModelId: z.string(),
      embeddingDimensions: z.number(),
      embeddingInstructionProfile: z.string(),
    })
    .nullable(),
});

export const modelSettingsClient = {
  get(organizationId: string, signal?: AbortSignal) {
    return request(`/api/organizations/${organizationId}/model-settings`, {
      outputSchema: settingsSchema,
      signal,
    });
  },
  /**
   * Saves the chosen models. `embeddingChange.applied` is false when the
   * embedding model changed and documents had to be rebuilt: the new
   * coordinates take effect only once that re-index finishes.
   */
  save(
    organizationId: string,
    input: OrganizationModelSettingsInput,
    signal?: AbortSignal,
  ) {
    return request(`/api/organizations/${organizationId}/model-settings`, {
      method: "PUT",
      input,
      outputSchema: embeddingChangeSchema,
      signal,
    });
  },
};
