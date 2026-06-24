import { GuestResult } from "@/components/guest/guest-result";
import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function GuestResultPage({
  params,
}: PageProps) {
  const dictionary = await getDictionary();
  const labels = dictionary.guestCheck;
  const { assessmentId } = await params;
  return (
    <GuestShell
      title={labels.result.title}
      description={labels.result.description}
      labels={labels.shell}
    >
      <GuestResult assessmentId={assessmentId} labels={labels.result} />
    </GuestShell>
  );
}
