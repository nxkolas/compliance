"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Download, LogIn, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ResultPayload = {
  organization: { name: string };
  run: {
    status: string;
    result: string;
    summary: string | null;
    reasoning: string | null;
    completedAt: string | null;
  };
};

export function GuestResult({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<ResultPayload>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/guest-assessments/${assessmentId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Ergebnis nicht gefunden");
    if (payload.assessment.run.status !== "completed") {
      router.replace(`/check/${assessmentId}/questionnaire`);
      return;
    }
    setAssessment(payload.assessment);
  }, [assessmentId, router]);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Laden fehlgeschlagen"),
    );
  }, [load]);

  async function remove() {
    if (!window.confirm("Möchten Sie dieses Ergebnis endgültig löschen?")) return;
    setDeleting(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/guest-assessments/${assessmentId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Löschen fehlgeschlagen");
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  if (!assessment) {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        {error ?? "Ergebnis wird geladen..."}
      </div>
    );
  }

  const presentation = resultPresentation(assessment.run.result);

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div className={`h-2 ${presentation.barClass}`} />
        <CardHeader>
          <p className="text-sm text-white/55">{assessment.organization.name}</p>
          <CardTitle className="text-2xl">{presentation.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-lg">{assessment.run.summary}</p>
          <p className="leading-7 text-white/65">{assessment.run.reasoning}</p>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/60">
            Diese Einschätzung ist eine unverbindliche Erstorientierung und
            keine Rechtsberatung. Für eine abschließende Bewertung müssen Ihre
            konkreten Tätigkeiten und Unternehmensdaten geprüft werden.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link href={`/check/${assessmentId}/create-account`}>
            <UserPlus />
            Konto erstellen und Ergebnis sichern
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href={`/check/${assessmentId}/claim`}>
            <LogIn />
            Mit bestehendem Konto übernehmen
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={`/api/guest-assessments/${assessmentId}/export`}>
            <Download />
            PDF herunterladen
          </a>
        </Button>
        <Button
          size="lg"
          variant="destructive"
          onClick={remove}
          disabled={deleting}
        >
          <Trash2 />
          {deleting ? "Wird gelöscht..." : "Ergebnis löschen"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function resultPresentation(result: string) {
  if (result === "affected") {
    return {
      title: "Voraussichtlich betroffen",
      barClass: "bg-amber-400",
    };
  }
  if (result === "not_affected") {
    return {
      title: "Aktuell nicht erkennbar betroffen",
      barClass: "bg-emerald-400",
    };
  }
  return {
    title: "Individuelle Prüfung erforderlich",
    barClass: "bg-blue-400",
  };
}
