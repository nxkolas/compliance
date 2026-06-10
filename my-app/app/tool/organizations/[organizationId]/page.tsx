import { ProductModuleContent } from "@/components/product-module-content";
import { getDefaultDictionary, getDictionary } from "@/lib/i18n";
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
  const dictionary = await getDictionary();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <ProductModuleContent
      title={dictionary.modules.dashboard.title}
      description={dictionary.modules.dashboard.description}
      metrics={dictionary.modules.dashboard.metrics}
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
  const dictionary = getDefaultDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.dashboard.title}
      description={dictionary.modules.dashboard.description}
      cards={[]}
    />
  );
}
