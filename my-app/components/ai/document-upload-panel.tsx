"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AiDocument = {
  id: string;
  title: string;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  createdAt: string;
};

type DocumentUploadPanelProps = {
  organizationId: string;
  labels: {
    documents: string;
    upload: string;
    refresh: string;
    noDocuments: string;
    processing: string;
    ready: string;
    failed: string;
  };
};

export function DocumentUploadPanel({
  organizationId,
  labels,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setError(null);
    const response = await fetch(
      `/api/organizations/${organizationId}/ai-documents`,
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Could not load documents");
    }

    const body = (await response.json()) as { documents: AiDocument[] };
    setDocuments(body.documents);
  }, [organizationId]);

  useEffect(() => {
    loadDocuments().catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : String(nextError)),
    );
  }, [loadDocuments]);

  async function uploadFile(file: File) {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

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

      await loadDocuments();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{labels.documents}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => loadDocuments().catch((nextError) => setError(String(nextError)))}
            title={labels.refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
            title={labels.upload}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
          </Button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadFile(file);
              }
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.noDocuments}</p>
        ) : (
          <div className="grid gap-2">
            {documents.map((document) => (
              <div key={document.id} className="rounded-md border p-3">
                <p className="truncate text-sm font-medium">{document.title}</p>
                <p
                  className={cn(
                    "text-xs",
                    document.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {statusLabel(document.status, labels)}
                  {document.errorMessage ? `: ${document.errorMessage}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(
  status: AiDocument["status"],
  labels: DocumentUploadPanelProps["labels"],
) {
  if (status === "processing") {
    return labels.processing;
  }

  if (status === "ready") {
    return labels.ready;
  }

  return labels.failed;
}
