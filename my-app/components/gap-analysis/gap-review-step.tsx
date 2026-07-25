"use client";

import { Loader2, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { GapWorkflowStep } from "@/src/server/gap-analysis/workflow-state";
import { GapGenerationProgress } from "./gap-generation-progress";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";

export function GapReviewStep({
  workflow,
  labels,
  answers,
  selected,
  busy,
  generating,
  editable = true,
  locale,
  onNavigate,
  onGenerate,
  onRetry,
  onCancel,
}: {
  workflow: GapWorkflow;
  labels: GapLabels;
  answers: Record<string, string>;
  selected: string[];
  busy: string | null;
  generating: boolean;
  editable?: boolean;
  locale: GapLocale;
  onNavigate: (step: GapWorkflowStep) => void;
  onGenerate: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const release = workflow.release!;
  const selectedDocuments = workflow.documentLibrary.documents.flatMap(
    (entry) => {
      const version = entry.versions.find((item) =>
        selected.includes(item.version.id),
      );
      return version
        ? [{ title: entry.document.title, fileName: version.version.fileName }]
        : [];
    },
  );
  const failed =
    workflow.reassessment?.draft.status === "failed" ||
    workflow.reassessment?.draft.status === "cancelled";
  const draftLocale = workflow.reassessment?.draft.outputLocale;
  const resultLocale =
    draftLocale === "de" || draftLocale === "en" ? draftLocale : locale;
  const failureCode = workflow.run?.errorCode;
  const failureMessage =
    failureCode &&
    failureCode in labels.errors
      ? labels.errors[failureCode as keyof typeof labels.errors]
      : labels.runFailed;

  return (
    <section aria-labelledby="gap-step-heading" className="grid gap-5">
      <div>
        <h2
          id="gap-step-heading"
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {labels.steps.review}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.stepDescriptions.review}
        </p>
      </div>
      <SummarySection
        title={labels.reviewQuestions}
        editLabel={labels.edit}
        onEdit={() => onNavigate("questions")}
        editable={editable}
      >
        <dl className="grid gap-3">
          {release.questions.map((question) => {
            const option = question.options.find(
              (candidate) => candidate.id === answers[question.id],
            );
            return (
              <div key={question.id}>
                <dt className="text-sm font-medium">{question.questionText}</dt>
                <dd className="text-sm text-muted-foreground">
                  {option?.label ?? "—"}
                </dd>
              </div>
            );
          })}
        </dl>
      </SummarySection>
      <SummarySection
        title={labels.reviewDocuments}
        editLabel={labels.edit}
        onEdit={() => onNavigate("documents")}
        editable={editable}
      >
        {selectedDocuments.length ? (
          <ul className="grid gap-2 text-sm">
            {selectedDocuments.map((document) => (
              <li key={document.fileName}>
                <span className="font-medium">{document.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {document.fileName}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noneSelected}</p>
        )}
      </SummarySection>
      <section className="rounded-lg border border-primary/35 bg-primary/10 p-5">
        <h3 className="font-semibold">{labels.resultLanguage}</h3>
        <p className="mt-1 text-sm">
          {labels.resultLanguages[resultLocale]}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.sharedResultLanguage}
        </p>
      </section>
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">
          {labels.technicalDetails}
        </summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Technical
            label={labels.technical.baseResult}
            value={
              workflow.reassessment?.summary.baseAcceptedGapRevisionNumber
                ? `#${workflow.reassessment.summary.baseAcceptedGapRevisionNumber}`
                : "—"
            }
          />
          <Technical
            label={labels.technical.questionnaireSnapshot}
            value={String(
              workflow.reassessment?.summary.assessmentRevisionNumber ?? "—",
            )}
          />
          <Technical
            label={labels.technical.release}
            value={release.versionLabel}
          />
          <Technical
            label={labels.technical.requirementCount}
            value={String(
              workflow.reassessment?.summary.requirementCount ??
                release.requirements.length,
            )}
          />
        </dl>
      </details>
      {workflow.candidateRevision ? (
        <div className="rounded-lg border border-border bg-muted/60 p-4 text-sm text-foreground">
          {labels.replaceWarning}
        </div>
      ) : null}
      {generating ? (
        <GapGenerationProgress
          labels={labels}
          cancelling={busy === "cancel-generation"}
          canCancel={Boolean(
            workflow.reassessment?.draft.generationJobId,
          )}
          onCancel={onCancel}
        />
      ) : failed ? (
        <div className="grid gap-3">
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
            {failureMessage}
          </p>
          <Button
            className="justify-self-start"
            disabled={Boolean(busy)}
            onClick={onRetry}
          >
            {busy === "retry" ? <Loader2 className="animate-spin" /> : <Play />}
            {labels.retry}
          </Button>
        </div>
      ) : (
        <Button
          className="justify-self-start"
          disabled={Boolean(busy) || !workflow.reassessment}
          onClick={onGenerate}
        >
          {busy === "generate" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Play />
          )}
          {labels.startGeneration}
        </Button>
      )}
    </section>
  );
}

function SummarySection({
  title,
  editLabel,
  onEdit,
  children,
  editable,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
  editable: boolean;
}) {
  return (
    <section className="rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {editable ? (
          <Button variant="link" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Technical({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}
