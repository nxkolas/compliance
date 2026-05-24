import { SourceList } from "@/components/ai/source-list";
import { cn } from "@/lib/utils";
import type { ComplianceUIMessage } from "@/lib/ai/types";

type ChatMessageProps = {
  message: ComplianceUIMessage;
  labels: {
    assistant: string;
    you: string;
    sources: string;
  };
};

export function ChatMessage({ message, labels }: ChatMessageProps) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const isUser = message.role === "user";
  const citations = message.metadata?.citations ?? [];

  return (
    <article
      className={cn(
        "grid max-w-3xl gap-2 rounded-lg border p-4",
        isUser ? "ml-auto bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <p className="text-xs font-medium opacity-70">
        {isUser ? labels.you : labels.assistant}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-6">
        {text || "..."}
      </div>
      {!isUser && <SourceList citations={citations} labels={labels} />}
    </article>
  );
}
