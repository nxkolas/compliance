import { GuestShell } from "@/components/guest/guest-shell";
import { getDictionary } from "@/lib/i18n";
import { connection } from "next/server";
import { Suspense } from "react";

export default function GuestCheckPage() {
  return (
    <Suspense fallback={null}>
      <GuestCheckContent />
    </Suspense>
  );
}

async function GuestCheckContent() {
  await connection();
  const labels = (await getDictionary()).guestCheck;

  return (
    <GuestShell
      title={labels.start.title}
      description="Der oeffentliche Schnellcheck ist im org-only Schema voruebergehend deaktiviert."
      labels={labels.shell}
    >
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8 text-white/70">
        Organisationen, Mitgliedschaften und Einladungen sind aktiv. Der
        Fragebogen wird mit dem neuen versionierten Schema wieder verbunden.
      </div>
    </GuestShell>
  );
}
