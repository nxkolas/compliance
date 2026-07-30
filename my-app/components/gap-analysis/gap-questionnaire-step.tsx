"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GapLabels, GapWorkflow } from "./types";
import { GapCategoryIcon } from "./gap-category-icon";

export function GapQuestionnaireStep({
  workflow,
  labels,
  answers,
  busy,
  saveState,
  onAnswer,
  onContinue,
}: {
  workflow: GapWorkflow;
  labels: GapLabels;
  answers: Record<string, string>;
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
  const missing = category.questions.filter(
    (question) => question.required && !answers[question.id],
  );
  const answeredCount = release.questions.filter(
    (question) => question.required && answers[question.id],
  ).length;
  const isLast = categoryIndex === categories.length - 1;

  function move(nextIndex: number) {
    setCategoryIndex(nextIndex);
  }

  return (
    <section aria-labelledby="gap-step-heading" className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-primary">
          {labels.categoryProgress
            .replace("{current}", String(categoryIndex + 1))
            .replace("{total}", String(categories.length))}
        </p>
        <h2
          id="gap-step-heading"
          tabIndex={-1}
          className="mt-1 flex items-center gap-2 text-xl font-semibold outline-none"
        >
          <GapCategoryIcon name={category.icon} />
          {category.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.questionProgress
            .replace("{answered}", String(answeredCount))
            .replace("{total}", String(release.questions.length))}
        </p>
      </div>
      <div
        aria-live="polite"
        className="min-h-5 text-sm text-muted-foreground"
      >
        {saveState === "saved" ? (
          labels.saved
        ) : saveState === "conflict" ? (
          <span className="text-destructive">{labels.draftConflict}</span>
        ) : saveState === "error" ? (
          <span className="text-destructive">{labels.saveError}</span>
        ) : null}
      </div>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) onContinue();
          else void move(categoryIndex + 1);
        }}
      >
        {category.questions.map((question) => (
          <fieldset key={question.id} className="rounded-lg border p-4">
            <legend className="px-1 font-semibold">
              {question.questionText}{" "}
              <span className="text-xs text-muted-foreground">
                · {labels.required}
              </span>
            </legend>
            <p className="mb-3 text-sm text-muted-foreground">
              {question.helpText}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
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
        ))}
        {missing.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {labels.categoryIncomplete}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={categoryIndex === 0}
            onClick={() => move(categoryIndex - 1)}
          >
            <ChevronLeft />
            {labels.previousCategory}
          </Button>
          {workflow.canContribute ? (
            <Button
              disabled={
                busy ||
                saveState === "error" ||
                saveState === "conflict" ||
                missing.length > 0
              }
              type="submit"
            >
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : isLast ? (
                <CheckCircle2 />
              ) : (
                <ChevronRight />
              )}
              {isLast ? labels.continueDocuments : labels.nextCategory}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
          )}
        </div>
      </form>
    </section>
  );
}
