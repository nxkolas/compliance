import type { UIMessage } from "ai";
import type { ComplianceUIMessage, RetrievedContextChunk } from "./types";

export function latestUserText(messages: UIMessage[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return latestUserMessage ? textFromMessage(latestUserMessage) : "";
}

export function textFromMessage(message: UIMessage) {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

export function citationsFromContext(chunks: RetrievedContextChunk[]) {
  void chunks;
  return [];
}

export async function retrieveContextForQuestion() {
  return [];
}

export async function ensureAiChat() {
  throw new Error("AI chat persistence is disabled in the org-only schema.");
}

export async function persistUIMessage() {
  throw new Error("AI message persistence is disabled in the org-only schema.");
}

export async function listAiChatsForOrganization() {
  return [];
}

export async function listMessagesForChat() {
  return [] satisfies ComplianceUIMessage[];
}

export async function listChatAiDocuments() {
  return [];
}

export async function ingestAiDocument() {
  throw new Error("AI document ingestion is disabled in the org-only schema.");
}
