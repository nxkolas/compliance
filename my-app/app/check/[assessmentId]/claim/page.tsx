import { GuestClaimForm } from "@/components/guest/guest-claim-form";
import { GuestShell } from "@/components/guest/guest-shell";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestClaimPage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Laden...</main>}>
      <GuestClaimContent params={params} />
    </Suspense>
  );
}

async function GuestClaimContent({
  params,
}: PageProps) {
  const { assessmentId } = await params;
  return (
    <GuestShell
      title="Mit bestehendem Konto übernehmen"
      description="Melden Sie sich an. Der Gast-Schnellcheck wird anschließend als eigene Organisation in Ihr Konto übernommen."
    >
      <GuestClaimForm assessmentId={assessmentId} />
    </GuestShell>
  );
}
