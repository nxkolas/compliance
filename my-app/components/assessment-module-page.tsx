import { Card, CardContent } from "@/components/ui/card";
import { RouteTabs } from "@/components/route-tabs";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { cn } from "@/lib/utils";
import { getSelfCheckAssessmentForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

type AssessmentModulePageProps = {
  organizationId: string;
  assessmentId: string;
  title: string;
  children: ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  cardClassName?: string;
  contentClassName?: string;
};

type AssessmentModuleLayoutProps = {
  organizationId: string;
  assessmentId: string;
  children: ReactNode;
};

export async function AssessmentModuleLayout({
  organizationId,
  assessmentId,
  children,
}: AssessmentModuleLayoutProps) {
  const dictionary = await getDictionary();
  const assessment = await getAssessment(organizationId, assessmentId);

  const baseHref = `/tool/organizations/${organizationId}/applicability-check/${assessment.id}`;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
      {children}
    </section>
  );
}

export async function AssessmentModulePage({
  organizationId,
  assessmentId,
  title,
  children,
  headerClassName,
  titleClassName,
  descriptionClassName,
  cardClassName,
  contentClassName,
}: AssessmentModulePageProps) {
  const assessment = await getAssessment(organizationId, assessmentId);

  return (
    <>
      <div className={cn("flex flex-col gap-2", headerClassName)}>
        <h1 className={cn("text-3xl font-bold", titleClassName)}>{title}</h1>
        <p className={cn("text-muted-foreground", descriptionClassName)}>
          {assessment.title}
        </p>
      </div>
      <Card className={cn("rounded-lg shadow-sm", cardClassName)}>
        <CardContent
          className={cn("p-6 text-muted-foreground", contentClassName)}
        >
          {children}
        </CardContent>
      </Card>
    </>
  );
}

async function getAssessment(organizationId: string, assessmentId: string) {
  await connection();
  const user = await requireAuth();
  const assessment = await getSelfCheckAssessmentForUser(user.id, assessmentId);

  if (!assessment) {
    notFound();
  }

  if (assessment.organization.id !== organizationId) {
    notFound();
  }

  return assessment;
}
