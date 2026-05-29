import { ProductModuleContent } from "@/components/product-module-content";
import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { PieChart } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <ProductModuleContent
        eyebrow="Arbeitsbereich"
        title="Dashboard"
        description="Zentrale Uebersicht ueber den aktuellen NIS2-Status. Oeffne eine Organisation, um die modulebezogenen Daten spaeter organisationbezogen zu sehen."
        icon={PieChart}
        metrics={[
          { label: "Module", value: "8" },
          { label: "Fokus", value: "NIS2-Status" },
          { label: "Daten", value: "Pro Organisation" },
        ]}
        cards={[
          {
            title: "Statusuebersicht",
            items: [
              "Betroffenheitsstatus",
              "Sicherheitsmassnahmen",
              "Analysefortschritt",
              "Kritische Bereiche",
              "Dokumentenstatus",
            ],
          },
          {
            title: "Arbeitsmodule",
            items: [
              "Betroffenheitscheck",
              "Gap-Analyse",
              "Dokumentenpruefung",
              "Massnahmenplan",
              "PDF-Export",
              "Einstellungen",
              "Hilfe & Glossar",
            ],
          },
        ]}
      />
    </AppShell>
  );
}
