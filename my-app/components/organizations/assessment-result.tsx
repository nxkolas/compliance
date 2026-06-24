"use client";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ResultPayload = {
  assessment: { category: string };
  organization: { name: string };
  run: {
    status: string;
    result: string;
    completedAt: string | null;
  };
};

type AssessmentResultProps = {
  apiBasePath: string;
  questionnaireHref: string;
  labels: Dictionary["guestCheck"]["result"];
};

export function AssessmentResult({
  apiBasePath,
  questionnaireHref,
  labels,
}: AssessmentResultProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<ResultPayload>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const response = await fetch(apiBasePath, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(labels.notFound);
    if (payload.assessment.run.status !== "completed") {
      router.replace(questionnaireHref);
      return;
    }
    setAssessment(payload.assessment);
  }, [apiBasePath, labels.notFound, questionnaireHref, router]);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : labels.loadFailed),
    );
  }, [labels.loadFailed, load]);

  if (!assessment) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-muted-foreground">
        {error ?? labels.loading}
      </div>
    );
  }

  const presentation = resultPresentation(assessment.run.result, labels);
  const details = resultDetails(assessment.assessment.category, labels);

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <div className="flex justify-start">
        <Button asChild size="sm" variant="outline">
          <Link href={questionnaireHref}>
            <ArrowLeft />
            {labels.backToAnswers}
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border">
        <div className={`h-2 ${presentation.barClass}`} />
        <div className="grid gap-2 p-6 pb-3">
          <p className="text-sm text-muted-foreground">
            {assessment.organization.name}
          </p>
          <h2 className="text-2xl font-semibold">{presentation.title}</h2>
        </div>
        <div className="flex flex-col gap-4 p-6 pt-3">
          <p className="text-lg">{details.summary}</p>
          <p className="leading-7 text-muted-foreground">
            {details.reasoning}
          </p>
          <div className="rounded-lg border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
            {labels.disclaimer}
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
