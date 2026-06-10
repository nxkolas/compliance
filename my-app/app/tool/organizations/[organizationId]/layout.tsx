import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
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

export default function OrganizationLayout(props: OrganizationLayoutProps) {
  return (
    <Suspense fallback={<OrganizationLayoutFallback />}>
      <OrganizationLayoutContent {...props} />
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
  const dictionary = await getDictionary();
  const organization = await getOrganizationForUser(user.id, organizationId);

  if (!organization) {
    notFound();
  }

  return (
    <AppShell
      organizationId={organization.id}
      dictionary={dictionary}
    >
      {children}
    </AppShell>
  );
}

function OrganizationLayoutFallback() {
  return (
    <SidebarProvider>
      <Sidebar
        collapsible="none"
        className="min-h-svh w-[401px] shrink-0 border-r bg-[rgba(255,255,255,0.10)]"
      >
        <div className="flex flex-col gap-8 px-[55px] pb-8 pt-10">
          <Skeleton className="h-[92px] w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <div className="flex-1 px-[53px] pb-8 pt-[54px]">
          <section
            className="flex w-full flex-col gap-8"
            aria-busy="true"
          >
            <header className="flex flex-col gap-3">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-7 w-[42rem] max-w-full" />
            </header>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-md" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-48 rounded-lg" />
              ))}
            </div>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
