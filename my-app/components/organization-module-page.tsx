import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

type OrganizationModulePageProps = {
  organizationId: string;
  title: string;
  children: ReactNode;
};

export async function OrganizationModulePage({
  organizationId,
  title,
  children,
}: OrganizationModulePageProps) {
  await connection();
  const user = await requireAuth();
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{organization.name}</p>
      </div>
      <Card className="rounded-lg shadow-sm">
        <CardContent className="p-6 text-muted-foreground">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
