import { AssessmentModulePage } from "@/components/assessment-module-page";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import Link from "next/link";

type AssessmentPageProps = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export default async function AssessmentPage({ params }: AssessmentPageProps) {
  const dictionary = await getDictionary();
  const { organizationId, assessmentId } = await params;
  const baseHref = `/tool/organizations/${organizationId}/applicability-check/${assessmentId}`;
  const labels = dictionary.modules.applicabilityCheck.workflow;

  return (
    <AssessmentModulePage
      organizationId={organizationId}
      assessmentId={assessmentId}
      title={dictionary.sidebar.applicabilityCheck}
    >
      <div className="grid gap-5 text-foreground">
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{labels.purposeTitle}</h2>
          <p className="text-muted-foreground">
            {labels.purposeDescription}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-lg border p-5">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 text-primary" />
              <div className="grid gap-2">
                <h2 className="text-lg font-semibold">{labels.inputsTitle}</h2>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {labels.inputs.map((input) => (
                    <li key={input}>{input}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild className="mt-auto w-full sm:w-fit">
              <Link href={`${baseHref}/questionnaire`}>
                {labels.openQuestionnaire}
                <ArrowRight />
              </Link>
            </Button>
          </section>

          <section className="flex flex-col gap-4 rounded-lg border p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="grid gap-2">
                <h2 className="text-lg font-semibold">{labels.resultTitle}</h2>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {labels.results.map((result) => (
                    <li key={result}>{result}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-auto w-full sm:w-fit">
              <Link href={`${baseHref}/result`}>
                {labels.viewResult}
                <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>
      </div>
    </AssessmentModulePage>
  );
}
