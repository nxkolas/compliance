import { GuestQuestionnaire } from "@/components/guest/guest-questionnaire";
import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function GuestQuestionnairePage({
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
