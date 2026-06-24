"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n";
import { ArrowLeft, Download, LogIn, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ResultPayload = {
  assessment: { category: string };
  organization: { name: string };
  run: {
    status: string;
    result: string;
    summary: string | null;
    reasoning: string | null;
    completedAt: string | null;
  };
};

export function GuestResult({
  assessmentId,
  apiBasePath,
  questionnaireHref,
  showGuestActions = true,
  labels,
}: {
  assessmentId?: string;
  apiBasePath?: string;
  questionnaireHref?: string;
  showGuestActions?: boolean;
  labels: Dictionary["guestCheck"]["result"];
}) {
  const router = useRouter();
  const resolvedApiBasePath =
    apiBasePath ?? `/api/guest-assessments/${assessmentId}`;
  const resolvedQuestionnaireHref =
    questionnaireHref ?? `/check/${assessmentId}/questionnaire`;
  const [assessment, setAssessment] = useState<ResultPayload>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(resolvedApiBasePath, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(labels.notFound);
    if (payload.assessment.run.status !== "completed") {
      router.replace(resolvedQuestionnaireHref);
      return;
    }
    setAssessment(payload.assessment);
  }, [labels.notFound, resolvedApiBasePath, resolvedQuestionnaireHref, router]);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : labels.loadFailed),
    );
  }, [labels.loadFailed, load]);

  async function remove() {
    if (!assessmentId) return;
    if (!window.confirm(labels.confirmDelete)) return;
    setDeleting(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/guest-assessments/${assessmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(labels.deleteFailed);
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.deleteFailed);
      setDeleting(false);
    }
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        {error ?? labels.loading}
      </div>
    );
  }

  const presentation = resultPresentation(assessment.run.result, labels);
  const details = resultDetails(assessment.assessment.category, labels);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-start">
        <Button asChild size="sm" variant="outline">
          <Link href={resolvedQuestionnaireHref}>
            <ArrowLeft />
            {labels.backToAnswers}
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className={`h-2 ${presentation.barClass}`} />
        <CardHeader>
          <p className="text-sm text-white/55">{assessment.organization.name}</p>
          <CardTitle className="text-2xl">{presentation.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-lg">{details.summary}</p>
          <p className="leading-7 text-white/65">{details.reasoning}</p>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/60">
            {labels.disclaimer}
          </div>
        </CardContent>
      </Card>

      {showGuestActions && assessmentId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg">
            <Link href={`/check/${assessmentId}/create-account`}>
              <UserPlus />
              {labels.createAccount}
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/check/${assessmentId}/claim`}>
              <LogIn />
              {labels.claim}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`/api/guest-assessments/${assessmentId}/export`}>
              <Download />
              {labels.downloadPdf}
            </a>
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={remove}
            disabled={deleting}
          >
            <Trash2 />
            {deleting ? labels.deleting : labels.delete}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function resultPresentation(
  result: string,
  labels: Dictionary["guestCheck"]["result"],
) {
  if (result === "affected") {
    return {
      title: labels.presentations.affected,
      barClass: "bg-amber-400",
    };
  }
  if (result === "not_affected") {
    return {
      title: labels.presentations.notAffected,
      barClass: "bg-emerald-400",
    };
  }
  return {
    title: labels.presentations.possiblyAffected,
    barClass: "bg-blue-400",
  };
}

function resultDetails(
  category: string,
  labels: Dictionary["guestCheck"]["result"],
) {
  if (category === "important") return labels.details.important;
  if (category === "special_case") return labels.details.specialCase;
  if (category === "not_affected") return labels.details.notAffected;
  return labels.details.unknown;
}
