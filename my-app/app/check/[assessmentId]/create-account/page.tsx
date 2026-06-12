import { GuestCreateAccountForm } from "@/components/guest/guest-create-account-form";
import { GuestShell } from "@/components/guest/guest-shell";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestCreateAccountPage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Laden...</main>}>
      <GuestCreateAccountContent params={params} />
    </Suspense>
  );
}

async function GuestCreateAccountContent({
  params,
}: PageProps) {
  const { assessmentId } = await params;
  return (
    <GuestShell
      title="Ergebnis dauerhaft sichern"
      description="Bestätigen Sie Ihre E-Mail-Adresse und legen Sie anschließend ein Passwort fest. Ihr Schnellcheck bleibt dabei unverändert erhalten."
    >
      <GuestCreateAccountForm assessmentId={assessmentId} />
    </GuestShell>
  );
}
