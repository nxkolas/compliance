import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";
import { connection } from "next/server";
import { Suspense } from "react";

export default function GuestAccountFinalizerPage() {
  return (
    <Suspense fallback={null}>
      <GuestAccountFinalizerContent />
    </Suspense>
  );
}

async function GuestAccountFinalizerContent() {
  await connection();
  const labels = (await getDictionary()).guestCheck;

  return (
    <GuestShell
      title={labels.finalizer.title}
      description="Schnellcheck-Finalisierung ist im org-only Schema deaktiviert."
      labels={labels.shell}
    >
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        Organisationen und Team-Einladungen sind der aktive Datenbereich.
      </div>
    </GuestShell>
  );
}
