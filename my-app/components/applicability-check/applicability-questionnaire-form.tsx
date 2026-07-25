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
import { CheckCircle2, Info, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { localizeUiError } from "@/lib/i18n/errors";

type ApplicabilityQuestionnaireFormProps = {
  submitUrl: string;
  successUrl: string;
  navigationMode?: "router" | "document";
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
  const progress =
    requiredQuestions.length === 0
      ? 100
      : Math.round(
          (completedRequiredQuestions / requiredQuestions.length) * 100,
        );
  const requiredComplete =
    completedRequiredQuestions === requiredQuestions.length;

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
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
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
              onChange={(value) =>
                setAnswers((current) =>
                  reconcileCatalogAnswers(questionnaire.questions, {
                    ...current,
                    [question.id]: value,
                  }),
                )
              }
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
    </form>
  );
}

type QuestionBlockProps = {
  answer: ApplicabilityAnswerValue;
  labels: ApplicabilityQuestionnaireFormLabels;
  onChange: (value: ApplicabilityAnswerValue) => void;
  question: ApplicabilityQuestionDto;
};

function QuestionBlock({
  answer,
  labels,
  onChange,
  question,
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

  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold">
          {question.position}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="text-base font-semibold leading-7">
                {question.questionText}
              </h3>
              {question.tooltipText ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={labels.moreInformation}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <span className="mt-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
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
                className="h-11 max-w-xl"
                placeholder={labels.selectPlaceholder}
                showClear={typeof answer === "string" && Boolean(answer)}
              />
              <ComboboxContent>
                <ComboboxEmpty>{labels.noResults}</ComboboxEmpty>
                <ComboboxList>
                  {(option: (typeof comboboxOptions)[number]) => (
                    <ComboboxItem key={option.value} value={option}>
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {question.options.map((option) => {
                const selected =
                  typeof answer === "string" && answer === option.stableValue;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(option.stableValue)}
                    className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-4 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <span className="break-words">{option.label}</span>
                    {selected ? (
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
  question: ApplicabilityQuestionDto;
};

function SearchableMultiSelect({
  answer,
  labels,
  onChange,
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
                className="inline-flex items-center gap-1.5 rounded-full border bg-primary/10 px-3 py-1 text-xs font-medium"
              >
                {option.label}
                <X className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      ) : null}

      <Input
        className="max-w-xl"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={labels.selectPlaceholder}
      />

      <div className="max-h-96 overflow-y-auto rounded-md border">
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
