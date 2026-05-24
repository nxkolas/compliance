import { embed, type UIMessage } from "ai";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { and, desc, eq, sql } from "drizzle-orm";
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
  ComplianceMessageMetadata,
  ComplianceUIMessage,
  RetrievedContextChunk,
} from "./types";

const maxChunkChars = 2400;
const chunkOverlapChars = 250;

type StoredMessage = typeof aiMessages.$inferSelect;
type DocumentScope = "organization" | "reference";

export async function ensureAiChat({
  chatId,
  organizationId,
  userId,
  title,
}: {
  chatId: string;
  organizationId: string;
  userId: string;
  title?: string;
}) {
  const existingChat = await db.query.aiChats.findFirst({
    where: eq(aiChats.id, chatId),
  });

  if (existingChat) {
    if (existingChat.organizationId !== organizationId) {
      throw new ApiError(404, "Chat not found");
    }

    return existingChat;
  }

  const [createdChat] = await db
    .insert(aiChats)
    .values({
      id: chatId,
      organizationId,
      createdByUserId: userId,
      title: titleFromText(title) ?? "Compliance assistant",
    })
    .returning();

  return createdChat;
}

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
    updatedAt: chat.updatedAt.toISOString(),
  }));
}

export async function persistUIMessage({
  chatId,
  organizationId,
  message,
}: {
  chatId: string;
  organizationId: string;
  message: ComplianceUIMessage;
}) {
  const uiMessageId = message.id.trim() || crypto.randomUUID();

  await db
    .insert(aiMessages)
    .values({
      uiMessageId,
      chatId,
      organizationId,
      role: message.role,
      parts: message.parts as Record<string, unknown>[],
      metadata: (message.metadata as Record<string, unknown> | undefined) ?? null,
    })
    .onConflictDoUpdate({
      target: [aiMessages.chatId, aiMessages.uiMessageId],
      set: {
        parts: message.parts as Record<string, unknown>[],
        metadata: (message.metadata as Record<string, unknown> | undefined) ?? null,
      },
    });

  await db
    .update(aiChats)
    .set({ updatedAt: new Date() })
    .where(eq(aiChats.id, chatId));
}

export async function retrieveContextForQuestion({
  chatId,
  organizationId,
  providerMode,
  question,
  topK = 6,
}: {
  chatId: string;
  organizationId: string;
  providerMode: AiProviderMode;
  question: string;
  topK?: number;
}): Promise<RetrievedContextChunk[]> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return [];
  }

  const hasReadyChatDocuments = await db.query.aiDocuments.findFirst({
    where: and(
      eq(aiDocuments.chatId, chatId),
      eq(aiDocuments.organizationId, organizationId),
      eq(aiDocuments.scope, "organization"),
      eq(aiDocuments.status, "ready"),
    ),
    columns: {
      id: true,
    },
  });

  if (!hasReadyChatDocuments) {
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

export function latestUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return "";
  }

  return textFromMessage(lastUserMessage);
}

export function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function createUserMessage(text: string): ComplianceUIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

async function embedText(value: string, providerMode: AiProviderMode) {
  const result = await embed({
    model: getComplianceEmbeddingModel(providerMode),
    value,
  });

  return result.embedding;
}

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

function withOverlap(previous: string | undefined, next: string) {
  if (!previous) {
    return next;
  }

  return `${previous.slice(-chunkOverlapChars)}\n\n${next}`;
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function formatVectorLiteral(embedding: number[]) {
  return `'[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]'`;
}

function createExcerpt(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

function titleFromText(value: string | undefined | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 255) : null;
}

function toUIMessage(message: StoredMessage): ComplianceUIMessage {
  return {
    id: message.uiMessageId.trim() || message.id,
    role: message.role,
    parts: message.parts as ComplianceUIMessage["parts"],
    metadata: message.metadata
      ? (message.metadata as ComplianceMessageMetadata)
      : undefined,
  };
}
