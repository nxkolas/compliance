"use client";

import { Loader2, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { GapWorkflowStep } from "@/src/server/gap-analysis/workflow-state";
import { GapGenerationProgress } from "./gap-generation-progress";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";
import type { JobDto } from "@/src/contracts/common/jobs";

export function GapReviewStep({
  workflow,
  labels,
  answers,
  selected,
  busy,
  generating,
  generationJob = null,
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
  generationJob?: JobDto | null;
  editable?: boolean;
  locale: GapLocale;
  onNavigate: (step: GapWorkflowStep) => void;
  onGenerate: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const release = workflow.release!;
  const categories = [...release.requirements]
    .sort((left, right) => left.position - right.position)
    .map((requirement) => ({
      ...requirement,
      questions: release.questions.filter((question) =>
        requirement.questionStableKeys.includes(question.stableKey),
      ),
    }));
  const questionNumberById = new Map(
    release.questions.map((question, index) => [question.id, index + 1]),
  );
  const selectedDocuments = workflow.documentLibrary.documents.filter(
    (document) => selected.includes(document.id),
  );
  const failed =
    workflow.analysisCycle?.draft.status === "failed" ||
    workflow.analysisCycle?.draft.status === "cancelled";
  const draftLocale = workflow.analysisCycle?.draft.outputLocale;
  const resultLocale =
    draftLocale === "de" || draftLocale === "en" ? draftLocale : locale;
  const failureCode = workflow.run?.errorCode;
  const failureMessage =
    failureCode &&
    failureCode in labels.errors
      ? labels.errors[failureCode as keyof typeof labels.errors]
      : labels.runFailed;

  return (
    <section
      aria-labelledby="gap-step-heading"
      data-gap-review
      className="w-full max-w-[1202px]"
    >
      <section className="min-h-40 rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] px-6 py-8 text-white shadow-sm sm:py-9 sm:pr-6 sm:pl-10">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h2
              id="gap-step-heading"
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight text-white outline-none"
            >
              {labels.reviewTitle}
            </h2>
            <p className="mt-2 max-w-[972px] text-base leading-7 font-normal text-white">
              {labels.stepDescriptions.review}
            </p>
          </div>
          {editable ? (
            <Button
              variant="link"
              size="sm"
              className="shrink-0 text-[#6F8DFF] hover:text-white"
              onClick={() => onNavigate("questions")}
            >
              {labels.edit}
            </Button>
          ) : null}
        </div>
      </section>

      <div aria-label={labels.reviewQuestions} className="mt-10 grid gap-10">
        {categories.map((category, categoryIndex) => (
          <section key={category.id} data-gap-review-category>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
              {labels.categoryProgress
                .replace("{current}", String(categoryIndex + 1))
                .replace("{total}", String(categories.length))}
            </p>
            <h3 className="mt-2 text-xl font-bold text-white">
              {category.title}
            </h3>
            <dl className="mt-5 grid gap-5">
              {category.questions.map((question) => {
                const option = question.options.find(
                  (candidate) => candidate.id === answers[question.id],
                );
                return (
                  <div
                    key={question.id}
                    data-gap-review-question
                    className="flex min-h-24 items-center gap-5 rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] px-5 py-5 text-white shadow-sm sm:gap-8 sm:px-10"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#3D4049] bg-[#252832] text-xs font-medium text-white">
                      {questionNumberById.get(question.id)}
                    </span>
                    <div className="min-w-0 break-words">
                      <dt className="text-base leading-7 font-bold text-white">
                        {question.questionText}
                      </dt>
                      <dd className="mt-1 text-base leading-6 font-normal text-slate-200">
                        {option?.label ?? labels.noAnswer}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <section className="mt-8" aria-labelledby="gap-review-additional-heading">
        <h3
          id="gap-review-additional-heading"
          className="text-xl font-bold text-white"
        >
          {labels.reviewAdditionalInformation}
        </h3>

        <div className="mt-8 grid gap-5">
          <SummarySection
            title={labels.reviewDocuments}
            editLabel={labels.edit}
            onEdit={() => onNavigate("documents")}
            editable={editable}
          >
            {selectedDocuments.length ? (
              <ul className="grid gap-2 text-sm">
                {selectedDocuments.map((document) => (
                  <li key={document.id} className="break-words">
                    <span className="font-medium text-white">
                      {document.title}
                    </span>
                    <span className="text-slate-400">
                      {" "}· {document.mimeType}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">{labels.noneSelected}</p>
            )}
          </SummarySection>

          <section className="rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] p-6 text-white shadow-sm">
            <h3 className="font-semibold">{labels.resultLanguage}</h3>
            <p className="mt-2 text-sm">{labels.resultLanguages[resultLocale]}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {labels.sharedResultLanguage}
            </p>
          </section>

          <details className="rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] p-5 text-sm text-white shadow-sm">
            <summary className="cursor-pointer font-medium">
              {labels.technicalDetails}
            </summary>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Technical
                label={labels.technical.baseResult}
                value={
                  workflow.analysisCycle?.summary.baseAcceptedGapRevisionNumber
                    ? `#${workflow.analysisCycle.summary.baseAcceptedGapRevisionNumber}`
                    : labels.noAnswer
                }
              />
              <Technical
                label={labels.technical.questionnaireSnapshot}
                value={String(
                  workflow.analysisCycle?.summary.assessmentRevisionNumber ??
                    labels.noAnswer,
                )}
              />
              <Technical
                label={labels.technical.release}
                value={release.versionLabel}
              />
              <Technical
                label={labels.technical.requirementCount}
                value={String(
                  workflow.analysisCycle?.summary.requirementCount ??
                    release.requirements.length,
                )}
              />
            </dl>
          </details>

          {workflow.candidateRevision ? (
            <div className="rounded-xl border border-[#3D4049] bg-[#1B1E27] p-5 text-sm text-white">
              {labels.replaceWarning}
            </div>
          ) : null}

          {generating ? (
            <GapGenerationProgress
              labels={labels}
              job={generationJob}
              cancelling={busy === "cancel-generation"}
              canCancel={Boolean(workflow.analysisCycle?.draft.generationJobId)}
              onCancel={onCancel}
            />
          ) : failed ? (
            <div className="grid gap-3">
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-white">
                {failureMessage}
              </p>
              <Button
                className="h-12 justify-self-start bg-[#002BFF] text-white hover:bg-[#123BFF]"
                disabled={Boolean(busy)}
                onClick={onRetry}
              >
                {busy === "retry" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {labels.retry}
              </Button>
            </div>
          ) : (
            <Button
              className="h-12 justify-self-end bg-[#002BFF] px-7 text-white hover:brightness-90"
              style={{ backgroundColor: "#002BFF" }}
              disabled={Boolean(busy) || !workflow.analysisCycle}
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
        </div>
      </section>
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
    <section className="rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] p-6 text-white shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {editable ? (
          <Button
            variant="link"
            size="sm"
            className="text-[#6F8DFF] hover:text-white"
            onClick={onEdit}
          >
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
    <div className="min-w-0 break-words">
      <dt className="font-medium text-white">{label}</dt>
      <dd className="mt-1 text-slate-400">{value}</dd>
    </div>
  );
}
