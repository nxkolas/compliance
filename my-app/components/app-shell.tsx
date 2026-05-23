import { AppTopbar } from "@/components/app-topbar";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Suspense, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  organizationId?: string;
  organizationName?: string;
  assessmentId?: string;
  assessmentTitle?: string;
};

export function AppShell({
  children,
  organizationId,
  organizationName,
  assessmentId,
  assessmentTitle,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <AppTopbar
        organizationId={organizationId}
        organizationName={organizationName}
      />

      <div className="grid min-h-[calc(100vh-4rem)] md:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar className="md:sticky md:top-16 md:h-[calc(100vh-4rem)]">
          <SidebarContent>
            <Suspense fallback={null}>
              <AppSidebarNav
                organizationId={organizationId}
                organizationName={organizationName}
                assessmentId={assessmentId}
                assessmentTitle={assessmentTitle}
              />
            </Suspense>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="p-0">
          <div className="px-6 py-6 md:px-8 md:py-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
