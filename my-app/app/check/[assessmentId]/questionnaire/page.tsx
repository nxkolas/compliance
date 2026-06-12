import { GuestQuestionnaire } from "@/components/guest/guest-questionnaire";
import { GuestShell } from "@/components/guest/guest-shell";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestQuestionnairePage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Laden...</main>}>
      <GuestQuestionnaireContent params={params} />
    </Suspense>
  );
}

async function GuestQuestionnaireContent({
  params,
}: PageProps) {
  const { assessmentId } = await params;
  return (
    <GuestShell
      title="Ihre Unternehmensangaben"
      description="Ihre Antworten werden automatisch gespeichert. Sie können den Schnellcheck in diesem Browser später fortsetzen."
    >
      <GuestQuestionnaire assessmentId={assessmentId} />
    </GuestShell>
  );
}
