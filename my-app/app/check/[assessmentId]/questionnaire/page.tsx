import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";
import { connection } from "next/server";
import { Suspense } from "react";

export default function GuestQuestionnairePage() {
  return (
    <Suspense fallback={null}>
      <GuestQuestionnaireContent />
    </Suspense>
  );
}

async function GuestQuestionnaireContent() {
  await connection();
  const labels = (await getDictionary()).guestCheck;

  return (
    <GuestShell
      title={labels.questionnaire.title}
      description="Der Schnellcheck-Fragebogen ist im org-only Schema nicht an eine API angebunden."
      labels={labels.shell}
    >
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        Die Fragebogen-Komponente bleibt im Code erhalten und wird spaeter an
        Assessment-Revisions angeschlossen.
      </div>
    </GuestShell>
  );
}
