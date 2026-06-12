import { GuestSetPasswordForm } from "@/components/guest/guest-set-password-form";
import { GuestShell } from "@/components/guest/guest-shell";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestSetPasswordPage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Laden...</main>}>
      <GuestSetPasswordContent params={params} />
    </Suspense>
  );
}

async function GuestSetPasswordContent({
  params,
}: PageProps) {
  const { assessmentId } = await params;
  return (
    <GuestShell
      title="Passwort festlegen"
      description="Nach diesem Schritt gehört der Schnellcheck dauerhaft zu Ihrem Konto."
    >
      <GuestSetPasswordForm assessmentId={assessmentId} />
    </GuestShell>
  );
}
