import { AssistantChat } from "@/components/ai/assistant-chat";
import { getDefaultAiProviderMode } from "@/lib/ai/providers";
import { getDictionary } from "@/lib/i18n";
import { listAiChatsForOrganization, listMessagesForChat } from "@/lib/ai/rag";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type AssistantPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    chatId?: string;
  }>;
};

export default async function AssistantPage({
  params,
  searchParams,
}: AssistantPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const { chatId: requestedChatId } = await searchParams;
  const dictionary = await getDictionary();
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const chatId = isUuid(requestedChatId) ? requestedChatId : randomUUID();
  const chats = await listAiChatsForOrganization({
    organizationId: organization.id,
  });
  const initialMessages = isUuid(requestedChatId)
    ? await listMessagesForChat({ chatId, organizationId: organization.id })
    : [];
  const activeChat = chats.find((chat) => chat.id === chatId);

  return (
    <AssistantChat
      chatId={chatId}
      organizationId={organization.id}
      organizationName={organization.name}
      chats={chats}
      defaultProvider={getDefaultAiProviderMode()}
      defaultMode={activeChat?.assistantMode ?? "general_compliance_qa"}
      initialMessages={initialMessages}
      labels={dictionary.aiAssistant}
    />
  );
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
