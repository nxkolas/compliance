import { OrganizationModulePageSkeleton } from "@/components/navigation-loading";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/modules/organizations";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

type OrganizationLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
};

export default function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  return (
    <Suspense fallback={<OrganizationModulePageSkeleton />}>
      <OrganizationLayoutContent params={params}>
        {children}
      </OrganizationLayoutContent>
    </Suspense>
  );
}

async function OrganizationLayoutContent({
  children,
  params,
}: OrganizationLayoutProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }
  if (organization.archivedAt) {
    redirect("/tool/organizations?notice=archived");
  }

  return children;
}
