import { AppShell } from "@/components/app-shell";
import { AssessmentCreateForm } from "@/components/organizations/assessment-create-form";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

type NewAssessmentPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function NewAssessmentPage({
  params,
}: NewAssessmentPageProps) {
  return (
    <Suspense fallback={<NewAssessmentPageFallback />}>
      <NewAssessmentPageContent params={params} />
    </Suspense>
  );
}

async function NewAssessmentPageContent({ params }: NewAssessmentPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <AppShell
      organizationId={organization.id}
      organizationName={organization.name}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">New NIS2 assessment</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create a draft assessment for {organization.name}.
          </p>
        </div>
      </section>
      <AssessmentCreateForm organizationId={organization.id} />
      </div>
    </AppShell>
  );
}

function NewAssessmentPageFallback() {
  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">New NIS2 assessment</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading assessment form...
        </p>
      </section>
    </AppShell>
  );
}
