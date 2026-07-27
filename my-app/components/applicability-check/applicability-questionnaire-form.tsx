"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getQuestionControl,
  getVisibleQuestions,
  isAnswered,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check/question-visibility";
import {
  catalogOptionsForCountry,
  reconcileCatalogAnswers,
} from "@/src/server/applicability-check/entity-catalog";
import type {
  ApplicabilityQuestionDto,
  ApplicabilityQuestionnaireDto,
} from "@/src/server/applicability-check/service";
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
import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { localizeUiError } from "@/lib/i18n/errors";

type ApplicabilityQuestionnaireFormProps = {
  submitUrl: string;
  successUrl: string;
  navigationMode?: "router" | "document";
  presentation?: "default" | "authenticated-stepper";
  questionnaire: ApplicabilityQuestionnaireDto;
  labels: ApplicabilityQuestionnaireFormLabels;
};

type RequestState = {
  message: string | null;
  tone: "default" | "error";
};

type ApplicabilityQuestionnaireFormLabels = {
  progress: string;
  answered: string;
  of: string;
  selectPlaceholder: string;
  noResults: string;
  required: string;
  moreInformation: string;
  previous: string;
  next: string;
  current: string;
  complete: string;
  open: string;
  questionsAnswered: string;
  submit: string;
  submitting: string;
  submitError: string;
  recalculationLocked: string;
  allRequired: string;
};

export function ApplicabilityQuestionnaireForm({
  submitUrl,
  successUrl,
  navigationMode = "router",
  presentation = "default",
  questionnaire,
  labels,
}: ApplicabilityQuestionnaireFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<
    Record<string, ApplicabilityAnswerValue>
  >({
    ...questionnaire.defaultAnswers,
    ...questionnaire.latestAnswers,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interactedQuestionIds, setInteractedQuestionIds] = useState<
    Set<string>
  >(() => new Set());
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });
  const catalogQuestions = useMemo(() => {
    const countryQuestion = questionnaire.questions.find(
      (question) => question.stableKey === "bc.jurisdiction_country",
    );
    const countryAnswer = countryQuestion
      ? answers[countryQuestion.id]
      : undefined;
    const countryCode = typeof countryAnswer === "string" ? countryAnswer : null;
    const nationalCatalogCode = countryCode ? `country:${countryCode}` : null;
    const entityCatalogCode =
      nationalCatalogCode && questionnaire.entityCatalogs[nationalCatalogCode]
        ? nationalCatalogCode
        : "eu_core";
    return questionnaire.questions.map((question) => ({
      ...question,
      options:
        question.stableKey === "bc.entity_types"
          ? questionnaire.entityCatalogs[entityCatalogCode] ?? question.options
          : catalogOptionsForCountry(question.options, countryCode),
    }));
  }, [answers, questionnaire.entityCatalogs, questionnaire.questions]);
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(catalogQuestions, answers),
    [answers, catalogQuestions],
  );
  const requiredQuestions = useMemo(
    () => visibleQuestions.filter((question) => question.required),
    [visibleQuestions],
  );
  const completedRequiredQuestions = requiredQuestions.filter(
    (question) => isAnswered(answers[question.id]),
  ).length;
  const completedQuestions = catalogQuestions.filter(
    (question) =>
      interactedQuestionIds.has(question.id) &&
      isAnswered(answers[question.id]),
  ).length;
  const progress =
    requiredQuestions.length === 0
      ? 100
      : Math.round(
          (completedRequiredQuestions / requiredQuestions.length) * 100,
        );
  const questionnaireProgress =
    catalogQuestions.length === 0
      ? 100
      : Math.round((completedQuestions / catalogQuestions.length) * 100);
  const requiredComplete =
    completedRequiredQuestions === requiredQuestions.length;
  const activeQuestionIndex = Math.min(
    currentQuestionIndex,
    Math.max(visibleQuestions.length - 1, 0),
  );

  function updateAnswer(
    question: ApplicabilityQuestionDto,
    value: ApplicabilityAnswerValue,
  ) {
    setAnswers((current) =>
      reconcileCatalogAnswers(questionnaire.questions, {
        ...current,
        [question.id]: value,
      }),
    );
    setInteractedQuestionIds((current) => {
      const next = new Set(current);
      next.add(question.id);
      return next;
    });
    setNotice({ message: null, tone: "default" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requiredComplete) {
      setNotice({ message: labels.allRequired, tone: "error" });
      return;
    }

    setIsSubmitting(true);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await applicabilityCheckClient.submit(submitUrl, {
          guestSession: questionnaire.guestSession,
          answers: visibleQuestions
            .filter((question) => isAnswered(answers[question.id]))
            .map((question) => ({
              questionId: question.id,
              value: answers[question.id],
            })),
        }, questionnaire.guestSession?.token);
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
            APPLICABILITY_RECALCULATION_LOCKED: labels.recalculationLocked,
          },
        }),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={cn(
        "flex flex-col gap-6",
        presentation === "authenticated-stepper" &&
          "font-['Space_Grotesk'] lg:gap-8",
      )}
      onSubmit={handleSubmit}
    >
      {notice.message ? (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            notice.tone === "error" &&
              "border-destructive/40 bg-destructive/10 text-foreground",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      {presentation === "authenticated-stepper" ? (
        <AuthenticatedQuestionnaire
          activeQuestionIndex={activeQuestionIndex}
          allQuestions={catalogQuestions}
          answers={answers}
          completedQuestions={completedQuestions}
          isSubmitting={isSubmitting}
          labels={labels}
          onAnswerChange={updateAnswer}
          onQuestionSelect={setCurrentQuestionIndex}
          progress={questionnaireProgress}
          requiredComplete={requiredComplete}
          questionCount={catalogQuestions.length}
          visibleQuestions={visibleQuestions}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {questionnaire.versionLabel}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {questionnaire.title}
                </h2>
              </div>
              <div className="min-w-52">
                <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{labels.progress}</span>
                  <span>
                    {completedRequiredQuestions} {labels.of}{" "}
                    {requiredQuestions.length} {labels.answered}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </div>

          <TooltipProvider>
            <div className="flex flex-col gap-4">
              {visibleQuestions.map((question) => (
                <QuestionBlock
                  key={question.id}
                  answer={answers[question.id] ?? ""}
                  labels={labels}
                  onChange={(value) => updateAnswer(question, value)}
                  question={question}
                />
              ))}
            </div>
          </TooltipProvider>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || !requiredComplete}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
              {isSubmitting ? labels.submitting : labels.submit}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

type AuthenticatedQuestionnaireProps = {
  activeQuestionIndex: number;
  allQuestions: ApplicabilityQuestionDto[];
  answers: Record<string, ApplicabilityAnswerValue>;
  completedQuestions: number;
  isSubmitting: boolean;
  labels: ApplicabilityQuestionnaireFormLabels;
  onAnswerChange: (
    question: ApplicabilityQuestionDto,
    value: ApplicabilityAnswerValue,
  ) => void;
  onQuestionSelect: (index: number) => void;
  progress: number;
  questionCount: number;
  requiredComplete: boolean;
  visibleQuestions: ApplicabilityQuestionDto[];
};

function AuthenticatedQuestionnaire({
  activeQuestionIndex,
  allQuestions,
  answers,
  completedQuestions,
  isSubmitting,
  labels,
  onAnswerChange,
  onQuestionSelect,
  progress,
  questionCount,
  requiredComplete,
  visibleQuestions,
}: AuthenticatedQuestionnaireProps) {
  const activeQuestion = visibleQuestions[activeQuestionIndex];
  const isLastQuestion =
    activeQuestionIndex === Math.max(visibleQuestions.length - 1, 0);
  const showSubmit = isLastQuestion && requiredComplete;
  const activeQuestionAnswered = activeQuestion
    ? isAnswered(answers[activeQuestion.id])
    : false;
  const canContinue =
    activeQuestionAnswered || Boolean(activeQuestion && !activeQuestion.required);

  return (
    <>
      <div className="flex flex-col gap-5">
        <QuestionStepper
          activeQuestionId={activeQuestion?.id}
          answers={answers}
          labels={labels}
          onQuestionSelect={onQuestionSelect}
          questions={allQuestions}
          visibleQuestions={visibleQuestions}
        />

        <div className="grid gap-x-1 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <Progress
              aria-label={labels.progress}
              value={progress}
              className="h-3.5 rounded-[9999px] bg-neutral-50/30"
            />
          </div>
          <span className="min-w-12 text-right text-base font-semibold text-white">
            {progress} %
          </span>
          <span className="h-14 w-56 justify-self-end text-left font-['Space_Grotesk'] text-base leading-[54px] font-normal text-white sm:col-span-2">
            {completedQuestions} {labels.of} {questionCount}{" "}
            {labels.questionsAnswered}
          </span>
        </div>
      </div>

      {activeQuestion ? (
        <TooltipProvider>
          <QuestionBlock
            answer={answers[activeQuestion.id] ?? ""}
            labels={labels}
            onChange={(value) => onAnswerChange(activeQuestion, value)}
            presentation="authenticated-stepper"
            question={activeQuestion}
            stepNumber={activeQuestionIndex + 1}
          />
        </TooltipProvider>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {activeQuestionIndex > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onQuestionSelect(activeQuestionIndex - 1)}
            className="h-12 w-28 overflow-hidden rounded-lg bg-[#002BFF]/50 px-0 hover:bg-[#002BFF]/60"
          >
            <ArrowLeft className="text-white/50" />
            <span className="font-['Space_Grotesk'] text-base font-medium text-white/50">
              {labels.previous}
            </span>
          </Button>
        ) : null}

        {showSubmit ? (
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !requiredComplete}
            className="h-12 w-full rounded-lg px-8 text-base font-medium uppercase sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
            {isSubmitting ? labels.submitting : labels.submit}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled={!canContinue}
            onClick={() => onQuestionSelect(activeQuestionIndex + 1)}
            className="h-12 w-48 overflow-hidden rounded-lg bg-[#002BFF] px-8 hover:bg-[#002BFF]/90"
          >
            <span className="font-['Space_Grotesk'] text-base font-medium text-white">
              {labels.next}
            </span>
          </Button>
        )}
      </div>

    </>
  );
}

type QuestionStepperProps = {
  activeQuestionId?: string;
  answers: Record<string, ApplicabilityAnswerValue>;
  labels: ApplicabilityQuestionnaireFormLabels;
  onQuestionSelect: (index: number) => void;
  questions: ApplicabilityQuestionDto[];
  visibleQuestions: ApplicabilityQuestionDto[];
};

function QuestionStepper({
  activeQuestionId,
  answers,
  labels,
  onQuestionSelect,
  questions,
  visibleQuestions,
}: QuestionStepperProps) {
  return (
    <nav
      aria-label={labels.progress}
      className="overflow-x-auto pb-2 sm:overflow-visible sm:pr-[52px]"
    >
      <ol className="flex min-w-[60rem] items-center justify-between sm:w-full sm:min-w-0">
        {questions.map((question, index) => {
          const active = question.id === activeQuestionId;
          const visibleQuestionIndex = visibleQuestions.findIndex(
            (visibleQuestion) => visibleQuestion.id === question.id,
          );
          const answered =
            visibleQuestionIndex >= 0 && isAnswered(answers[question.id]);
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
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-label={`${index + 1}: ${statusLabel}`}
                disabled={visibleQuestionIndex < 0}
                onClick={() => onQuestionSelect(visibleQuestionIndex)}
                className="group flex w-full items-center justify-center rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center",
                    index === 0 && "justify-start",
                    index === questions.length - 1 && "justify-end",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full bg-zinc-600/25 text-center font-['Space_Grotesk'] text-base leading-4 font-normal text-white/60 outline outline-1 outline-offset-[-1px] outline-white/0 transition-colors",
                      active &&
                        "size-10 bg-primary font-semibold text-white ring-4 ring-primary/20",
                    )}
                  >
                    {index + 1}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type QuestionBlockProps = {
  answer: ApplicabilityAnswerValue;
  labels: ApplicabilityQuestionnaireFormLabels;
  onChange: (value: ApplicabilityAnswerValue) => void;
  presentation?: "default" | "authenticated-stepper";
  question: ApplicabilityQuestionDto;
  stepNumber?: number;
};

function QuestionBlock({
  answer,
  labels,
  onChange,
  presentation = "default",
  question,
  stepNumber,
}: QuestionBlockProps) {
  const control = getQuestionControl(question.config);
  const isMultiChoice = question.answerType === "multi_choice";
  const renderAsSelect = control === "select" || question.options.length > 6;
  const comboboxOptions = question.options.map((option) => ({
    value: option.stableValue,
    label: option.label,
  }));
  const selectedComboboxOption =
    comboboxOptions.find(
      (option) => typeof answer === "string" && option.value === answer,
    ) ?? null;
  const authenticated = presentation === "authenticated-stepper";

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-5 shadow-sm",
        authenticated &&
          "rounded-xl border-[1.5px] border-[#3D4149] bg-[#1B1E27] px-5 py-6 sm:px-8",
      )}
    >
      <div className={cn("flex gap-4", authenticated && "gap-4 sm:gap-6")}>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold",
            authenticated &&
              "size-8 rounded-full border-[1.5px] border-zinc-700 bg-gray-800 text-base text-white",
          )}
        >
          {stepNumber ?? question.position}
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4",
            authenticated && "gap-6",
          )}
        >
          <div>
            <div
              className={cn(
                "flex flex-wrap items-start gap-2",
                authenticated && "flex-nowrap",
              )}
            >
              <h3
                className={cn(
                  "text-base font-semibold leading-7",
                  authenticated && "max-w-4xl text-white",
                )}
              >
                {question.questionText}
              </h3>
              {question.tooltipText ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={labels.moreInformation}
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        authenticated &&
                          "size-6 rounded-full text-zinc-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Info aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm whitespace-normal text-left leading-5 text-pretty">
                    {question.tooltipText}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {question.required ? (
                <span
                  className={cn(
                    "mt-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground",
                    authenticated && "sr-only",
                  )}
                >
                  {labels.required}
                </span>
              ) : null}
            </div>
            {question.helpText ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {question.helpText}
              </p>
            ) : null}
          </div>

          {isMultiChoice ? (
            <SearchableMultiSelect
              answer={Array.isArray(answer) ? answer : []}
              labels={labels}
              onChange={onChange}
              presentation={presentation}
              question={question}
            />
          ) : renderAsSelect ? (
            <Combobox
              items={comboboxOptions}
              value={selectedComboboxOption}
              onValueChange={(option) => onChange(option?.value ?? "")}
              isItemEqualToValue={(item, value) => item.value === value.value}
            >
              <ComboboxInput
                className={cn(
                  "h-11 max-w-xl",
                  authenticated &&
                    "h-12 w-full max-w-[505px] rounded-lg border-0 bg-gray-800 px-0 shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-blue-700 !ring-0 [&_[data-slot=combobox-trigger-icon]]:text-slate-400 [&_[data-slot=input-group-control]]:px-5 [&_[data-slot=input-group-control]]:font-['Space_Grotesk'] [&_[data-slot=input-group-control]]:text-base [&_[data-slot=input-group-control]]:leading-6 [&_[data-slot=input-group-control]]:font-normal [&_[data-slot=input-group-control]]:text-white",
                )}
                placeholder={labels.selectPlaceholder}
                showClear={
                  !authenticated &&
                  typeof answer === "string" &&
                  Boolean(answer)
                }
              />
              <ComboboxContent
                className={cn(
                  authenticated &&
                    "max-h-80 min-w-(--anchor-width) rounded-2xl bg-gray-800 p-0 font-['Space_Grotesk'] text-white shadow-[0px_8px_32px_0px_rgba(0,0,0,0.50)] ring-1 ring-gray-800",
                )}
              >
                <ComboboxEmpty
                  className={cn(
                    authenticated &&
                      "h-12 items-center font-['Space_Grotesk'] text-base text-white/60",
                  )}
                >
                  {labels.noResults}
                </ComboboxEmpty>
                <ComboboxList
                  className={cn(
                    authenticated &&
                      "max-h-80 scroll-py-1.5 p-1.5",
                  )}
                >
                  {(option: (typeof comboboxOptions)[number]) => (
                    <ComboboxItem
                      key={option.value}
                      value={option}
                      className={cn(
                        authenticated &&
                          "h-12 rounded-lg px-5 py-3 font-['Space_Grotesk'] text-base leading-6 font-normal text-white data-highlighted:bg-slate-800 data-highlighted:text-white data-selected:bg-slate-800 [&_[data-slot=combobox-item-indicator]]:right-5 [&_[data-slot=combobox-item-indicator]]:text-white",
                      )}
                    >
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <div
              className={cn(
                "grid gap-2 sm:grid-cols-3",
                authenticated && "gap-3 lg:gap-6",
              )}
            >
              {question.options.map((option) => {
                const selected =
                  typeof answer === "string" && answer === option.stableValue;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(option.stableValue)}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-md border px-4 py-2 text-left text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      authenticated &&
                        "h-12 rounded-xl border-[1.5px] border-[#3D4149] bg-white/5 text-base font-semibold text-white hover:border-zinc-500 hover:bg-white/10",
                      authenticated &&
                        selected &&
                        "border-primary bg-primary/15 text-white",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {authenticated ? (
                        option.stableValue === "yes" ? (
                          <Check className="size-4 shrink-0 text-green-500" />
                        ) : option.stableValue === "no" ? (
                          <X className="size-4 shrink-0 text-rose-700" />
                        ) : option.stableValue === "unsure" ? (
                          <span
                            aria-hidden="true"
                            className="flex size-4 shrink-0 items-center justify-center text-base font-medium text-amber-400"
                          >
                            ?
                          </span>
                        ) : selected ? (
                          <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-zinc-500" />
                        )
                      ) : null}
                      <span className="break-words">{option.label}</span>
                    </span>
                    {!authenticated && selected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type SearchableMultiSelectProps = {
  answer: string[];
  labels: ApplicabilityQuestionnaireFormLabels;
  onChange: (value: ApplicabilityAnswerValue) => void;
  presentation?: "default" | "authenticated-stepper";
  question: ApplicabilityQuestionDto;
};

function SearchableMultiSelect({
  answer,
  labels,
  onChange,
  presentation = "default",
  question,
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredOptions = question.options.filter((option) => {
    if (!normalizedSearch) {
      return true;
    }

    const metadata = getOptionMetadata(option.metadata);
    return [option.label, metadata.sectorLabel, metadata.description]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });

  function toggle(stableValue: string, exclusive: boolean) {
    if (exclusive) {
      onChange(answer.length === 1 && answer[0] === stableValue ? [] : [stableValue]);
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
    <div className="flex flex-col gap-3">
      {answer.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {answer.map((stableValue) => {
            const option = question.options.find(
              (candidate) => candidate.stableValue === stableValue,
            );
            if (!option) {
              return null;
            }

            return (
              <button
                key={stableValue}
                type="button"
                onClick={() =>
                  toggle(stableValue, getOptionMetadata(option.metadata).exclusive)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-xs font-medium",
                  presentation === "authenticated-stepper" &&
                    "border-primary/50 text-blue-100",
                )}
              >
                {option.label}
                <X className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      ) : null}

      <Input
        className={cn(
          "max-w-xl",
          presentation === "authenticated-stepper" &&
            "h-12 max-w-2xl rounded-lg border-[1.5px] border-[#3D4049] bg-white/5",
        )}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={labels.selectPlaceholder}
      />

      <div
        className={cn(
          "max-h-96 overflow-y-auto rounded-md border",
          presentation === "authenticated-stepper" &&
            "rounded-lg border-[1.5px] border-[#3D4149] bg-[#161922]",
        )}
      >
        {filteredOptions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {labels.noResults}
          </p>
        ) : (
          <div className="divide-y">
            {filteredOptions.map((option) => {
              const metadata = getOptionMetadata(option.metadata);
              const selected = answer.includes(option.stableValue);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(option.stableValue, metadata.exclusive)}
                  className={cn(
                    "flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent",
                    selected && "bg-primary/10",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    {metadata.sectorLabel ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {metadata.sectorLabel}
                        {metadata.annex ? ` · Annex ${metadata.annex}` : ""}
                      </span>
                    ) : null}
                    {metadata.description ? (
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {metadata.description}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getOptionMetadata(value: unknown) {
  if (!isRecord(value)) {
    return {
      sectorLabel: "",
      description: "",
      annex: null as number | null,
      exclusive: false,
    };
  }

  return {
    sectorLabel:
      typeof value.sectorLabel === "string" ? value.sectorLabel : "",
    description:
      typeof value.description === "string" ? value.description : "",
    annex: typeof value.annex === "number" ? value.annex : null,
    exclusive: value.exclusive === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
