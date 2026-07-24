import { ApplicabilityQuestionnaireForm } from "@/components/applicability-check/applicability-questionnaire-form";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getApplicabilityQuestionnaireForGuest } from "@/src/server/applicability-check/service";
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
    <main className="min-h-screen bg-background">
      <PublicLanguageSwitcher />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">
            <ArrowLeft />
            {labels.backHome}
          </Link>
        </Button>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {labels.title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            {labels.description}
          </p>
        </header>

        {questionnaire ? (
          <ApplicabilityQuestionnaireForm
            submitUrl="/api/guest/applicability-check/submissions"
            successUrl="/check/applicability/result"
            navigationMode="document"
            questionnaire={questionnaire}
            labels={dictionary.modules.applicabilityCheck.form}
          />
        ) : (
          <div className="rounded-lg border bg-card p-6 text-muted-foreground shadow-sm">
            {dictionary.modules.applicabilityCheck.questionnaire.notSeeded}
          </div>
        )}
      </div>
    </main>
  );
}
