import { GuestResult } from "@/components/guest/guest-result";
import { GuestShell } from "@/components/guest/guest-shell";
import { getDefaultDictionary, getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestResultPage({ params }: PageProps) {
  const fallback = getDefaultDictionary();
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8">
          {fallback.guestCheck.result.loading}
        </main>
      }
    >
      <GuestResultContent params={params} />
    </Suspense>
  );
}

async function GuestResultContent({
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
