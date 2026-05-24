"use client";

import { ChatMessage } from "@/components/ai/chat-message";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n";
import type {
  AiAttachment,
  AiChatListItem,
  AiProviderMode,
  ComplianceUIMessage,
} from "@/lib/ai/types";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

type AssistantChatProps = {
  chatId: string;
  organizationId: string;
  organizationName: string;
  chats: AiChatListItem[];
  defaultProvider: AiProviderMode;
  initialMessages: ComplianceUIMessage[];
  labels: Dictionary["aiAssistant"];
};

export function AssistantChat({
  chatId,
  organizationId,
  organizationName,
  chats,
  defaultProvider,
  initialMessages,
  labels,
}: AssistantChatProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<AiProviderMode>(defaultProvider);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ComplianceUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest({ id, messages }) {
          return {
            body: {
              chatId: id,
              organizationId,
              selectedProvider,
              messages,
            },
          };
        },
      }),
    [organizationId, selectedProvider],
  );
  const { messages, sendMessage, stop, regenerate, status, error } =
    useChat<ComplianceUIMessage>({
      id: chatId,
      messages: initialMessages,
      transport,
    });
  const isStreaming = status === "submitted" || status === "streaming";
  const isBusy = isStreaming || isUploading;
  const chatList = useMemo(() => {
    if (chats.some((chat) => chat.id === chatId)) {
      return chats;
    }

    if (messages.length === 0) {
      return chats;
    }

    return [
      {
        id: chatId,
        title: titleFromMessage(messages[0]) ?? labels.title,
        updatedAt: new Date().toISOString(),
      },
      ...chats,
    ];
  }, [chatId, chats, labels.title, messages]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    const files = pendingFiles;

    if ((!text && files.length === 0) || isBusy) {
      return;
    }

    const messageId = crypto.randomUUID();

    try {
      setUploadError(null);
      setIsUploading(files.length > 0);
      const attachments: AiAttachment[] = [];

      for (const file of files) {
        attachments.push(await uploadAttachment(file, messageId));
      }

      const messageText =
        text ||
        `${labels.uploadedFileMessage}: ${files
          .map((file) => file.name)
          .join(", ")}`;

      setInput("");
      setPendingFiles([]);
      await sendMessage({
        id: messageId,
        role: "user",
        parts: [{ type: "text", text: messageText }],
        metadata:
          attachments.length > 0
            ? {
                attachments,
              }
            : undefined,
      });

      if (!searchParams.get("chatId")) {
        router.replace(
          `/tool/organizations/${organizationId}/assistant?chatId=${chatId}`,
        );
      }

      router.refresh();
    } catch (nextError) {
      setUploadError(
        nextError instanceof Error ? nextError.message : String(nextError),
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function uploadAttachment(file: File, messageId: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatId", chatId);
    formData.append("messageId", messageId);
    formData.append("selectedProvider", selectedProvider);

    const response = await fetch(
      `/api/organizations/${organizationId}/ai-documents`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Upload failed");
    }

    const body = (await response.json()) as {
      document: {
        id: string;
        title: string;
        status: AiAttachment["status"];
      };
    };

    return {
      documentId: body.document.id,
      title: body.document.title,
      status: body.document.status,
    };
  }

  function addPendingFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    setUploadError(null);
    setPendingFiles((currentFiles) => {
      const nextFiles = [...currentFiles];

      for (const file of Array.from(files)) {
        const alreadyQueued = nextFiles.some(
          (queuedFile) =>
            queuedFile.name === file.name &&
            queuedFile.size === file.size &&
            queuedFile.lastModified === file.lastModified,
        );

        if (!alreadyQueued) {
          nextFiles.push(file);
        }
      }

      return nextFiles;
    });
  }

  function removePendingFile(index: number) {
    setPendingFiles((currentFiles) =>
      currentFiles.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="grid content-start gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{labels.chats}</h2>
          <Button asChild variant="outline" size="icon">
            <Link
              href={`/tool/organizations/${organizationId}/assistant`}
              title={labels.newChat}
            >
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-1">
          {chatList.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {labels.noChats}
            </p>
          ) : (
            chatList.map((chat) => (
              <Link
                key={chat.id}
                href={`/tool/organizations/${organizationId}/assistant?chatId=${chat.id}`}
                className={`flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  chat.id === chatId
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{chat.title}</span>
              </Link>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-3xl font-bold">{labels.title}</h1>
            <p className="text-sm text-muted-foreground">{organizationName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedProvider}
              onValueChange={(value) =>
                setSelectedProvider(value as AiProviderMode)
              }
              disabled={isBusy}
            >
              <SelectTrigger className="w-44">
                <SelectValue aria-label={labels.provider} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company_hosted">
                  {labels.providers.companyHosted}
                </SelectItem>
                <SelectItem value="openai">{labels.providers.openai}</SelectItem>
                <SelectItem value="anthropic">
                  {labels.providers.anthropic}
                </SelectItem>
                <SelectItem value="self_hosted">
                  {labels.providers.selfHosted}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                    retry: labels.retry,
                    sources: labels.sources,
                    attachments: labels.attachments,
                  }}
                  onRetry={
                    message.role === "assistant"
                      ? () => void regenerate({ messageId: message.id })
                      : undefined
                  }
                  retryDisabled={isBusy}
                />
              ))}
            </div>
          )}
          {(error || uploadError) && (
            <p className="text-sm text-destructive">
              {uploadError ?? error?.message}
            </p>
          )}
        </div>

        <form
          onSubmit={submitMessage}
          className="rounded-lg border bg-background p-3"
        >
          {pendingFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingFiles.map((file, index) => (
                <span
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingFile(index)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    title={labels.removeAttachment}
                    disabled={isBusy}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title={labels.attach}
              disabled={isBusy}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              multiple
              onChange={(event) => addPendingFiles(event.target.files)}
            />
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
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && pendingFiles.length === 0) || isBusy}
                title={isUploading ? labels.uploading : undefined}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

function titleFromMessage(message: ComplianceUIMessage | undefined) {
  const text = message?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, 64) : null;
}
