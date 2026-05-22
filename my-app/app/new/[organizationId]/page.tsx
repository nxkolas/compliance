import { AppNavigation } from "@/components/app-navigation";
import { AssessmentCreateForm } from "@/components/organizations/assessment-create-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-4">
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/organizations/${organization.id}`}>
            <ArrowLeft />
            {organization.name}
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">New NIS2 assessment</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create a draft assessment for {organization.name}.
          </p>
        </div>
      </section>
      <AssessmentCreateForm organizationId={organization.id} />
    </main>
  );
}

function NewAssessmentPageFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">New NIS2 assessment</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading assessment form...
        </p>
      </section>
    </main>
  );
}
