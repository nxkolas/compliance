import { Card, CardContent } from "@/components/ui/card";
import { RouteTabs } from "@/components/route-tabs";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getSelfCheckAssessmentForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

type AssessmentModulePageProps = {
  organizationId: string;
  assessmentId: string;
  title: string;
  children: ReactNode;
};

export async function AssessmentModulePage({
  organizationId,
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

  if (assessment.organization.id !== organizationId) {
    notFound();
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check/${assessment.id}`;

  return (
    <section className="flex w-full flex-col gap-6">
      <RouteTabs
        tabs={[
          {
            href: baseHref,
            label: dictionary.sidebar.applicabilityCheck,
          },
          {
            href: `${baseHref}/questionnaire`,
            label: dictionary.sidebar.questionnaire,
          },
          {
            href: `${baseHref}/result`,
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
  );
}
