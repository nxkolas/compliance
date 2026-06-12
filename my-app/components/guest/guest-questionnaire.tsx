"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { Dictionary } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: string;
  code: string;
  prompt: string;
  helpText: string | null;
  questionType: string;
  isRequired: boolean;
  options: Array<{ value?: unknown; label?: unknown }> | null;
};

type GuestAssessmentPayload = {
  organization: { name: string };
  run: { progress: number; status: string };
  template: {
    title: string;
    sections: Array<{
      id: string;
      title: string;
      description: string | null;
      questions: Question[];
    }>;
  };
  answers: Array<{
    questionId: string;
    value: { value?: unknown } | null;
  }>;
};

export function GuestQuestionnaire({
  assessmentId,
  labels,
}: {
  assessmentId: string;
  labels: Dictionary["guestCheck"]["questionnaire"];
}) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<GuestAssessmentPayload>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [pendingSaves, setPendingSaves] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string>();
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    const response = await fetch(`/api/guest-assessments/${assessmentId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(labels.notFound);
    setAssessment(payload.assessment);
    setValues(
      Object.fromEntries(
        payload.assessment.answers.map(
          (answer: GuestAssessmentPayload["answers"][number]) => [
            answer.questionId,
            answer.value?.value ?? "",
          ],
        ),
      ),
    );
  }, [assessmentId, labels.notFound]);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : labels.loadFailed),
    );
  }, [labels.loadFailed, load]);

  const questions = useMemo(
    () =>
      assessment?.template.sections.flatMap((section) => section.questions) ??
      [],
    [assessment],
  );
  const requiredQuestions = questions.filter(
    (question) => question.isRequired,
  );
  const completedRequiredQuestions = requiredQuestions.filter(
    (question) =>
      values[question.id] !== undefined && values[question.id] !== "",
  ).length;
  const progress =
    requiredQuestions.length === 0
      ? 100
      : Math.round(
          (completedRequiredQuestions / requiredQuestions.length) * 100,
        );
  const requiredComplete =
    completedRequiredQuestions === requiredQuestions.length;

  function save(questionId: string, value: unknown) {
    setValues((current) => ({ ...current, [questionId]: value }));
    setPendingSaves((current) => current + 1);
    setError(undefined);

    const queuedSave = saveQueue.current
      .then(async () => {
        const response = await fetch(
          `/api/guest-assessments/${assessmentId}/answers`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: [{ questionId, value }] }),
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(labels.saveFailed);
        }
        setAssessment(payload.assessment);
        return true;
      })
      .catch((caught) => {
        setError(
          caught instanceof Error ? caught.message : labels.saveFailed,
        );
        return false;
      })
      .finally(() => {
        setPendingSaves((current) => current - 1);
      });

    saveQueue.current = queuedSave.then(() => undefined);
    return queuedSave;
  }

  function saveNotes(questionId: string, value: string) {
    setValues((current) => ({ ...current, [questionId]: value }));
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => void save(questionId, value), 500);
  }

  async function complete() {
    setCompleting(true);
    setError(undefined);
    try {
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
        noteTimer.current = undefined;
        const notesQuestion = questions.find((question) => question.code === "notes");
        if (notesQuestion && typeof values[notesQuestion.id] === "string") {
          const saved = await save(notesQuestion.id, values[notesQuestion.id]);
          if (!saved) {
            throw new Error(labels.saveFailed);
          }
        }
      }
      await saveQueue.current;
      const response = await fetch(
        `/api/guest-assessments/${assessmentId}/complete`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(labels.evaluationFailed);
      router.push(`/check/${assessmentId}/result`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : labels.evaluationFailed,
      );
      setCompleting(false);
    }
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        {error ?? labels.loading}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>{assessment.organization.name}</span>
          <span className="text-white/60">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-white/10" />
      </div>

      {assessment.template.sections.map((section) => (
        <section
          key={section.id}
          className="rounded-2xl border border-white/15 bg-[#111522]/95 p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold">{labels.sectionTitle}</h2>
          <p className="mt-2 text-sm text-white/60">
            {labels.sectionDescription}
          </p>
          <div className="mt-7 flex flex-col gap-8">
            {section.questions.map((question, index) => {
              const questionLabels = getQuestionLabels(labels, question.code);
              const helpText =
                questionLabels?.helpText ?? question.helpText;

              return (
                <div key={question.id} className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">
                      {index + 1}. {questionLabels?.prompt ?? question.prompt}
                      {question.isRequired ? (
                        <span className="ml-1 text-primary">*</span>
                      ) : null}
                    </p>
                    {helpText ? (
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        {helpText}
                      </p>
                    ) : null}
                  </div>
                  {question.questionType === "text" ? (
                    <Input
                      value={String(values[question.id] ?? "")}
                      onChange={(event) =>
                        saveNotes(question.id, event.target.value)
                      }
                      placeholder={labels.notesPlaceholder}
                      className="h-11"
                    />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(question.options ?? []).map((option) => {
                        const value = String(option.value ?? "");
                        const selected = values[question.id] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => void save(question.id, value)}
                            className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                              selected
                                ? "border-primary bg-primary/15 text-white"
                                : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                            }`}
                          >
                            {questionLabels?.options[value] ??
                              String(option.label ?? value)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button
        size="lg"
        onClick={complete}
        disabled={!requiredComplete || pendingSaves > 0 || completing}
      >
        {completing ? labels.calculating : labels.showResult}
      </Button>
      <p className="text-center text-xs leading-5 text-white/50">
        {labels.disclaimer}
      </p>
    </div>
  );
}

function getQuestionLabels(
  labels: Dictionary["guestCheck"]["questionnaire"],
  code: string,
) {
  const questions = labels.questions as Record<
    string,
    { prompt: string; helpText: string; options: Record<string, string> }
  >;
  return questions[code];
}
