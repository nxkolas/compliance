import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";
import { connection } from "next/server";
import { Suspense } from "react";

export default function GuestCreateAccountPage() {
  return (
    <Suspense fallback={null}>
      <GuestCreateAccountContent />
    </Suspense>
  );
}

async function GuestCreateAccountContent() {
  await connection();
  const labels = (await getDictionary()).guestCheck;

  return (
    <GuestShell
      title={labels.finalizer.title}
      description="Schnellcheck-Kontoerstellung ist im org-only Schema deaktiviert."
      labels={labels.shell}
    >
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        Ein normales Konto kann weiterhin ueber die Registrierung erstellt
        werden.
      </div>
    </GuestShell>
  );
}
