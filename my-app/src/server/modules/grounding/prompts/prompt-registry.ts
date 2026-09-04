import type { BuiltCompliancePrompt } from "./prompt-builder";

export async function ensurePromptVersion(prompt: BuiltCompliancePrompt) {
  return {
    promptName: prompt.promptName,
    promptVersion: prompt.promptVersion,
    promptHash: prompt.promptHash,
  };
}

export async function listPromptVersions() {
  return [];
}

export async function getLatestPromptVersion() {
  return null;
}
