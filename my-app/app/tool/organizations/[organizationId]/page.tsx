import { ProductModuleContent } from "@/components/product-module-content";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type OrganizationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  return (
    <Suspense fallback={<OrganizationPageFallback />}>
      <OrganizationPageContent params={params} />
    </Suspense>
  );
}

async function OrganizationPageContent({ params }: OrganizationPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <ProductModuleContent
      title="NIS2 COMPLIANCE DASHBOARD"
      description="Übersicht über Ihren aktuellen NIS2-Compliance-Status, dringende nächste Schritte sowie den Fortschritt Ihrer laufenden Analysen auf einen Blick."
      metrics={[
        { label: "Betroffenheitsstatus", value: "Offen" },
        { label: "Analysefortschritt", value: "0%" },
        { label: "Naechste Schritte", value: "Noch nicht erstellt" },
      ]}
      cards={[
        {
          title: "Statusbereiche",
          description: "Die wichtigsten Informationen fuer den ersten Blick.",
          items: [
            "Betroffenheitsstatus",
            "Sicherheitsmassnahmen",
            "Analysefortschritt",
            "Kritische Bereiche",
            "Dokumentenstatus",
          ],
        },
        {
          title: "Naechste Schritte",
          description: "Aufgaben werden spaeter aus Analyse und Dokumentenpruefung abgeleitet.",
          items: [
            "Betroffenheitscheck starten",
            "Gap-Analyse ausfuellen",
            "Dokumente fuer KI-Pruefung hochladen",
            "Massnahmen priorisieren",
          ],
        },
        {
          title: "Kritische Bereiche",
          description: "Bereiche mit hohem Handlungsbedarf werden hier hervorgehoben.",
          items: [
            "Zugriffskontrolle",
            "Backup & Recovery",
            "Incident Response",
            "Lieferkettensicherheit",
          ],
        },
        {
          title: "Berichtsstatus",
          description: "PDF-Berichte werden spaeter aus dem aktuellen Arbeitsstand erzeugt.",
          items: [
            "Management-Zusammenfassung",
            "Kritische Bereiche",
            "Massnahmenliste",
            "Dokumentenpruefung",
          ],
        },
      ]}
    />
  );
}

function OrganizationPageFallback() {
  return (
    <ProductModuleContent
      title="NIS2 COMPLIANCE DASHBOARD"
      description="Übersicht über Ihren aktuellen NIS2-Compliance-Status, dringende nächste Schritte sowie den Fortschritt Ihrer laufenden Analysen auf einen Blick."
      cards={[]}
    />
  );
}
