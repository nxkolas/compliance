import { GuestQuestionnaire } from "@/components/guest/guest-questionnaire";
import { GuestShell } from "@/components/guest/guest-shell";
import { getDefaultDictionary, getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestQuestionnairePage({ params }: PageProps) {
  const fallback = getDefaultDictionary();
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8">
          {fallback.guestCheck.questionnaire.loading}
        </main>
      }
    >
      <GuestQuestionnaireContent params={params} />
    </Suspense>
  );
}

async function GuestQuestionnaireContent({
  params,
}: PageProps) {
  const dictionary = await getDictionary();
  const labels = dictionary.guestCheck;
  const { assessmentId } = await params;
  return (
    <GuestShell
      title={labels.questionnaire.title}
      description={labels.questionnaire.description}
      labels={labels.shell}
    >
      <GuestQuestionnaire
        assessmentId={assessmentId}
        labels={labels.questionnaire}
      />
    </GuestShell>
  );
}
