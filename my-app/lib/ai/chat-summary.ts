import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { aiChatSummaries, aiChats, aiMessages } from "@/src/db/schema";
import type { AiProviderMode, ComplianceUIMessage } from "@/lib/ai/types";
import { getComplianceChatModelById, getSmallChatModelId } from "./models";
import { textFromMessage } from "./rag";

const summarizeAfterMessages = 12;

/**
 * Loads the newest durable summary for a chat. The chat route injects this
 * summary into the system prompt so older turns do not need to be resent forever.
 */
export async function getLatestChatSummary({
  chatId,
  organizationId,
}: {
  chatId: string;
  organizationId: string;
}) {
  return db.query.aiChatSummaries.findFirst({
    where: and(
      eq(aiChatSummaries.chatId, chatId),
      eq(aiChatSummaries.organizationId, organizationId),
    ),
    orderBy: (summary, { desc }) => [desc(summary.createdAt)],
  });
}

/**
 * Creates a durable summary once a chat grows past the configured threshold.
 * Missing small-model configuration is intentionally non-fatal for normal chat.
 */
export async function maybeSummarizeChat({
  chatId,
  organizationId,
  providerMode,
  messages,
}: {
  chatId: string;
  organizationId: string;
  providerMode: AiProviderMode;
  messages: ComplianceUIMessage[];
}) {
  if (messages.length < summarizeAfterMessages) {
    return null;
  }

  const smallModelId = getSmallChatModelId(providerMode);

  if (!smallModelId) {
    console.warn(`Skipping chat summary: small model not configured for ${providerMode}`);
    return null;
  }

  const coveredMessages = messages.slice(0, -6);

  if (coveredMessages.length === 0) {
    return null;
  }

  const transcript = coveredMessages
    .map((message) => `${message.role}: ${textFromMessage(message)}`)
    .join("\n\n")
    .slice(0, 16000);
  const result = await generateText({
    model: getComplianceChatModelById(providerMode, smallModelId),
    system:
      "Summarize this compliance assistant conversation for future context. Include user goals, organization facts, compliance assumptions, unresolved questions, and previously cited sources. Do not add new facts.",
    prompt: transcript,
    temperature: 0,
  });

  const lastCovered = coveredMessages.at(-1);
  const [summary] = await db
    .insert(aiChatSummaries)
    .values({
      chatId,
      organizationId,
      summary: result.text,
      coveredMessageCount: coveredMessages.length,
      lastCoveredMessageId: await findStoredMessageId({
        chatId,
        uiMessageId: lastCovered?.id,
      }),
      modelProvider: providerMode,
      modelId: smallModelId,
      promptName: "chat_summary",
      promptVersion: "2026-05-24",
    })
    .returning();

  await db
    .update(aiChats)
    .set({ lastSummaryId: summary.id })
    .where(eq(aiChats.id, chatId));

  return summary;
}

/**
 * Keeps only recent turns once summarization should be active. This is the
 * message window sent to the model alongside the durable summary.
 */
export function recentMessagesForPrompt(messages: ComplianceUIMessage[]) {
  return messages.length > summarizeAfterMessages ? messages.slice(-8) : messages;
}

/**
 * Looks up the database row id for the last summarized UI message so summaries
 * can be audited back to the transcript range they cover.
 */
async function findStoredMessageId({
  chatId,
  uiMessageId,
}: {
  chatId: string;
  uiMessageId: string | undefined;
}) {
  if (!uiMessageId) {
    return null;
  }

  const message = await db.query.aiMessages.findFirst({
    where: and(eq(aiMessages.chatId, chatId), eq(aiMessages.uiMessageId, uiMessageId)),
    columns: { id: true },
  });

  return message?.id ?? null;
}
