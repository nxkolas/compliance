"use client";

import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getVisibleOptions,
  getVisibleQuestions,
  isAnswered,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check/question-visibility";
import type {
  ApplicabilityQuestionDto,
  ApplicabilityQuestionnaireDto,
} from "@/src/server/applicability-check/service";
import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { localizeUiError } from "@/lib/i18n/errors";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Info,
  Loader2,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  aggregationAutoAnswer,
  isSizeDecisive,
  shouldSubmitAfter,
} from "./wizard-flow";

export type ApplicabilityWizardLabels = {
  progress: string;
  of: string;
  answered: string;
  step: string;
  previous: string;
  next: string;
  submit: string;
  submitting: string;
  submitError: string;
  allRequired: string;
  moreInformation: string;
  showDefinition: string;
};

type ApplicabilityWizardProps = {
  submitUrl: string;
  successUrl: string;
  navigationMode?: "router" | "document";
  questionnaire: ApplicabilityQuestionnaireDto;
  labels: ApplicabilityWizardLabels;
};

type RequestState = {
  message: string | null;
  tone: "default" | "error";
};

export function ApplicabilityWizard({
  submitUrl,
  successUrl,
  navigationMode = "router",
  questionnaire,
  labels,
}: ApplicabilityWizardProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<
    Record<string, ApplicabilityAnswerValue>
  >({
    ...questionnaire.defaultAnswers,
    ...questionnaire.latestAnswers,
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questionnaire.questions, answers),
    [answers, questionnaire.questions],
  );
  const activeIndex = Math.min(
    currentStepIndex,
    Math.max(visibleQuestions.length - 1, 0),
  );
  const activeQuestion = visibleQuestions[activeIndex];
  const requiredQuestions = visibleQuestions.filter(
    (question) => question.required,
  );
  const answeredRequired = requiredQuestions.filter((question) =>
    isAnswered(answers[question.id]),
  ).length;
  const progressPercent =
    requiredQuestions.length === 0
      ? 100
      : Math.round((answeredRequired / requiredQuestions.length) * 100);
  const submitDue = activeQuestion
    ? shouldSubmitAfter(
        activeQuestion.stableKey,
        answers,
        visibleQuestions,
      )
    : false;
  const canContinue = activeQuestion
    ? isAnswered(answers[activeQuestion.id])
    : false;

  function updateAnswer(
    question: ApplicabilityQuestionDto,
    value: ApplicabilityAnswerValue,
  ) {
    setAnswers((current) => {
      const next = { ...current, [question.id]: value };
      for (const candidate of questionnaire.questions) {
        if (candidate.position > question.position) {
          delete next[candidate.id];
        }
      }
      return next;
    });
    setNotice({ message: null, tone: "default" });
  }

  function navigateBack() {
    setCurrentStepIndex(Math.max(activeIndex - 1, 0));
  }

  function handleNext() {
    if (!activeQuestion || !canContinue) return;
    if (submitDue) {
      void submit();
      return;
    }
    setCurrentStepIndex(activeIndex + 1);
  }

  async function submit() {
    if (!activeQuestion) return;
    setIsSubmitting(true);
    setNotice({ message: null, tone: "default" });
    try {
      const payloadAnswers = visibleQuestions
        .filter((question) => isAnswered(answers[question.id]))
        .map((question) => ({
          questionId: question.id,
          value: answers[question.id],
        }));
      const aggregation = visibleQuestions.find(
        (question) => question.stableKey === "bc.aggregation",
      );
      if (
        aggregation &&
        !isAnswered(answers[aggregation.id]) &&
        isSizeDecisive(visibleQuestions, answers)
      ) {
        payloadAnswers.push({
          questionId: aggregation.id,
          value: aggregationAutoAnswer(),
        });
      }
      const response = await applicabilityCheckClient.submit(
        submitUrl,
        {
          guestSession: questionnaire.guestSession,
          locale: questionnaire.locale,
          answers: payloadAnswers,
        },
        questionnaire.guestSession?.token,
      );
      const nextUrl = response.data.resultUrl ?? successUrl;
      if (navigationMode === "document") {
        window.location.assign(nextUrl);
        return;
      }
      router.push(nextUrl);
      router.refresh();
    } catch (error) {
      setNotice({
        message: localizeUiError(error, {
          fallback: labels.submitError,
          codeMessages: {
            APPLICABILITY_RECALCULATION_LOCKED: labels.submitError,
          },
        }),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitDue && canContinue) {
      void submit();
      return;
    }
    if (requiredQuestions.some((question) => !isAnswered(answers[question.id]))) {
      setNotice({ message: labels.allRequired, tone: "error" });
      return;
    }
    void submit();
  }

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-6 lg:gap-8"
      onSubmit={handleSubmit}
    >
      {notice.message ? (
        <Alert
          variant={notice.tone === "error" ? "destructive" : "default"}
          className="break-words rounded-md border px-4 py-3 text-sm"
        >
          <AlertDescription className="min-w-0 break-words text-current">
            {notice.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {labels.step} {Math.min(activeIndex + 1, visibleQuestions.length)}{" "}
            {labels.of} {visibleQuestions.length}
          </p>
          <div className="min-w-52 flex-1 sm:max-w-md">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>{labels.progress}</span>
              <span>
                {answeredRequired} {labels.of} {requiredQuestions.length}{" "}
                {labels.answered}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </div>
      </div>

      {activeQuestion ? (
        <TooltipProvider>
          <QuestionCard
            answer={answers[activeQuestion.id] ?? ""}
            allAnswers={answers}
            contentByStableKey={questionnaire.contentByStableKey}
            labels={labels}
            onChange={(value) => updateAnswer(activeQuestion, value)}
            question={activeQuestion}
            questions={visibleQuestions}
            stepNumber={activeIndex + 1}
          />
        </TooltipProvider>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {activeIndex > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={navigateBack}
            className="h-12 w-full rounded-lg bg-primary/50 px-0 hover:bg-primary/60 sm:w-28"
          >
            <ArrowLeft className="text-primary-foreground/50" />
            <span className="font-['Space_Grotesk'] text-base font-medium text-primary-foreground/50">
              {labels.previous}
            </span>
          </Button>
        ) : null}
        <Button
          type={submitDue ? "submit" : "button"}
          size="lg"
          disabled={isSubmitting || !canContinue}
          onClick={submitDue ? undefined : handleNext}
          className="h-12 w-full rounded-lg px-8 text-base font-medium uppercase sm:w-auto"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : submitDue ? <Save /> : null}
          {isSubmitting
            ? labels.submitting
            : submitDue
              ? labels.submit
              : labels.next}
        </Button>
      </div>
    </form>
  );
}

type QuestionCardProps = {
  answer: ApplicabilityAnswerValue;
  allAnswers: Record<string, ApplicabilityAnswerValue>;
  contentByStableKey: Record<string, string>;
  labels: ApplicabilityWizardLabels;
  onChange: (value: ApplicabilityAnswerValue) => void;
  question: ApplicabilityQuestionDto;
  questions: ApplicabilityQuestionDto[];
  stepNumber: number;
};

function QuestionCard({
  answer,
  allAnswers,
  contentByStableKey,
  labels,
  onChange,
  question,
  questions,
  stepNumber,
}: QuestionCardProps) {
  const control = readConfig(question.config)?.ui?.control;
  const visibleOptions =
    getVisibleOptions(questions, question, allAnswers) ?? question.options;

  return (
    <Card
      role="article"
      className="min-w-0 gap-0 rounded-xl border-[1.5px] border-border-strong bg-card py-0 shadow-sm"
    >
      <CardContent className="px-5 py-6 sm:px-8">
        <div className="flex gap-4 sm:gap-6">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-base text-white dark:border-border-strong dark:bg-surface dark:text-foreground">
            {stepNumber}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div>
              <div className="flex min-w-0 flex-wrap items-start gap-2">
                <h3 className="min-w-0 max-w-4xl break-words text-base leading-7 font-semibold text-foreground">
                  {question.questionText}
                </h3>
                {question.tooltipText ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={labels.moreInformation}
                        className="size-6 rounded-full text-foreground-subtle hover:bg-foreground/5 hover:text-foreground"
                      >
                        <Info aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-left leading-5 whitespace-normal text-pretty">
                      {question.tooltipText}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {question.helpText ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {question.helpText}
                </p>
              ) : null}
            </div>

            {question.answerType === "multi_choice" &&
            control === "wizard_sections" ? (
              <SectionedMultiSelect
                answer={Array.isArray(answer) ? answer : []}
                contentByStableKey={contentByStableKey}
                labels={labels}
                onChange={onChange}
                options={visibleOptions}
                sectorQuestion={questions.find(
                  (candidate) => candidate.stableKey === "bc.sector",
                )}
              />
            ) : question.answerType === "multi_choice" ? (
              <MultiChoiceCards
                answer={Array.isArray(answer) ? answer : []}
                onChange={onChange}
                options={visibleOptions}
              />
            ) : (
              <ChoiceButtons
                answer={typeof answer === "string" ? answer : ""}
                onChange={onChange}
                options={visibleOptions}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChoiceButtons({
  answer,
  onChange,
  options,
}: {
  answer: string;
  onChange: (value: ApplicabilityAnswerValue) => void;
  options: ApplicabilityQuestionDto["options"];
}) {
  return (
    <div className="grid w-full items-stretch gap-3 lg:grid-cols-3 lg:gap-6">
      {options.map((option) => {
        const selected = answer === option.stableValue;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.stableValue)}
            className={cn(
              "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-[1.5px] border-border-strong bg-foreground/5 px-4 py-3 text-left text-base font-semibold text-foreground transition-colors hover:border-foreground-subtle hover:bg-foreground/10",
              selected && "border-primary bg-primary/15 text-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              {option.stableValue === "yes" ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : option.stableValue === "no" ? (
                <Circle className="size-4 shrink-0 text-destructive" />
              ) : option.stableValue === "unsure" ? (
                <span className="flex size-4 shrink-0 items-center justify-center text-base font-medium text-warning">
                  ?
                </span>
              ) : selected ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="size-4 shrink-0 text-foreground-subtle" />
              )}
              <span className="break-words">{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceCards({
  answer,
  onChange,
  options,
}: {
  answer: string[];
  onChange: (value: ApplicabilityAnswerValue) => void;
  options: ApplicabilityQuestionDto["options"];
}) {
  function toggle(stableValue: string, exclusive: boolean) {
    if (exclusive) {
      onChange(
        answer.length === 1 && answer[0] === stableValue ? [] : [stableValue],
      );
      return;
    }
    const withoutExclusive = answer.filter(
      (value) => !["none_of_these", "unsure"].includes(value),
    );
    onChange(
      withoutExclusive.includes(stableValue)
        ? withoutExclusive.filter((value) => value !== stableValue)
        : [...withoutExclusive, stableValue],
    );
  }

  return (
    <div className="grid w-full items-stretch gap-3 sm:grid-cols-2 lg:gap-6">
      {options.map((option) => {
        const selected = answer.includes(option.stableValue);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              toggle(
                option.stableValue,
                optionMetadata(option.metadata).exclusive === true,
              )
            }
            className={cn(
              "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-[1.5px] border-border-strong bg-foreground/5 px-4 py-3 text-left text-base font-semibold text-foreground transition-colors hover:border-foreground-subtle hover:bg-foreground/10",
              selected && "border-primary bg-primary/15 text-foreground",
            )}
          >
            <span className="break-words">{option.label}</span>
            {selected ? (
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
            ) : (
              <Circle className="size-4 shrink-0 text-foreground-subtle" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SectionedMultiSelect({
  answer,
  contentByStableKey,
  labels,
  onChange,
  options,
  sectorQuestion,
}: {
  answer: string[];
  contentByStableKey: Record<string, string>;
  labels: ApplicabilityWizardLabels;
  onChange: (value: ApplicabilityAnswerValue) => void;
  options: ApplicabilityQuestionDto["options"];
  sectorQuestion: ApplicabilityQuestionDto | undefined;
}) {
  const groups = useMemo(() => {
    const result = new Map<string, ApplicabilityQuestionDto["options"]>();
    for (const option of options) {
      const sectorCode = optionMetadata(option.metadata).sectorCode;
      const key = typeof sectorCode === "string" ? sectorCode : "other";
      const group = result.get(key) ?? [];
      group.push(option);
      result.set(key, group);
    }
    return [...result.entries()];
  }, [options]);

  function toggle(option: ApplicabilityQuestionDto["options"][number]) {
    const metadata = optionMetadata(option.metadata);
    const sectorCode = typeof metadata.sectorCode === "string"
      ? metadata.sectorCode
      : option.stableValue;
    const groupValues = options
      .filter(
        (candidate) =>
          optionMetadata(candidate.metadata).sectorCode === sectorCode,
      )
      .map((candidate) => candidate.stableValue);

    if (metadata.exclusive === true) {
      const next = answer.filter((value) => !groupValues.includes(value));
      if (!answer.includes(option.stableValue)) next.push(option.stableValue);
      onChange(next);
      return;
    }
    const withoutGroupExclusive = answer.filter((value) => {
      const candidate = options.find(
        (candidate) => candidate.stableValue === value,
      );
      return !(
        candidate &&
        optionMetadata(candidate.metadata).sectorCode === sectorCode &&
        optionMetadata(candidate.metadata).exclusive
      );
    });
    onChange(
      withoutGroupExclusive.includes(option.stableValue)
        ? withoutGroupExclusive.filter((value) => value !== option.stableValue)
        : [...withoutGroupExclusive, option.stableValue],
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {groups.map(([sectorCode, groupOptions]) => {
        const sectorLabel =
          sectorQuestion?.options.find(
            (option) => option.stableValue === sectorCode,
          )?.label ?? sectorCode;
        return (
          <fieldset key={sectorCode} className="min-w-0">
            <legend className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {sectorLabel}
            </legend>
            <div className="grid gap-3 lg:gap-4">
              {groupOptions.map((option) => {
                const metadata = optionMetadata(option.metadata);
                const selected = answer.includes(option.stableValue);
                const helperText =
                  typeof metadata.helperContentKey === "string"
                    ? contentByStableKey[metadata.helperContentKey] ?? null
                    : null;
                const definitionText =
                  typeof metadata.definitionContentKey === "string"
                    ? contentByStableKey[metadata.definitionContentKey] ?? null
                    : null;
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "flex min-h-12 w-full flex-col gap-1 rounded-xl border-[1.5px] border-border-strong bg-foreground/5 px-4 py-3 text-left transition-colors hover:border-foreground-subtle hover:bg-foreground/10",
                      selected && "border-primary bg-primary/15",
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggle(option)}
                        className="min-w-0 flex-1 text-left text-base leading-6 font-semibold text-foreground"
                      >
                        <span className="break-words">{option.label}</span>
                      </button>
                      <span className="flex shrink-0 items-center gap-2">
                        {definitionText ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={labels.showDefinition}
                                className="size-6 rounded-full text-foreground-subtle hover:bg-foreground/5 hover:text-foreground"
                              >
                                <Info aria-hidden="true" className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-left leading-5 whitespace-normal text-pretty">
                              {definitionText}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {selected ? (
                          <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-foreground-subtle" />
                        )}
                      </span>
                    </div>
                    {helperText ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {helperText}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function optionMetadata(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readConfig(value: unknown): {
  ui?: { control?: string };
} | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as { ui?: { control?: string } })
    : null;
}
