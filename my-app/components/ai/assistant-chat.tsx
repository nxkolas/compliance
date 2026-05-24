"use client";

import { ChatMessage } from "@/components/ai/chat-message";
import { DocumentUploadPanel } from "@/components/ai/document-upload-panel";
import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ComplianceUIMessage } from "@/lib/ai/types";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, RefreshCw, Send, Square } from "lucide-react";
import { useMemo, useState } from "react";

type AssistantChatProps = {
  chatId: string;
  organizationId: string;
  organizationName: string;
  initialMessages: ComplianceUIMessage[];
  labels: Dictionary["aiAssistant"];
  locale: Locale;
};

export function AssistantChat({
  chatId,
  organizationId,
  organizationName,
  initialMessages,
  labels,
}: AssistantChatProps) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ComplianceUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest({ id, messages }) {
          return {
            body: {
              chatId: id,
              organizationId,
              messages,
            },
          };
        },
      }),
    [organizationId],
  );
  const { messages, sendMessage, stop, regenerate, status, error } =
    useChat<ComplianceUIMessage>({
      id: chatId,
      messages: initialMessages,
      transport,
    });
  const isStreaming = status === "submitted" || status === "streaming";

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();

    if (!text || isStreaming) {
      return;
    }

    setInput("");
    await sendMessage({ text });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{labels.title}</h1>
            <p className="text-sm text-muted-foreground">{organizationName}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void regenerate()}
            disabled={messages.length === 0 || isStreaming}
            title={labels.retry}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-4 rounded-lg border bg-muted/20 p-4">
          {messages.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center">
              <div className="grid max-w-md gap-3">
                <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{labels.emptyTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {labels.emptyDescription}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  labels={{
                    assistant: labels.assistant,
                    you: labels.you,
                    sources: labels.sources,
                  }}
                />
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>

        <form onSubmit={submitMessage} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={labels.placeholder}
            className="min-h-24 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
          {isStreaming ? (
            <Button type="button" size="icon" onClick={stop} title={labels.stop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>

      <aside className="grid content-start gap-4">
        <DocumentUploadPanel
          organizationId={organizationId}
          labels={{
            documents: labels.documents,
            upload: labels.upload,
            refresh: labels.refresh,
            noDocuments: labels.noDocuments,
            processing: labels.processing,
            ready: labels.ready,
            failed: labels.failed,
          }}
        />
      </aside>
    </section>
  );
}
