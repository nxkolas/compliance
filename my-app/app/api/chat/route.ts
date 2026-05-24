import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import * as z from "zod";
import { getComplianceChatModel } from "@/lib/ai/models";
import { buildComplianceSystemPrompt } from "@/lib/ai/prompts";
import {
  citationsFromContext,
  ensureAiChat,
  latestUserText,
  persistUIMessage,
  retrieveContextForQuestion,
} from "@/lib/ai/rag";
import type { ComplianceUIMessage } from "@/lib/ai/types";
import { aiProviderModes } from "@/lib/ai/types";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { NextResponse } from "next/server";

const chatRequestSchema = z.object({
  chatId: z.uuid(),
  organizationId: z.uuid(),
  selectedProvider: z.enum(aiProviderModes),
  messages: z.array(
    z.object({
      id: z.string().min(1),
      role: z.enum(["system", "user", "assistant"]),
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

    const messages = body.messages as ComplianceUIMessage[];
    const latestQuestion = latestUserText(messages as UIMessage[]);

    if (!latestQuestion) {
      throw new ApiError(400, "A user message is required");
    }

    await ensureAiChat({
      chatId: body.chatId,
      organizationId,
      userId: user.id,
      title: latestQuestion,
    });

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (latestUserMessage) {
      await persistUIMessage({
        chatId: body.chatId,
        organizationId,
        message: latestUserMessage,
      });
    }

    const retrievedContext = await retrieveContextForQuestion({
      chatId: body.chatId,
      organizationId,
      providerMode: body.selectedProvider,
      question: latestQuestion,
    });
    const citations = citationsFromContext(retrievedContext);
    const result = streamText({
      model: getComplianceChatModel(body.selectedProvider),
      system: buildComplianceSystemPrompt({
        organization,
        retrievedContext,
      }),
      messages: await convertToModelMessages(messages),
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse<ComplianceUIMessage>({
      originalMessages: messages,
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
          await persistUIMessage({
            chatId: body.chatId,
            organizationId,
            message: {
              ...assistantMessage,
              metadata: {
                ...(assistantMessage.metadata ?? {}),
                ...(citations.length > 0 ? { citations } : {}),
              },
            },
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
