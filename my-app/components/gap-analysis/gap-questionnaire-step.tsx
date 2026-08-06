"use client";

import { Info, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GapLabels, GapWorkflow } from "./types";

export function GapQuestionnaireStep({
  workflow,
  labels,
  answers,
  savedAnswers = answers,
  busy,
  saveState,
  onAnswer,
  onContinue,
}: {
  workflow: GapWorkflow;
  labels: GapLabels;
  answers: Record<string, string>;
  savedAnswers?: Record<string, string>;
  busy: boolean;
  saveState: "idle" | "saving" | "saved" | "error" | "conflict";
  onAnswer: (questionId: string, optionId: string) => Promise<void>;
  onContinue: () => void;
}) {
  const release = workflow.release!;
  const [categoryIndex, setCategoryIndex] = useState(0);
  const categories = useMemo(
    () =>
      [...release.requirements]
        .sort((left, right) => left.position - right.position)
        .map((requirement) => ({
          ...requirement,
          questions: release.questions.filter((question) =>
            requirement.questionStableKeys.includes(question.stableKey),
          ),
        })),
    [release],
  );
  const category = categories[categoryIndex];
  if (!category) return null;
  const requiredQuestions = release.questions.filter(
    (question) => question.required,
  );
  const missing = category.questions.filter(
    (question) => question.required && !answers[question.id],
  );
  const answeredCount = requiredQuestions.filter(
    (question) => answers[question.id],
  ).length;
  const requiredCount = requiredQuestions.length;
  const savedAnsweredCount = requiredQuestions.filter(
    (question) => savedAnswers[question.id],
  ).length;
  const progressPercent =
    requiredCount === 0 ? 0 : Math.round((answeredCount / requiredCount) * 100);
  const currentQuestionId =
    requiredQuestions.find((question) => !answers[question.id])?.id ??
    requiredQuestions.at(-1)?.id;
  const questionNumberById = new Map(
    release.questions.map((question, index) => [question.id, index + 1]),
  );
  const isLast = categoryIndex === categories.length - 1;

  function move(nextIndex: number) {
    setCategoryIndex(nextIndex);
  }

  const questionProgress = labels.questionProgress
    .replace("{answered}", String(answeredCount))
    .replace("{total}", String(requiredCount));

  return (
    <section
      aria-labelledby="gap-step-heading"
      data-gap-questionnaire
      className="w-full max-w-[1202px]"
    >
      <div className="mt-6 sm:mt-8 lg:mt-10">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
          <ol
            aria-label={questionProgress}
            className="flex min-w-0 items-center justify-between gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
          >
            {requiredQuestions.map((question, index) => {
              const answered = Boolean(answers[question.id]);
              const current = question.id === currentQuestionId;
              return (
                <li
                  key={question.id}
                  aria-current={current ? "step" : undefined}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs leading-4 font-medium transition-colors ${
                    current
                      ? "border-[#002BFF] bg-[#002BFF] text-white"
                      : answered
                        ? "border-transparent bg-[#46A95A] text-white outline outline-1 outline-offset-[-1px] outline-black"
                        : "border-[#3D4049] bg-[#252832] text-slate-300"
                  }`}
                >
                  {index + 1}
                </li>
              );
            })}
          </ol>
          <span aria-hidden="true" />
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2">
          <div
            className="h-3 overflow-hidden rounded-full bg-[#4A4D56]"
            role="progressbar"
            aria-label={questionProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-[#002BFF] transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-right text-sm whitespace-nowrap text-slate-200">
            {progressPercent} %
          </span>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
          <p className="col-span-2 text-right text-sm text-slate-200">
            {questionProgress}
          </p>
        </div>
        {savedAnsweredCount !== answeredCount ||
        saveState === "saving" ||
        saveState === "error" ? (
          <p className="mt-1 text-right text-xs text-slate-400">
            {labels.savedQuestionProgress
              .replace("{answered}", String(savedAnsweredCount))
              .replace("{total}", String(requiredCount))}
          </p>
        ) : null}
        <div aria-live="polite" className="min-h-5 text-right text-sm">
          {saveState === "saved" ? (
            <span className="text-slate-400">{labels.saved}</span>
          ) : saveState === "conflict" ? (
            <span className="text-destructive">{labels.draftConflict}</span>
          ) : saveState === "error" ? (
            <span className="text-destructive">{labels.saveError}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-7 sm:mt-9">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
          {labels.categoryProgress
            .replace("{current}", String(categoryIndex + 1))
            .replace("{total}", String(categories.length))}
        </p>
        <h2
          id="gap-step-heading"
          tabIndex={-1}
          className="mt-2 text-xl font-medium text-white outline-none"
        >
          {category.title}
        </h2>
      </div>

      <form
        className="mt-6 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) onContinue();
          else void move(categoryIndex + 1);
        }}
      >
        <TooltipProvider>
          {category.questions.map((question) => {
            const questionNumber = questionNumberById.get(question.id);
            return (
              <fieldset
                key={question.id}
                className="rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] px-5 py-6 text-white shadow-sm sm:px-8 sm:py-7"
              >
                <legend className="sr-only">
                  {question.questionText} · {labels.required}
                </legend>
                <div className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#3D4049] bg-[#252832] text-xs font-medium text-slate-200">
                    {questionNumber}
                  </span>
                  <div className="flex min-w-0 items-start gap-2 pt-0.5">
                    <p className="text-sm leading-6 font-medium text-white sm:text-base">
                      {question.questionText}
                    </p>
                    {question.helpText ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={question.helpText}
                            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002BFF]"
                          >
                            <Info className="size-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={10}
                          className="inline-flex h-32 w-80 max-w-[calc(100vw-2rem)] items-center justify-center gap-2.5 rounded-xl bg-neutral-200 px-4 py-3 text-center font-sans text-xs leading-5 font-normal text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] [&>svg]:bg-neutral-200 [&>svg]:fill-neutral-200"
                        >
                          {question.helpText}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-[#3D4049] bg-[#292C35] px-4 py-2 text-center text-sm text-slate-100 transition-colors hover:border-[#596071] hover:bg-[#30333D] has-[:checked]:border-[#002BFF] has-[:checked]:bg-[#102454] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#002BFF] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        onChange={() => void onAnswer(question.id, option.id)}
                        disabled={!workflow.canContribute || busy}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </TooltipProvider>

        {missing.length > 0 ? (
          <p className="text-sm text-slate-400">{labels.categoryIncomplete}</p>
        ) : null}

        <div className="grid w-full grid-cols-2 items-center gap-3 pt-1 sm:flex sm:justify-end">
          {categoryIndex > 0 ? (
            <Button
              data-eigenschaft-1="Anmelden"
              type="button"
              variant="outline"
              className="h-12 w-full justify-center overflow-hidden rounded-lg border-0 p-0 font-sans text-base font-medium shadow-none sm:w-56"
              style={{
                backgroundColor: "#002BFF80",
                color: "#FFFFFF80",
              }}
              onClick={() => move(categoryIndex - 1)}
            >
              <span
                className="w-full text-center font-sans text-base font-medium"
                style={{ color: "#FFFFFF80" }}
              >
                {labels.previousCategory}
              </span>
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          {workflow.canContribute ? (
            <Button
              data-eigenschaft-1="Anmelden"
              disabled={
                busy ||
                saveState === "error" ||
                saveState === "conflict" ||
                missing.length > 0
              }
              type="submit"
              className={`relative h-12 w-full justify-center overflow-hidden rounded-lg p-0 font-sans text-base font-medium text-white ${
                isLast
                  ? "bg-[#002BFF] hover:bg-[#123BFF] sm:w-60"
                  : "bg-[#002BFF] hover:bg-[#123BFF] sm:w-56"
              }`}
            >
              <span className="flex w-full items-center justify-center gap-2 px-5 font-sans text-base font-medium text-white">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isLast ? (
                  <DocumentsIcon />
                ) : null}
                <span className="text-center">
                  {isLast ? labels.continueDocuments : labels.nextCategory}
                </span>
              </span>
            </Button>
          ) : (
            <p className="text-sm text-slate-400">{labels.readOnly}</p>
          )}
        </div>
      </form>
    </section>
  );
}

function DocumentsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-auto"
      width="15"
      height="12"
      viewBox="0 0 15 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 15, height: 12 }}
    >
      <path
        d="M3.33171 7.30851L4.33171 5.55707C4.44042 5.36147 4.60579 5.19633 4.81011 5.07931C5.01444 4.96229 5.25004 4.8978 5.49171 4.89273H12.665M12.665 4.89273C12.8687 4.8924 13.0698 4.93436 13.2528 5.01538C13.4358 5.0964 13.5959 5.21432 13.7208 5.3601C13.8456 5.50588 13.932 5.67564 13.9732 5.85636C14.0144 6.03707 14.0093 6.22393 13.9584 6.40259L12.9317 10.0263C12.8574 10.2869 12.6892 10.5176 12.4537 10.6817C12.2181 10.8459 11.9288 10.934 11.6317 10.9322H1.99837C1.64475 10.9322 1.30561 10.8049 1.05556 10.5784C0.805515 10.3519 0.665039 10.0447 0.665039 9.7243V1.87299C0.665039 1.55264 0.805515 1.24541 1.05556 1.01888C1.30561 0.792357 1.64475 0.665097 1.99837 0.665097H4.59837C4.82136 0.663117 5.04134 0.711836 5.23817 0.806795C5.435 0.901755 5.6024 1.03992 5.72504 1.20865L6.26504 1.93339C6.38645 2.1004 6.55172 2.23749 6.74604 2.33236C6.94036 2.42722 7.15763 2.47691 7.37837 2.47694H11.3317C11.6853 2.47694 12.0245 2.6042 12.2745 2.83072C12.5246 3.05725 12.665 3.36448 12.665 3.68483V4.89273Z"
        stroke="white"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
