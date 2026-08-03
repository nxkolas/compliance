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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Toggle } from "@/components/ui/toggle";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<
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
  const completedQuestions = visibleQuestions.filter(
    (question) =>
      confirmedQuestionIds.has(question.id) &&
      isAnswered(answers[question.id]),
  ).length;
  const progress =
    requiredQuestions.length === 0
      ? 100
      : Math.round(
          (completedRequiredQuestions / requiredQuestions.length) * 100,
        );
  const questionnaireProgress =
    visibleQuestions.length === 0
      ? 100
      : Math.round((completedQuestions / visibleQuestions.length) * 100);
  const requiredComplete =
    completedRequiredQuestions === requiredQuestions.length;
  const activeQuestionIndex = Math.min(
    currentQuestionIndex,
    Math.max(visibleQuestions.length - 1, 0),
  );

  function confirmQuestion(questionId: string) {
    setConfirmedQuestionIds((current) => {
      if (current.has(questionId)) {
        return current;
      }

      const next = new Set(current);
      next.add(questionId);
      return next;
    });
  }

  function clearConfirmationsFrom(question: ApplicabilityQuestionDto) {
    const affectedQuestionIds = new Set(
      questionnaire.questions
        .filter((candidate) => candidate.position >= question.position)
        .map((candidate) => candidate.id),
    );

    setConfirmedQuestionIds((current) => {
      const next = new Set(
        [...current].filter((questionId) => !affectedQuestionIds.has(questionId)),
      );
      return next.size === current.size ? current : next;
    });
  }

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
    clearConfirmationsFrom(question);
    setNotice({ message: null, tone: "default" });
  }

  function navigateToQuestion(index: number) {
    setCurrentQuestionIndex(index);
  }

  function confirmCurrentQuestionAndNavigate(index: number) {
    const activeQuestion = visibleQuestions[activeQuestionIndex];

    if (activeQuestion && isAnswered(answers[activeQuestion.id])) {
      confirmQuestion(activeQuestion.id);
    }

    setCurrentQuestionIndex(index);
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
        "flex w-full min-w-0 flex-col gap-6",
        presentation === "authenticated-stepper" &&
          "font-['Space_Grotesk'] lg:gap-8",
      )}
      onSubmit={handleSubmit}
    >
      {notice.message ? (
        <Alert
          variant={notice.tone === "error" ? "destructive" : "default"}
          className={cn(
            "break-words rounded-md border px-4 py-3 text-sm",
          )}
        >
          <AlertDescription className="min-w-0 break-words text-current">
            {notice.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {presentation === "authenticated-stepper" ? (
        <AuthenticatedQuestionnaire
          activeQuestionIndex={activeQuestionIndex}
          answers={answers}
          completedQuestions={completedQuestions}
          confirmedQuestionIds={confirmedQuestionIds}
          isSubmitting={isSubmitting}
          labels={labels}
          onAnswerChange={updateAnswer}
          onContinue={confirmCurrentQuestionAndNavigate}
          onQuestionSelect={navigateToQuestion}
          progress={questionnaireProgress}
          requiredComplete={requiredComplete}
          questionCount={visibleQuestions.length}
          visibleQuestions={visibleQuestions}
        />
      ) : (
        <>
          <Card className="gap-0 rounded-lg py-0 shadow-sm">
            <CardContent className="p-5">
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
            </CardContent>
          </Card>

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
  answers: Record<string, ApplicabilityAnswerValue>;
  completedQuestions: number;
  confirmedQuestionIds: Set<string>;
  isSubmitting: boolean;
  labels: ApplicabilityQuestionnaireFormLabels;
  onAnswerChange: (
    question: ApplicabilityQuestionDto,
    value: ApplicabilityAnswerValue,
  ) => void;
  onContinue: (index: number) => void;
  onQuestionSelect: (index: number) => void;
  progress: number;
  questionCount: number;
  requiredComplete: boolean;
  visibleQuestions: ApplicabilityQuestionDto[];
};

function AuthenticatedQuestionnaire({
  activeQuestionIndex,
  answers,
  completedQuestions,
  confirmedQuestionIds,
  isSubmitting,
  labels,
  onAnswerChange,
  onContinue,
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
          confirmedQuestionIds={confirmedQuestionIds}
          labels={labels}
          onQuestionSelect={onQuestionSelect}
          questions={visibleQuestions}
        />

        <div className="grid gap-x-1 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <Progress
              aria-label={labels.progress}
              value={progress}
              className="h-3.5 rounded-[9999px] bg-foreground/30"
            />
          </div>
          <span className="min-w-12 text-right text-base font-semibold text-foreground">
            {progress} %
          </span>
          <span className="flex min-h-14 w-full max-w-56 items-center justify-self-end text-left font-['Space_Grotesk'] text-base leading-6 font-normal text-foreground sm:col-span-2">
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
            className="h-12 w-full overflow-hidden rounded-lg bg-primary/50 px-0 hover:bg-primary/60 sm:w-28"
          >
            <ArrowLeft className="text-primary-foreground/50" />
            <span className="font-['Space_Grotesk'] text-base font-medium text-primary-foreground/50">
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
            onClick={() => onContinue(activeQuestionIndex + 1)}
            className="h-12 w-full overflow-hidden rounded-lg bg-primary px-8 hover:bg-primary/90 sm:w-48"
          >
            <span className="font-['Space_Grotesk'] text-base font-medium text-primary-foreground">
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
  confirmedQuestionIds: Set<string>;
  labels: ApplicabilityQuestionnaireFormLabels;
  onQuestionSelect: (index: number) => void;
  questions: ApplicabilityQuestionDto[];
};

function QuestionStepper({
  activeQuestionId,
  answers,
  confirmedQuestionIds,
  labels,
  onQuestionSelect,
  questions,
}: QuestionStepperProps) {
  return (
    <nav
      aria-label={labels.progress}
      className="overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none] sm:pr-[52px] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex w-max min-w-full items-center justify-between gap-3">
        {questions.map((question, index) => {
          const active = question.id === activeQuestionId;
          const answered =
            confirmedQuestionIds.has(question.id) &&
            isAnswered(answers[question.id]);
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-current={active ? "step" : undefined}
                aria-label={`${index + 1}: ${statusLabel}`}
                onClick={() => onQuestionSelect(index)}
                className="group h-auto w-full items-center justify-center rounded-md py-1 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-100"
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
              </Button>
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
  const comboboxAnchor = useComboboxAnchor();

  return (
    <Card
      role="article"
      className={cn(
        "min-w-0 gap-0 rounded-lg py-0 shadow-sm",
        authenticated &&
          "rounded-xl border-[1.5px] border-border-strong bg-card",
      )}
    >
      <CardContent
        className={cn(
          "p-5",
          authenticated && "px-5 py-6 sm:px-8",
        )}
      >
        <div className={cn("flex gap-4", authenticated && "gap-4 sm:gap-6")}>
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border bg-background text-center text-sm leading-none font-semibold tabular-nums",
            authenticated &&
              "rounded-full border-[1.5px] border-transparent bg-primary text-base text-white dark:border-border-strong dark:bg-surface dark:text-foreground",
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
                "flex min-w-0 flex-wrap items-start gap-2",
                authenticated && "flex-nowrap",
              )}
            >
              <h3
                className={cn(
                  "min-w-0 break-words text-base font-semibold leading-7",
                  authenticated && "max-w-4xl text-foreground",
                )}
              >
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
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        authenticated &&
                          "size-6 rounded-full text-foreground-subtle hover:bg-foreground/5 hover:text-foreground",
                      )}
                    >
                      <Info aria-hidden="true" className="h-4 w-4" />
                    </Button>
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
              <div
                ref={comboboxAnchor}
                className={cn(
                  authenticated
                    ? "w-full min-w-0 max-w-[505px]"
                    : "contents",
                )}
              >
                <ComboboxInput
                  className={cn(
                    "h-11 max-w-xl",
                    authenticated &&
                      "h-12 w-full max-w-none rounded-lg border border-primary bg-surface px-0 shadow-control outline-none !ring-0 focus-within:!border-primary [&_[data-slot=combobox-trigger-icon]]:text-foreground-subtle [&_[data-slot=input-group-addon]]:pr-5 [&_[data-slot=input-group-control]]:px-5 [&_[data-slot=input-group-control]]:font-['Space_Grotesk'] [&_[data-slot=input-group-control]]:text-base [&_[data-slot=input-group-control]]:leading-6 [&_[data-slot=input-group-control]]:font-normal [&_[data-slot=input-group-control]]:text-foreground [&_[data-slot=input-group-control]::placeholder]:text-foreground-subtle",
                  )}
                  placeholder={labels.selectPlaceholder}
                  showClear={typeof answer === "string" && Boolean(answer)}
                />
              </div>
              <ComboboxContent
                anchor={authenticated ? comboboxAnchor : undefined}
                className={cn(
                  authenticated &&
                    "max-h-80 !w-(--anchor-width) !min-w-(--anchor-width) !max-w-(--anchor-width) overflow-hidden rounded-2xl !bg-surface p-0 font-['Space_Grotesk'] text-foreground shadow-popover ring-1 ring-surface",
                )}
              >
                <ComboboxEmpty
                  className={cn(
                    authenticated &&
                      "h-12 items-center font-['Space_Grotesk'] text-base text-foreground/60",
                  )}
                >
                  {labels.noResults}
                </ComboboxEmpty>
                <ComboboxList
                  className={cn(
                    authenticated &&
                      "flex max-h-80 flex-col scroll-py-1.5 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  )}
                >
                  {(option: (typeof comboboxOptions)[number]) => (
                    <ComboboxItem
                      key={option.value}
                      value={option}
                      className={cn(
                        authenticated &&
                          "h-12 shrink-0 rounded-lg px-5 py-3 font-['Space_Grotesk'] text-base leading-6 font-normal text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:bg-accent data-selected:text-accent-foreground [&_[data-slot=combobox-item-indicator]]:right-5 [&_[data-slot=combobox-item-indicator]]:text-foreground",
                      )}
                    >
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={1}
              value={typeof answer === "string" ? answer : ""}
              onValueChange={(value) => {
                if (value) {
                  onChange(value);
                }
              }}
              className={cn(
                "grid w-full items-stretch gap-2 rounded-none md:grid-cols-3",
                authenticated && "gap-3 lg:gap-6",
              )}
            >
              {question.options.map((option) => {
                const selected =
                  typeof answer === "string" && answer === option.stableValue;

                return (
                  <ToggleGroupItem
                    key={option.id}
                    value={option.stableValue}
                    className={cn(
                      "flex h-auto min-h-11 w-full shrink items-center justify-between gap-3 whitespace-normal rounded-md border px-4 py-2 text-left text-sm shadow-none transition-colors data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground",
                      selected
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      authenticated &&
                        "min-h-12 rounded-xl border-[1.5px] border-border-strong bg-foreground/5 py-3 text-base font-semibold text-foreground hover:border-foreground-subtle hover:bg-foreground/10 data-[state=on]:text-foreground",
                      authenticated &&
                        selected &&
                        "border-primary bg-primary/15 text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      {authenticated ? (
                        option.stableValue === "yes" ? (
                          <Check className="size-4 shrink-0 text-success" />
                        ) : option.stableValue === "no" ? (
                          <X className="size-4 shrink-0 text-destructive" />
                        ) : option.stableValue === "unsure" ? (
                          <span
                            aria-hidden="true"
                            className="flex size-4 shrink-0 items-center justify-center text-base font-medium text-warning"
                          >
                            ?
                          </span>
                        ) : selected ? (
                          <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-foreground-subtle" />
                        )
                      ) : null}
                      <span className="break-words">{option.label}</span>
                    </span>
                    {!authenticated && selected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}
        </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="flex min-w-0 flex-col gap-3">
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
              <Button
                key={stableValue}
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  toggle(stableValue, getOptionMetadata(option.metadata).exclusive)
                }
                className={cn(
                  "h-auto max-w-full whitespace-normal rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-medium text-foreground shadow-none hover:bg-primary/10 hover:text-foreground dark:border-border dark:bg-primary/10 dark:hover:bg-primary/10",
                  presentation === "authenticated-stepper" &&
                    "border-primary/50 text-info-foreground hover:text-info-foreground dark:border-primary/50",
                )}
              >
                <span className="min-w-0 break-words text-left">
                  {option.label}
                </span>
                <X className="h-3 w-3" />
              </Button>
            );
          })}
        </div>
      ) : null}

      <Input
        className={cn(
          "max-w-xl",
          presentation === "authenticated-stepper" &&
            "h-12 max-w-2xl rounded-lg border-[1.5px] border-border-strong bg-foreground/5",
        )}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={labels.selectPlaceholder}
      />

      <div
        className={cn(
          "max-h-96 overflow-y-auto rounded-md border",
          presentation === "authenticated-stepper" &&
            "rounded-lg border-[1.5px] border-border-strong bg-surface-subtle",
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
                <Toggle
                  key={option.id}
                  pressed={selected}
                  onPressedChange={() =>
                    toggle(option.stableValue, metadata.exclusive)
                  }
                  className={cn(
                    "flex h-auto min-h-0 w-full items-start justify-between gap-4 whitespace-normal rounded-none px-4 py-3 text-left font-normal transition-colors hover:bg-accent data-[state=on]:bg-primary/10 data-[state=on]:text-foreground",
                    selected && "bg-primary/10",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">
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
                </Toggle>
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
