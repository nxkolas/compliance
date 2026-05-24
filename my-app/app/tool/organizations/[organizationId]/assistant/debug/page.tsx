import { getModelCapabilityProfile } from "@/lib/ai/model-capabilities";
import { getDefaultAiProviderMode } from "@/lib/ai/providers";
import { listPromptVersions } from "@/lib/ai/prompts/prompt-registry";
import { getLatestChatSummary } from "@/lib/ai/chat-summary";
import { requireAuth } from "@/lib/supabase/require-auth";
import { db } from "@/src/db";
import {
  aiDocumentChunks,
  aiMessages,
  organizationMembers,
} from "@/src/db/schema";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

type DebugPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ chatId?: string }>;
};

export default async function AssistantDebugPage({
  params,
  searchParams,
}: DebugPageProps) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_AI_DEBUG !== "true") {
    notFound();
  }

  const user = await requireAuth();
  const { organizationId } = await params;
  const { chatId } = await searchParams;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, user.id),
      eq(organizationMembers.organizationId, organizationId),
    ),
  });

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    notFound();
  }

  const provider = getDefaultAiProviderMode();
  const prompts = await listPromptVersions();
  const latestMessage = chatId
    ? await db.query.aiMessages.findFirst({
        where: and(
          eq(aiMessages.chatId, chatId),
          eq(aiMessages.organizationId, organizationId),
        ),
        orderBy: (message, { desc }) => [desc(message.createdAt)],
      })
    : null;
  const summary = chatId
    ? await getLatestChatSummary({ chatId, organizationId })
    : null;
  const chunks = chatId
    ? await db.query.aiDocumentChunks.findMany({
        where: and(
          eq(aiDocumentChunks.chatId, chatId),
          eq(aiDocumentChunks.organizationId, organizationId),
        ),
        columns: {
          id: true,
          documentId: true,
          chunkIndex: true,
          scope: true,
          content: true,
        },
        limit: 8,
      })
    : [];

  return (
    <main className="grid gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Assistant Debug</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Model</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(
            {
              selectedProviderDefault: provider,
              capabilities: getModelCapabilityProfile(provider),
            },
            null,
            2,
          )}
        </pre>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Latest Message Metadata</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(latestMessage, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Summary</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Retrieved/Stored Chunks</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(chunks, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Prompt Versions</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(prompts, null, 2)}
        </pre>
      </section>
    </main>
  );
}
