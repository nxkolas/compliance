import { AssessmentModuleLayout } from "@/components/assessment-module-page";
import type { ReactNode } from "react";

type AssessmentLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export default async function AssessmentLayout({
  children,
  params,
}: AssessmentLayoutProps) {
  const { organizationId, assessmentId } = await params;

  return (
    <AssessmentModuleLayout
      organizationId={organizationId}
      assessmentId={assessmentId}
    >
      {children}
    </AssessmentModuleLayout>
  );
}
