import { ApplicabilityWizard } from "@/components/applicability-check/applicability-wizard";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getApplicabilityQuestionnaireForGuest } from "@/src/server/applicability-check";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function GuestApplicabilityCheckPage() {
  return (
    <Suspense fallback={null}>
      <GuestApplicabilityCheckPageContent />
    </Suspense>
  );
}

async function GuestApplicabilityCheckPageContent() {
  await connection();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const labels = dictionary.modules.applicabilityCheck.guest;
  const questionnaire = await getApplicabilityQuestionnaireForGuest(locale);

  return (
    <main className="min-h-screen bg-transparent">
      <PublicLanguageSwitcher />
      <div className="mx-auto flex w-full max-w-[1274px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">
            <ArrowLeft />
            {labels.backHome}
          </Link>
        </Button>

        <PageHeader title={labels.title} subtitle={labels.description} />

        {questionnaire ? (
          <ApplicabilityWizard
            submitUrl="/api/guest/applicability-check/submissions"
            successUrl="/check/applicability/result"
            navigationMode="document"
            questionnaire={questionnaire}
            labels={dictionary.modules.applicabilityCheck.form}
          />
        ) : (
          <Alert className="p-6 text-muted-foreground shadow-sm">
            <AlertDescription className="text-muted-foreground">
              {dictionary.modules.applicabilityCheck.questionnaire.unavailable}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
