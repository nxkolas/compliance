"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/src/server/modules/compliance/runtime-release/question-visibility";
import type {
  ApplicabilityQuestionDto,
  ApplicabilityQuestionnaireDto,
} from "@/src/server/modules/applicability-check";
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
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  aggregationAutoAnswer,
  getWizardProgressQuestions,
  getWizardStepState,
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
  current: string;
  complete: string;
  open: string;
  questionsAnswered: string;
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
  const progressQuestions = getWizardProgressQuestions(
    visibleQuestions,
    activeIndex,
    submitDue,
  );
  const progressRequiredQuestions = progressQuestions.filter(
    (question) => question.required,
  );
  const progressAnsweredRequired = progressRequiredQuestions.filter(
    (question) => isAnswered(answers[question.id]),
  ).length;
  const progressPercent =
    progressRequiredQuestions.length === 0
      ? 100
      : Math.round(
          (progressAnsweredRequired / progressRequiredQuestions.length) * 100,
        );

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
      className="flex w-full min-w-0 flex-col gap-6 font-['Space_Grotesk'] lg:gap-8"
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
        <p className="sr-only">
          {labels.step} {Math.min(activeIndex + 1, visibleQuestions.length)}{" "}
          {labels.of} {progressQuestions.length}
        </p>

        <QuestionStepper
          activeQuestionId={activeQuestion?.id}
          answers={answers}
          labels={labels}
          questions={progressQuestions}
        />

        <div className="grid gap-x-1 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <Progress
              aria-label={labels.progress}
              value={progressPercent}
              className="h-3.5 rounded-[9999px] bg-foreground/30"
            />
          </div>
          <span className="min-w-12 text-right text-base font-semibold text-foreground">
            {progressPercent} %
          </span>
          <span className="flex min-h-14 w-auto items-center justify-self-end whitespace-nowrap text-right font-['Space_Grotesk'] text-base leading-6 font-normal text-foreground sm:col-span-2">
            {progressAnsweredRequired} {labels.of}{" "}
            {progressRequiredQuestions.length}{" "}
            {labels.questionsAnswered}
          </span>
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
          <WizardBackButton label={labels.previous} onClick={navigateBack} />
        ) : null}
        <Button
          type={submitDue ? "submit" : "button"}
          size="lg"
          disabled={isSubmitting || !canContinue}
          onClick={submitDue ? undefined : handleNext}
          className={cn(
            "h-12 w-full rounded-lg px-8 sm:w-auto",
            submitDue
              ? "text-base font-medium uppercase"
              : "overflow-hidden bg-primary hover:bg-primary/90 sm:w-48",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : submitDue ? (
            <Save />
          ) : null}
          {submitDue ? (
            isSubmitting ? labels.submitting : labels.submit
          ) : (
            <span className="font-['Space_Grotesk'] text-base font-medium text-primary-foreground">
              {labels.next}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}

export function WizardBackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      onClick={onClick}
      className="h-12 w-full overflow-hidden rounded-lg bg-primary px-0 hover:bg-primary/90 sm:w-28"
    >
      <ArrowLeft className="text-primary-foreground" />
      <span className="font-['Space_Grotesk'] text-base font-medium text-primary-foreground">
        {label}
      </span>
    </Button>
  );
}

type QuestionStepperProps = {
  activeQuestionId?: string;
  answers: Record<string, ApplicabilityAnswerValue>;
  labels: ApplicabilityWizardLabels;
  questions: ApplicabilityQuestionDto[];
};

function QuestionStepper({
  activeQuestionId,
  answers,
  labels,
  questions,
}: QuestionStepperProps) {
  return (
    <nav
      aria-label={labels.progress}
      className="overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none] sm:pr-[52px] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex w-max min-w-full items-center justify-between gap-3">
        {questions.map((question, index) => {
          const { active, answered } = getWizardStepState(
            question,
            activeQuestionId,
            answers,
          );
          const statusLabel = active
            ? labels.current
            : answered
              ? labels.complete
              : labels.open;

          return (
            <li
              key={question.id}
              className="flex size-10 shrink-0 items-center justify-center"
            >
              <span
                aria-current={active ? "step" : undefined}
                aria-label={`${index + 1}: ${statusLabel}`}
                className={cn(
                  "flex size-10 items-center justify-center",
                  index === 0 && "justify-start",
                  index === questions.length - 1 && "justify-end",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full bg-foreground-subtle/25 text-center font-['Space_Grotesk'] text-sm leading-none font-normal tabular-nums text-white outline outline-1 outline-offset-[-1px] outline-transparent transition-colors dark:text-foreground/60",
                    answered &&
                      "bg-[#46A95A] font-semibold text-white outline-transparent dark:bg-success dark:text-foreground dark:outline-success-foreground/70",
                    active && "size-10 text-base font-semibold ring-4",
                    active &&
                      !answered &&
                      "bg-primary text-primary-foreground ring-primary/20",
                    active &&
                      answered &&
                      "bg-[#46A95A] text-white ring-[#46A95A]/20 dark:bg-success dark:text-foreground dark:ring-success/20",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center leading-none"
                  >
                    {index + 1}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
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
              <div className="flex min-w-0 flex-nowrap items-start gap-2">
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
                <X className="size-4 shrink-0 text-destructive" />
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

export function SectionedMultiSelect({
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
            {sectorCode !== "other" ? (
              <legend className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {sectorLabel}
              </legend>
            ) : null}
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
                  <SectionedOptionCard
                    key={option.id}
                    definitionText={definitionText}
                    helperText={helperText}
                    labels={labels}
                    onSelect={() => toggle(option)}
                    option={option}
                    selected={selected}
                  />
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function SectionedOptionCard({
  definitionText,
  helperText,
  labels,
  onSelect,
  option,
  selected,
}: {
  definitionText: string | null;
  helperText: string | null;
  labels: ApplicabilityWizardLabels;
  onSelect: () => void;
  option: ApplicabilityQuestionDto["options"][number];
  selected: boolean;
}) {
  const card = (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-12 w-full flex-col items-stretch justify-center gap-1 rounded-xl border-[1.5px] border-border-strong bg-foreground/5 py-3 pr-12 pl-4 text-left text-base font-semibold text-foreground transition-colors hover:border-foreground-subtle hover:bg-foreground/10",
        selected && "border-primary bg-primary/15 text-foreground",
      )}
    >
      <span className="flex w-full min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 break-words leading-6">{option.label}</span>
        {definitionText ? (
          <span
            role="img"
            aria-label={labels.showDefinition}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-foreground-subtle"
          >
            <Info aria-hidden="true" className="h-4 w-4" />
          </span>
        ) : null}
      </span>
      {helperText ? (
        <span className="text-sm leading-6 font-normal text-muted-foreground">
          {helperText}
        </span>
      ) : null}
      <span
        data-selection-indicator
        className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center"
      >
        {selected ? (
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
        ) : (
          <Circle className="size-4 shrink-0 text-foreground-subtle" />
        )}
      </span>
    </button>
  );

  return definitionText ? (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent className="max-w-sm text-left leading-5 whitespace-normal text-pretty">
        {definitionText}
      </TooltipContent>
    </Tooltip>
  ) : card;
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
