import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";
import { connection } from "next/server";
import { Suspense } from "react";

export default function GuestResultPage() {
  return (
    <Suspense fallback={null}>
      <GuestResultContent />
    </Suspense>
  );
}

async function GuestResultContent() {
  await connection();
  const labels = (await getDictionary()).guestCheck;

  return (
    <GuestShell
      title={labels.result.title}
      description="Schnellcheck-Ergebnisse werden im org-only Schema nicht gelesen."
      labels={labels.shell}
    >
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        Ergebnisse werden spaeter als generierte, versionierte Artefakte neu
        eingefuehrt.
      </div>
    </GuestShell>
  );
}
