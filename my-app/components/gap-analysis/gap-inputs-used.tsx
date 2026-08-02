import { AlertTriangle, FileText } from "lucide-react";
import type { GapLabels, GapWorkflow } from "./types";

export function GapInputsUsed({
  workflow,
  snapshot: providedSnapshot,
  labels,
}: {
  workflow: GapWorkflow;
  snapshot?: GapWorkflow["generatedInputs"];
  labels: GapLabels;
}) {
  const snapshot = providedSnapshot ?? workflow.generatedInputs;
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        {labels.inputsUnavailable}
      </p>
    );
  }
  return (
    <section aria-labelledby="gap-inputs-heading" className="grid gap-6">
      <div>
        <h2
          id="gap-inputs-heading"
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {labels.inputsUsed}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.inputsUsedDescription}
        </p>
      </div>
      <div>
        <h3 className="font-semibold">{labels.reviewQuestions}</h3>
        <dl className="mt-3 grid gap-3">
          {snapshot.questions.map((answer) => (
            <div key={answer.questionId} className="rounded-md border p-4">
              <dt className="font-medium">{answer.question}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {answer.displayAnswer || labels.noAnswer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="font-semibold">{labels.reviewDocuments}</h3>
        {snapshot.documents.length ? (
          <div className="mt-3 grid gap-3">
            {snapshot.documents.map((document, index) => (
              <div
                key={document.documentId ?? `unavailable-${index}`}
                className="flex items-start gap-3 rounded-md border p-4"
              >
                {document.unavailable ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4" />
                )}
                <div>
                  <p className="font-medium">
                    {document.title ?? labels.unavailableDocument}
                  </p>
                  {document.archived ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {labels.archivedSnapshotDocument}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {labels.noDocumentsUsed}
          </p>
        )}
      </div>
    </section>
  );
}
