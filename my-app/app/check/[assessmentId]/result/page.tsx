import { GuestResult } from "@/components/guest/guest-result";
import { GuestShell } from "@/components/guest/guest-shell";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestResultPage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Laden...</main>}>
      <GuestResultContent params={params} />
    </Suspense>
  );
}

async function GuestResultContent({
  params,
}: PageProps) {
  const { assessmentId } = await params;
  return (
    <GuestShell
      title="Ihre erste Einschätzung"
      description="Sie können das Ergebnis jetzt exportieren, löschen oder durch ein Konto dauerhaft sichern."
    >
      <GuestResult assessmentId={assessmentId} />
    </GuestShell>
  );
}
