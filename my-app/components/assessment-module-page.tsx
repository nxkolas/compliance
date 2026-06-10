import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { RouteTabs } from "@/components/route-tabs";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getSelfCheckAssessmentForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

type AssessmentModulePageProps = {
  assessmentId: string;
  title: string;
  children: ReactNode;
};

export async function AssessmentModulePage({
  assessmentId,
  title,
  children,
}: AssessmentModulePageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const assessment = await getSelfCheckAssessmentForUser(user.id, assessmentId);

  if (!assessment) {
    notFound();
  }

  return (
    <AppShell
      organizationId={assessment.organization.id}
      dictionary={dictionary}
    >
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <RouteTabs
          tabs={[
            {
              href: `/tool/assessments/${assessment.id}`,
              label: dictionary.sidebar.applicabilityCheck,
            },
            {
              href: `/tool/assessments/${assessment.id}/questionnaire`,
              label: dictionary.sidebar.questionnaire,
            },
            {
              href: `/tool/assessments/${assessment.id}/result`,
              label: dictionary.sidebar.result,
            },
          ]}
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{assessment.title}</p>
        </div>
        <Card className="rounded-lg shadow-sm">
          <CardContent className="p-6 text-muted-foreground">
            {children}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
