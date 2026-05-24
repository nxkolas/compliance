import { AssistantChat } from "@/components/ai/assistant-chat";
import { getDictionary, getLocale } from "@/lib/i18n";
import { listMessagesForChat } from "@/lib/ai/rag";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type AssistantPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    chatId?: string;
  }>;
};

export default function AssistantPage(props: AssistantPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <AssistantPageContent {...props} />
    </Suspense>
  );
}

async function AssistantPageContent({
  params,
  searchParams,
}: AssistantPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const { chatId: requestedChatId } = await searchParams;
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  const chatId = isUuid(requestedChatId) ? requestedChatId : randomUUID();
  const initialMessages = isUuid(requestedChatId)
    ? await listMessagesForChat({ chatId, organizationId: organization.id })
    : [];

  return (
    <AssistantChat
      chatId={chatId}
      organizationId={organization.id}
      organizationName={organization.name}
      initialMessages={initialMessages}
      labels={dictionary.aiAssistant}
      locale={locale}
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
