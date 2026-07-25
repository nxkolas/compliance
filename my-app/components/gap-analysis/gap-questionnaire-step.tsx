"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GapLabels, GapWorkflow } from "./types";

export function GapQuestionnaireStep({
  workflow,
  labels,
  answers,
  busy,
  onAnswer,
  onContinue,
}: {
  workflow: GapWorkflow;
  labels: GapLabels;
  answers: Record<string, string>;
  busy: boolean;
  onAnswer: (questionId: string, optionId: string) => void;
  onContinue: () => void;
}) {
  const release = workflow.release!;
  const missing = release.questions.filter(
    (question) => question.required && !answers[question.id],
  );
  return (
    <section aria-labelledby="gap-step-heading" className="grid gap-5">
      <div>
        <h2
          id="gap-step-heading"
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {labels.steps.questions}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.stepDescriptions.questions}
        </p>
      </div>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
      >
        {release.questions.map((question) => (
          <fieldset key={question.id} className="rounded-lg border p-4">
            <legend className="px-1 font-semibold">
              {question.questionText}{" "}
              {question.required ? (
                <span className="text-xs text-muted-foreground">
                  · {labels.required}
                </span>
              ) : null}
            </legend>
            {question.helpText ? (
              <p className="mb-3 text-sm text-muted-foreground">
                {question.helpText}
              </p>
            ) : null}
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
                    onChange={() => onAnswer(question.id, option.id)}
                    disabled={!workflow.canContribute}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {workflow.canContribute ? (
          <Button
            className="justify-self-start"
            disabled={busy || missing.length > 0}
            type="submit"
          >
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            {labels.continueDocuments}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
        )}
      </form>
    </section>
  );
}
