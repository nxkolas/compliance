import { embed, type UIMessage } from "ai";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/src/db";
import {
  aiChats,
  aiDocumentChunks,
  aiDocuments,
  aiMessages,
} from "@/src/db/schema";
import { ApiError } from "@/src/server/api/errors";
import { getComplianceEmbeddingModel } from "./models";
import type {
  AiCitation,
  AiChatListItem,
  AiProviderMode,
  AssistantMode,
  ComplianceMessageMetadata,
  ComplianceUIMessage,
  RetrievedContextChunk,
} from "./types";

const maxChunkChars = 2400;
const chunkOverlapChars = 250;

type StoredMessage = typeof aiMessages.$inferSelect;
type DocumentScope = "organization" | "reference";

/**
 * Creates a chat row on first use or verifies that an existing chat belongs to
 * the current organization. It also keeps the chat-level assistant mode current.
 */
export async function ensureAiChat({
  chatId,
  organizationId,
  userId,
  title,
  assistantMode = "general_compliance_qa",
}: {
  chatId: string;
  organizationId: string;
  userId: string;
  title?: string;
  assistantMode?: AssistantMode;
}) {
  const existingChat = await db.query.aiChats.findFirst({
    where: eq(aiChats.id, chatId),
  });

  if (existingChat) {
    if (existingChat.organizationId !== organizationId) {
      throw new ApiError(404, "Chat not found");
    }

    if (existingChat.assistantMode !== assistantMode) {
      const [updatedChat] = await db
        .update(aiChats)
        .set({ assistantMode, updatedAt: new Date() })
        .where(eq(aiChats.id, chatId))
        .returning();

      return updatedChat;
    }

    return existingChat;
  }

  const [createdChat] = await db
    .insert(aiChats)
    .values({
      id: chatId,
      organizationId,
      createdByUserId: userId,
      assistantMode,
      title: titleFromText(title) ?? "Compliance assistant",
    })
    .returning();

  return createdChat;
}

/**
 * Loads persisted messages and converts DB rows back into AI SDK UI messages.
 */
export async function listMessagesForChat({
  chatId,
  organizationId,
}: {
  chatId: string;
  organizationId: string;
}): Promise<ComplianceUIMessage[]> {
  const messages = await db.query.aiMessages.findMany({
    where: and(
      eq(aiMessages.chatId, chatId),
      eq(aiMessages.organizationId, organizationId),
    ),
    orderBy: (message, { asc }) => [asc(message.createdAt)],
  });

  return messages.map(toUIMessage);
}

/**
 * Lists recent chats for the organization sidebar.
 */
export async function listAiChatsForOrganization({
  organizationId,
}: {
  organizationId: string;
}): Promise<AiChatListItem[]> {
  const chats = await db.query.aiChats.findMany({
    where: eq(aiChats.organizationId, organizationId),
    orderBy: [desc(aiChats.updatedAt)],
    limit: 50,
  });

  return chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    assistantMode: chat.assistantMode,
    updatedAt: chat.updatedAt.toISOString(),
  }));
}

/**
 * Persists or updates one UI message. Assistant calls can attach prompt,
 * model, citation, and validation metadata for auditability.
 */
export async function persistUIMessage({
  chatId,
  organizationId,
  message,
  assistantMode,
  promptName,
  promptVersion,
  promptHash,
  modelProvider,
  modelId,
  retrievedChunkIds,
  generatedCitationIds,
  responseContract,
  validationWarnings,
}: {
  chatId: string;
  organizationId: string;
  message: ComplianceUIMessage;
  assistantMode?: AssistantMode;
  promptName?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  modelProvider?: string | null;
  modelId?: string | null;
  retrievedChunkIds?: string[] | null;
  generatedCitationIds?: string[] | null;
  responseContract?: Record<string, unknown> | null;
  validationWarnings?: string[] | null;
}) {
  const uiMessageId = message.id.trim() || crypto.randomUUID();

  await db
    .insert(aiMessages)
    .values({
      uiMessageId,
      chatId,
      organizationId,
      role: message.role,
      assistantMode: assistantMode ?? null,
      promptName: promptName ?? null,
      promptVersion: promptVersion ?? null,
      promptHash: promptHash ?? null,
      modelProvider: modelProvider ?? null,
      modelId: modelId ?? null,
      retrievedChunkIds: retrievedChunkIds ?? null,
      generatedCitationIds: generatedCitationIds ?? null,
      responseContract: responseContract ?? null,
      validationWarnings: validationWarnings ?? null,
      parts: message.parts as Record<string, unknown>[],
      metadata: (message.metadata as Record<string, unknown> | undefined) ?? null,
    })
    .onConflictDoUpdate({
      target: [aiMessages.chatId, aiMessages.uiMessageId],
      set: {
        parts: message.parts as Record<string, unknown>[],
        metadata: (message.metadata as Record<string, unknown> | undefined) ?? null,
        assistantMode: assistantMode ?? null,
        promptName: promptName ?? null,
        promptVersion: promptVersion ?? null,
        promptHash: promptHash ?? null,
        modelProvider: modelProvider ?? null,
        modelId: modelId ?? null,
        retrievedChunkIds: retrievedChunkIds ?? null,
        generatedCitationIds: generatedCitationIds ?? null,
        responseContract: responseContract ?? null,
        validationWarnings: validationWarnings ?? null,
      },
    });

  await db
    .update(aiChats)
    .set({ updatedAt: new Date() })
    .where(eq(aiChats.id, chatId));
}

/**
 * Embeds the latest user question and retrieves the most similar chunks.
 * Uploaded documents stay chat-scoped; curated references are global.
 */
export async function retrieveContextForQuestion({
  chatId,
  organizationId,
  providerMode,
  assistantMode,
  question,
  topK = 6,
}: {
  chatId: string;
  organizationId: string;
  providerMode: AiProviderMode;
  assistantMode: AssistantMode;
  question: string;
  topK?: number;
}): Promise<RetrievedContextChunk[]> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return [];
  }

  const shouldSearchReferences = assistantMode !== "document_review";
  const hasReadySearchDocuments = await db.query.aiDocuments.findFirst({
    where: and(
      eq(aiDocuments.status, "ready"),
      or(
        shouldSearchReferences ? eq(aiDocuments.scope, "reference") : undefined,
        and(
          eq(aiDocuments.chatId, chatId),
          eq(aiDocuments.organizationId, organizationId),
          eq(aiDocuments.scope, "organization"),
        ),
      ),
    ),
    columns: {
      id: true,
    },
  });

  if (!hasReadySearchDocuments) {
    return [];
  }

  const embedding = await embedText(trimmedQuestion, providerMode);
  const queryVector = sql.raw(formatVectorLiteral(embedding));

  const rows = await db.execute<{
    chunk_id: string;
    document_id: string;
    title: string;
    scope: DocumentScope;
    source_url: string | null;
    storage_path: string | null;
    content: string;
    similarity: number;
  }>(sql`
    select
      ${aiDocumentChunks.id} as chunk_id,
      ${aiDocuments.id} as document_id,
      ${aiDocuments.title} as title,
      ${aiDocuments.scope} as scope,
      ${aiDocuments.sourceUrl} as source_url,
      ${aiDocuments.storagePath} as storage_path,
      ${aiDocumentChunks.content} as content,
      1 - (${aiDocumentChunks.embedding} <=> ${queryVector}::vector) as similarity
    from ${aiDocumentChunks}
    inner join ${aiDocuments}
      on ${aiDocuments.id} = ${aiDocumentChunks.documentId}
    where ${aiDocuments.status} = 'ready'
      and (
        ${aiDocumentChunks.scope} = 'reference'
        or (
          ${aiDocumentChunks.scope} = 'organization'
          and ${aiDocumentChunks.organizationId} = ${organizationId}
          and ${aiDocumentChunks.chatId} = ${chatId}
        )
      )
    order by ${aiDocumentChunks.embedding} <=> ${queryVector}::vector
    limit ${topK}
  `);

  return Array.from(rows).map((row) => ({
    documentId: row.document_id,
    chunkId: row.chunk_id,
    title: row.title,
    scope: row.scope,
    sourceUrl: row.source_url,
    storagePath: row.storage_path,
    content: row.content,
    excerpt: createExcerpt(row.content),
    similarity: Number(row.similarity),
  }));
}

/**
 * Converts retrieved chunks into the citation metadata shape sent to the UI.
 */
export function citationsFromContext(
  context: RetrievedContextChunk[],
): AiCitation[] {
  return context.map(
    ({
      documentId,
      chunkId,
      title,
      scope,
      sourceUrl,
      storagePath,
      excerpt,
    }) => ({
      documentId,
      chunkId,
      title,
      scope,
      sourceUrl,
      storagePath,
      excerpt,
    }),
  );
}

/**
 * Lists uploaded organization documents for a single chat.
 */
export async function listChatAiDocuments({
  chatId,
  organizationId,
}: {
  chatId: string;
  organizationId: string;
}) {
  return db.query.aiDocuments.findMany({
    where: and(
      eq(aiDocuments.organizationId, organizationId),
      eq(aiDocuments.chatId, chatId),
      eq(aiDocuments.scope, "organization"),
    ),
    orderBy: [desc(aiDocuments.createdAt)],
  });
}

/**
 * Stores an uploaded or curated document, extracts text, chunks it, embeds
 * every chunk, and marks the document ready for RAG search.
 */
export async function ingestAiDocument({
  chatId,
  uiMessageId,
  providerMode,
  organizationId,
  userId,
  title,
  sourceUrl,
  storagePath,
  mimeType,
  buffer,
  text,
  scope,
  metadata,
}: {
  chatId?: string | null;
  uiMessageId?: string | null;
  providerMode: AiProviderMode;
  organizationId?: string | null;
  userId?: string | null;
  title: string;
  sourceUrl?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  buffer?: Buffer;
  text?: string;
  scope: DocumentScope;
  metadata?: Record<string, unknown>;
}) {
  if (scope === "organization" && !organizationId) {
    throw new ApiError(400, "organizationId is required for organization documents");
  }

  if (scope === "organization" && !chatId) {
    throw new ApiError(400, "chatId is required for chat documents");
  }

  const checksum = buffer
    ? createHash("sha256").update(buffer).digest("hex")
    : createHash("sha256").update(text ?? "").digest("hex");

  const [document] = await db
    .insert(aiDocuments)
    .values({
      organizationId: organizationId ?? null,
      chatId: chatId ?? null,
      uiMessageId: uiMessageId ?? null,
      scope,
      status: "processing",
      title: titleFromText(title) ?? "Untitled document",
      sourceUrl: sourceUrl ?? null,
      storagePath: storagePath ?? null,
      mimeType: mimeType ?? null,
      checksum,
      metadata: metadata ?? null,
      createdByUserId: userId ?? null,
    })
    .returning();

  try {
    const extractedText =
      text ?? (await extractTextFromDocument(buffer, title, mimeType));
    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
      throw new ApiError(400, "Document does not contain extractable text");
    }

    for (const [index, chunk] of chunks.entries()) {
      await db.insert(aiDocumentChunks).values({
        documentId: document.id,
        organizationId: organizationId ?? null,
        chatId: chatId ?? null,
        uiMessageId: uiMessageId ?? null,
        scope,
        chunkIndex: index,
        content: chunk,
        tokenEstimate: estimateTokens(chunk),
        embedding: await embedText(chunk, providerMode),
        metadata: { title, sourceUrl, storagePath },
      });
    }

    const [readyDocument] = await db
      .update(aiDocuments)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(aiDocuments.id, document.id))
      .returning();

    return readyDocument;
  } catch (error) {
    await db
      .update(aiDocuments)
      .set({
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Document ingestion failed",
        updatedAt: new Date(),
      })
      .where(eq(aiDocuments.id, document.id));

    throw error;
  }
}

/**
 * Returns the newest user-authored text in a UI message list.
 */
export function latestUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return "";
  }

  return textFromMessage(lastUserMessage);
}

/**
 * Extracts plain text from AI SDK UI message parts.
 */
export function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/**
 * Convenience helper for tests/scripts that need a user UI message shape.
 */
export function createUserMessage(text: string): ComplianceUIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

/**
 * Runs provider-bound embedding generation for document chunks and questions.
 */
async function embedText(value: string, providerMode: AiProviderMode) {
  const result = await embed({
    model: getComplianceEmbeddingModel(providerMode),
    value,
  });

  return result.embedding;
}

/**
 * Extracts text from supported file types. Docling may replace or augment this
 * later for scanned/layout-heavy documents.
 */
async function extractTextFromDocument(
  buffer: Buffer | undefined,
  title: string,
  mimeType?: string | null,
) {
  if (!buffer) {
    throw new ApiError(400, "Document content is required");
  }

  const lowerTitle = title.toLowerCase();

  if (mimeType === "application/pdf" || lowerTitle.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerTitle.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimeType?.startsWith("text/") ||
    lowerTitle.endsWith(".txt") ||
    lowerTitle.endsWith(".md")
  ) {
    return buffer.toString("utf8");
  }

  throw new ApiError(400, "Supported file types are PDF, DOCX, TXT, and MD");
}

/**
 * Splits text on paragraph boundaries first, with a fallback for long blocks.
 */
function chunkText(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChunkChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= maxChunkChars) {
      current = withOverlap(chunks.at(-1), paragraph);
      continue;
    }

    const paragraphChunks = splitLongText(paragraph);
    chunks.push(...paragraphChunks.slice(0, -1));
    current = paragraphChunks.at(-1) ?? "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

/**
 * Splits very long paragraphs into overlapping fixed-size chunks.
 */
function splitLongText(text: string) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const chunk = text.slice(cursor, cursor + maxChunkChars);
    chunks.push(chunk);
    cursor += maxChunkChars - chunkOverlapChars;
  }

  return chunks;
}

/**
 * Carries a small tail of the previous chunk into the next chunk to reduce
 * context loss at boundaries.
 */
function withOverlap(previous: string | undefined, next: string) {
  if (!previous) {
    return next;
  }

  return `${previous.slice(-chunkOverlapChars)}\n\n${next}`;
}

/**
 * Cheap token estimate used for metadata and future context budgeting.
 */
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

/**
 * Formats a vector literal for pgvector cosine-distance SQL.
 */
function formatVectorLiteral(embedding: number[]) {
  return `'[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]'`;
}

/**
 * Builds a short source preview for citation chips.
 */
function createExcerpt(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

/**
 * Normalizes DB-safe titles for chats and documents.
 */
function titleFromText(value: string | undefined | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 255) : null;
}

/**
 * Rehydrates one stored message, including prompt and validation metadata.
 */
function toUIMessage(message: StoredMessage): ComplianceUIMessage {
  const metadata = message.metadata
    ? (message.metadata as ComplianceMessageMetadata)
    : undefined;

  return {
    id: message.uiMessageId.trim() || message.id,
    role: message.role,
    parts: message.parts as ComplianceUIMessage["parts"],
    metadata: {
      ...(metadata ?? {}),
      ...(message.promptName && message.promptVersion && message.promptHash && message.assistantMode
        ? {
            prompt: {
              name: message.promptName,
              version: message.promptVersion,
              hash: message.promptHash,
              mode: message.assistantMode,
            },
          }
        : {}),
      ...(message.validationWarnings?.length
        ? { validationWarnings: message.validationWarnings }
        : {}),
    },
  };
}
