import { SourceList } from "@/components/ai/source-list";
import { cn } from "@/lib/utils";
import type { ComplianceUIMessage } from "@/lib/ai/types";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatMessageProps = {
  message: ComplianceUIMessage;
  labels: {
    assistant: string;
    you: string;
    retry?: string;
    sources: string;
    attachments?: string;
  };
  onRetry?: () => void;
  retryDisabled?: boolean;
};

export function ChatMessage({
  message,
  labels,
  onRetry,
  retryDisabled,
}: ChatMessageProps) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const isUser = message.role === "user";
  const citations = message.metadata?.citations ?? [];
  const attachments = message.metadata?.attachments ?? [];

  return (
    <article
      className={cn(
        "grid max-w-3xl gap-2 rounded-lg border p-4",
        isUser ? "ml-auto bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium opacity-70">
          {isUser ? labels.you : labels.assistant}
        </p>
        {!isUser && onRetry && labels.retry && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRetry}
            disabled={retryDisabled}
            title={labels.retry}
            className="h-7 w-7"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6">
        {text || "..."}
      </div>
      {isUser && attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.documentId}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 px-2 py-1 text-xs"
              title={labels.attachments}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{attachment.title}</span>
            </span>
          ))}
        </div>
      )}
      {!isUser && <SourceList citations={citations} labels={labels} />}
    </article>
  );
}
