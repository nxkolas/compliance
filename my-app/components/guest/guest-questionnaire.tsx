"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  assessmentId: string;
}) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<GuestAssessmentPayload>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string>();
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    const response = await fetch(`/api/guest-assessments/${assessmentId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Schnellcheck nicht gefunden");
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
  }, [assessmentId]);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Laden fehlgeschlagen"),
    );
  }, [load]);

  const questions = useMemo(
    () =>
      assessment?.template.sections.flatMap((section) => section.questions) ??
      [],
    [assessment],
  );
  const requiredComplete = questions
    .filter((question) => question.isRequired)
    .every((question) => values[question.id] !== undefined && values[question.id] !== "");

  async function save(questionId: string, value: unknown) {
    setValues((current) => ({ ...current, [questionId]: value }));
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/guest-assessments/${assessmentId}/answers`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [{ questionId, value }] }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Speichern fehlgeschlagen");
      setAssessment(payload.assessment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
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
        const notesQuestion = questions.find((question) => question.code === "notes");
        if (notesQuestion && typeof values[notesQuestion.id] === "string") {
          await save(notesQuestion.id, values[notesQuestion.id]);
        }
      }
      const response = await fetch(
        `/api/guest-assessments/${assessmentId}/complete`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Auswertung fehlgeschlagen");
      router.push(`/check/${assessmentId}/result`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auswertung fehlgeschlagen");
      setCompleting(false);
    }
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        {error ?? "Fragebogen wird geladen..."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>{assessment.organization.name}</span>
          <span className="text-white/60">
            {saving ? "Wird gespeichert..." : `${assessment.run.progress}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${assessment.run.progress}%` }}
          />
        </div>
      </div>

      {assessment.template.sections.map((section) => (
        <section
          key={section.id}
          className="rounded-2xl border border-white/15 bg-[#111522]/95 p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.description ? (
            <p className="mt-2 text-sm text-white/60">{section.description}</p>
          ) : null}
          <div className="mt-7 flex flex-col gap-8">
            {section.questions.map((question, index) => (
              <div key={question.id} className="flex flex-col gap-3">
                <div>
                  <p className="font-medium">
                    {index + 1}. {question.prompt}
                    {question.isRequired ? (
                      <span className="ml-1 text-primary">*</span>
                    ) : null}
                  </p>
                  {question.helpText ? (
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {question.helpText}
                    </p>
                  ) : null}
                </div>
                {question.questionType === "text" ? (
                  <Input
                    value={String(values[question.id] ?? "")}
                    onChange={(event) =>
                      saveNotes(question.id, event.target.value)
                    }
                    placeholder="Optionale Anmerkungen"
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
                          {String(option.label ?? value)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button
        size="lg"
        onClick={complete}
        disabled={!requiredComplete || saving || completing}
      >
        {completing ? "Ergebnis wird berechnet..." : "Ergebnis anzeigen"}
      </Button>
      <p className="text-center text-xs leading-5 text-white/50">
        Der Schnellcheck ist eine unverbindliche Erstorientierung und ersetzt
        keine rechtliche Beratung.
      </p>
    </div>
  );
}
