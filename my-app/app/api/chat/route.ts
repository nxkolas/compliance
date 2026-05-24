import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import * as z from "zod";
import { getComplianceChatModel, getChatModelId } from "@/lib/ai/models";
import { getModelCapabilityProfile } from "@/lib/ai/model-capabilities";
import { buildCompliancePrompt, validateComplianceResponse } from "@/lib/ai/prompts";
import { ensurePromptVersion } from "@/lib/ai/prompts/prompt-registry";
import {
  getLatestChatSummary,
  maybeSummarizeChat,
  recentMessagesForPrompt,
} from "@/lib/ai/chat-summary";
import {
  citationsFromContext,
  ensureAiChat,
  latestUserText,
  persistUIMessage,
  retrieveContextForQuestion,
  textFromMessage,
} from "@/lib/ai/rag";
import type { ComplianceUIMessage } from "@/lib/ai/types";
import { aiProviderModes, assistantModes } from "@/lib/ai/types";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { NextResponse } from "next/server";

const chatRequestSchema = z.object({
  chatId: z.uuid(),
  organizationId: z.uuid(),
  selectedProvider: z.enum(aiProviderModes),
  assistantMode: z.enum(assistantModes).default("general_compliance_qa"),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      parts: z.array(z.record(z.string(), z.unknown())),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJsonBody(request, chatRequestSchema);
    const organizationId = parseInput(
      z.uuid(),
      body.organizationId,
      "Invalid organizationId",
    );
    const organization = await getOrganizationForUser(user.id, organizationId);

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    const messages = normalizeMessageIds(body.messages as ComplianceUIMessage[]);
    const latestQuestion = latestUserText(messages as UIMessage[]);

    if (!latestQuestion) {
      throw new ApiError(400, "A user message is required");
    }

    await ensureAiChat({
      chatId: body.chatId,
      organizationId,
      userId: user.id,
      title: latestQuestion,
      assistantMode: body.assistantMode,
    });

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (latestUserMessage) {
      await persistUIMessage({
        chatId: body.chatId,
        organizationId,
        message: latestUserMessage,
        assistantMode: body.assistantMode,
      });
    }

    const retrievedContext = await retrieveContextForQuestion({
      chatId: body.chatId,
      organizationId,
      providerMode: body.selectedProvider,
      assistantMode: body.assistantMode,
      question: latestQuestion,
    });
    const citations = citationsFromContext(retrievedContext);
    const chatSummary = await getLatestChatSummary({
      chatId: body.chatId,
      organizationId,
    });
    const modelCapabilities = getModelCapabilityProfile(body.selectedProvider);
    const prompt = buildCompliancePrompt({
      mode: body.assistantMode,
      organization,
      retrievedChunks: retrievedContext,
      chatSummary: chatSummary?.summary,
      locale: localeFromRequest(request),
      modelCapabilities,
    });
    await ensurePromptVersion(prompt);
    const modelId = getChatModelId(body.selectedProvider);
    const result = streamText({
      model: getComplianceChatModel(body.selectedProvider),
      system: prompt.system,
      messages: await convertToModelMessages(recentMessagesForPrompt(messages)),
      temperature: prompt.temperature,
      maxOutputTokens: prompt.maxOutputTokens,
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse<ComplianceUIMessage>({
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      messageMetadata({ part }) {
        if (part.type === "finish" && citations.length > 0) {
          return { citations };
        }
      },
      onFinish: async ({ messages: finishedMessages }) => {
        const assistantMessage = [...finishedMessages]
          .reverse()
          .find((message) => message.role === "assistant");

        if (assistantMessage) {
          const validation = validateComplianceResponse({
            answerMarkdown: textFromMessage(assistantMessage),
            citations,
            retrievedContext,
            mode: body.assistantMode,
          });
          await persistUIMessage({
            chatId: body.chatId,
            organizationId,
            message: {
              ...assistantMessage,
              metadata: {
                ...(assistantMessage.metadata ?? {}),
                ...(citations.length > 0 ? { citations } : {}),
                prompt: {
                  name: prompt.promptName,
                  version: prompt.promptVersion,
                  hash: prompt.promptHash,
                  mode: body.assistantMode,
                },
                ...(validation.warnings.length > 0
                  ? { validationWarnings: validation.warnings }
                  : {}),
              },
            },
            assistantMode: body.assistantMode,
            promptName: prompt.promptName,
            promptVersion: prompt.promptVersion,
            promptHash: prompt.promptHash,
            modelProvider: body.selectedProvider,
            modelId,
            retrievedChunkIds: retrievedContext.map((chunk) => chunk.chunkId),
            generatedCitationIds: validation.generatedCitationIds,
            responseContract: validation.output as unknown as Record<string, unknown>,
            validationWarnings: validation.warnings,
          });

          await maybeSummarizeChat({
            chatId: body.chatId,
            organizationId,
            providerMode: body.selectedProvider,
            messages: finishedMessages as ComplianceUIMessage[],
          });
        }
      },
      onError(error) {
        if (error instanceof ApiError) {
          return error.message;
        }

        return "The assistant could not complete the response.";
      },
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function localeFromRequest(request: Request) {
  const language = request.headers.get("accept-language") ?? "";
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}

function normalizeMessageIds(messages: ComplianceUIMessage[]) {
  return messages.map((message) =>
    message.id.trim()
      ? message
      : {
          ...message,
          id: crypto.randomUUID(),
        },
  );
}
