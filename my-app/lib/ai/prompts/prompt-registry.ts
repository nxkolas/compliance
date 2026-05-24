import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { aiPromptVersions } from "@/src/db/schema";
import type { BuiltCompliancePrompt } from "./prompt-builder";

/**
 * Upserts the exact prompt template/version used for an answer. This gives
 * saved assistant messages an auditable prompt hash and version target.
 */
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

/**
 * Lists stored prompt versions for the debug page.
 */
export async function listPromptVersions() {
  return db.query.aiPromptVersions.findMany({
    orderBy: (prompt, { desc }) => [desc(prompt.createdAt)],
  });
}

/**
 * Loads the newest stored version for one prompt name.
 */
export async function getPromptVersion(promptName: string) {
  return db.query.aiPromptVersions.findFirst({
    where: eq(aiPromptVersions.promptName, promptName),
    orderBy: (prompt, { desc }) => [desc(prompt.createdAt)],
  });
}
