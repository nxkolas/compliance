import { AppShell } from "@/components/app-shell";
import { OrganizationCreateForm } from "@/components/organizations/organization-create-form";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";
import { Suspense } from "react";

export default function NewOrganizationPage() {
  return (
    <Suspense fallback={<NewOrganizationPageFallback />}>
      <NewOrganizationPageContent />
    </Suspense>
  );
}

async function NewOrganizationPageContent() {
  await connection();
  await requireAuth();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">New organization</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create a workspace for a legal entity, then invite teammates from
            the organization page.
          </p>
        </div>
      </section>
      <OrganizationCreateForm />
      </div>
    </AppShell>
  );
}

function NewOrganizationPageFallback() {
  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">New organization</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading organization form...
        </p>
      </section>
    </AppShell>
  );
}
