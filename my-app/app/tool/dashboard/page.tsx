import { SimpleAppPage } from "@/components/simple-app-page";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const dictionary = await getDictionary();

  return (
    <SimpleAppPage title={dictionary.modules.dashboardTitle}>
      <p>{dictionary.modules.dashboardDescription}</p>
    </SimpleAppPage>
  );
}
