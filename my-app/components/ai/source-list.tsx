import type { AiCitation } from "@/lib/ai/types";
import { FileText, LinkIcon } from "lucide-react";

type SourceListProps = {
  citations: AiCitation[];
  labels: {
    sources: string;
  };
};

export function SourceList({ citations, labels }: SourceListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border bg-background p-3">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        {labels.sources}
      </p>
      <div className="grid gap-2">
        {citations.map((citation) => (
          <div
            key={citation.chunkId}
            className="grid gap-1 rounded-md border bg-muted/30 p-2 text-xs"
          >
            <div className="flex items-center gap-2 font-medium">
              {citation.sourceUrl ? (
                <LinkIcon className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              <span>{citation.title}</span>
            </div>
            <p className="text-muted-foreground">{citation.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
