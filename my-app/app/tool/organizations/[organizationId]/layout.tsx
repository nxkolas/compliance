import { AppShell } from "@/components/app-shell";
import { AppSidebar } from "@/components/app-sidebar";
import {
  AppSidebarSkeleton,
  OrganizationModulePageSkeleton,
} from "@/components/navigation-loading";
import { getDictionary } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { notFound } from "next/navigation";
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
    <AppShell
      sidebar={
        <Suspense fallback={<AppSidebarSkeleton />}>
          <OrganizationSidebar params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<OrganizationModulePageSkeleton />}>
        <OrganizationLayoutContent params={params}>
          {children}
        </OrganizationLayoutContent>
      </Suspense>
    </AppShell>
  );
}

async function OrganizationSidebar({
  params,
}: Pick<OrganizationLayoutProps, "params">) {
  const dictionary = await getDictionary();
  const { organizationId } = await params;

  return (
    <AppSidebar
      organizationId={organizationId}
      dictionary={dictionary}
    />
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

  return children;
}
