"use client";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  ApplicabilityOptionDto,
  ApplicabilityQuestionDto,
  ApplicabilityQuestionnaireDto,
} from "@/src/server/applicability-check/service";
import type { Locale } from "@/lib/i18n-config";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type ApplicabilityQuestionnaireFormProps = {
  organizationId: string;
  questionnaire: ApplicabilityQuestionnaireDto;
  locale: Locale;
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
  submit: string;
  submitting: string;
  submitError: string;
  allRequired: string;
};

export function ApplicabilityQuestionnaireForm({
  organizationId,
  questionnaire,
  locale,
  labels,
}: ApplicabilityQuestionnaireFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(
    questionnaire.latestAnswers,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });
  const requiredQuestions = useMemo(
    () => questionnaire.questions.filter((question) => question.required),
    [questionnaire.questions],
  );
  const completedRequiredQuestions = requiredQuestions.filter(
    (question) => answers[question.id],
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
      const response = await fetch(
        `/api/organizations/${organizationId}/applicability-check/submissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: questionnaire.questions
              .filter((question) => answers[question.id])
              .map((question) => ({
                questionId: question.id,
                value: answers[question.id],
              })),
          }),
        },
      );
      const body = (await response.json()) as {
        result?: unknown;
        error?: string;
      };

      if (!response.ok || !body.result) {
        throw new Error(body.error ?? labels.submitError);
      }

      router.push(
        `/tool/organizations/${organizationId}/applicability-check/result`,
      );
      router.refresh();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : labels.submitError,
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
              "border-red-200 bg-red-50 text-red-900",
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

      <div className="flex flex-col gap-4">
        {questionnaire.questions.map((question) => (
          <QuestionBlock
            key={question.id}
            answer={answers[question.id] ?? ""}
            labels={labels}
            locale={locale}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [question.id]: value }))
            }
            question={question}
          />
        ))}
      </div>

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
  answer: string;
  labels: ApplicabilityQuestionnaireFormLabels;
  locale: Locale;
  onChange: (value: string) => void;
  question: ApplicabilityQuestionDto;
};

function QuestionBlock({
  answer,
  labels,
  locale,
  onChange,
  question,
}: QuestionBlockProps) {
  const questionText =
    getTranslatedValue(question.config, locale, "questionText") ??
    question.questionText;
  const helpText =
    getTranslatedValue(question.config, locale, "helpText") ??
    question.helpText;
  const control = getControl(question.config);
  const renderAsSelect = control === "select" || question.options.length > 6;
  const comboboxOptions = question.options.map((option) => ({
    value: option.stableValue,
    label: getOptionLabel(option, locale),
  }));
  const selectedComboboxOption =
    comboboxOptions.find((option) => option.value === answer) ?? null;

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
                {questionText}
              </h3>
              {question.required ? (
                <span className="mt-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                  {labels.required}
                </span>
              ) : null}
            </div>
            {helpText ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {helpText}
              </p>
            ) : null}
          </div>

          {renderAsSelect ? (
            <Combobox
              items={comboboxOptions}
              value={selectedComboboxOption}
              onValueChange={(option) => onChange(option?.value ?? "")}
              isItemEqualToValue={(item, value) => item.value === value.value}
            >
              <ComboboxInput
                className="h-11 max-w-xl"
                placeholder={labels.selectPlaceholder}
                showClear={Boolean(answer)}
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
                const selected = answer === option.stableValue;

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
                    <span className="break-words">
                      {getOptionLabel(option, locale)}
                    </span>
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

function getOptionLabel(option: ApplicabilityOptionDto, locale: Locale) {
  return getTranslatedValue(option.metadata, locale, "label") ?? option.label;
}

function getControl(config: unknown) {
  if (!isRecord(config) || !isRecord(config.ui)) {
    return undefined;
  }

  return typeof config.ui.control === "string"
    ? config.ui.control
    : undefined;
}

function getTranslatedValue(
  source: unknown,
  locale: Locale,
  key: string,
): string | undefined {
  if (locale === "de" || !isRecord(source) || !isRecord(source.translations)) {
    return undefined;
  }

  const localeTranslations = source.translations[locale];

  if (!isRecord(localeTranslations)) {
    return undefined;
  }

  const value = localeTranslations[key];

  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
