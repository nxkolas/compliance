import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { aiPromptVersions } from "@/src/db/schema";
import type { BuiltCompliancePrompt } from "./prompt-builder";

export async function ensurePromptVersion(prompt: BuiltCompliancePrompt) {
  await db
    .insert(aiPromptVersions)
    .values({
      promptName: prompt.promptName,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      assistantMode: prompt.mode,
      template: prompt.system,
      metadata: {
        temperature: prompt.temperature,
        maxOutputTokens: prompt.maxOutputTokens,
      },
    })
    .onConflictDoUpdate({
      target: [aiPromptVersions.promptName, aiPromptVersions.promptVersion],
      set: {
        promptHash: prompt.promptHash,
        template: prompt.system,
        metadata: {
          temperature: prompt.temperature,
          maxOutputTokens: prompt.maxOutputTokens,
        },
      },
    });
}

export async function listPromptVersions() {
  return db.query.aiPromptVersions.findMany({
    orderBy: (prompt, { desc }) => [desc(prompt.createdAt)],
  });
}

export async function getPromptVersion(promptName: string) {
  return db.query.aiPromptVersions.findFirst({
    where: eq(aiPromptVersions.promptName, promptName),
    orderBy: (prompt, { desc }) => [desc(prompt.createdAt)],
  });
}
