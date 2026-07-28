"use client";

import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GapLabels, GapWorkflow } from "./types";

export function GapDocumentStep({
  organizationId,
  workflow,
  labels,
  selected,
  busy,
  onToggle,
  onContinue,
}: {
  organizationId: string;
  workflow: GapWorkflow;
  labels: GapLabels;
  selected: string[];
  busy: boolean;
  onToggle: (documentId: string, checked: boolean) => void;
  onContinue: () => void;
}) {
  const documents = workflow.documentLibrary.documents;
  return (
    <section aria-labelledby="gap-step-heading" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="gap-step-heading"
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {labels.steps.documents}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {labels.documentsDescription}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/tool/organizations/${organizationId}/documents`}>
            {labels.openLibrary}
          </Link>
        </Button>
      </div>
      <div className="grid gap-3">
        {documents.length ? (
          documents.map((document) => {
            const eligible = document.eligibleForAnalysis;
            return (
              <label
                key={document.id}
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  eligible ? "cursor-pointer" : "opacity-65"
                }`}
              >
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={selected.includes(document.id)}
                  disabled={!workflow.canContribute || !eligible}
                  onChange={(event) =>
                    onToggle(document.id, event.target.checked)
                  }
                />
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {document.title}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {document.mimeType}
                  </span>
                  {!eligible ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {labels.notReady}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {labels.noDocumentsAvailable}
          </p>
        )}
      </div>
      {selected.length === 0 ? (
        <p className="text-sm font-medium">{labels.noneSelected}</p>
      ) : null}
      {workflow.canContribute ? (
        <Button
          className="justify-self-start"
          disabled={busy}
          onClick={onContinue}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {labels.continueReview}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
      )}
    </section>
  );
}
