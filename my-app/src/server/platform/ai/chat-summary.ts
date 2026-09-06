import type { UIMessage } from "ai";

export async function getLatestChatSummary() {
  return null;
}

export async function maybeSummarizeChat() {
  return null;
}

export function recentMessagesForPrompt(messages: UIMessage[]) {
  return messages.slice(-12);
}
