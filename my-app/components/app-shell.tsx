import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getDefaultDictionary, type Dictionary } from "@/lib/i18n";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  organizationId?: string;
  dictionary?: Dictionary;
};

export function AppShell({
  children,
  organizationId,
  dictionary = getDefaultDictionary(),
}: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar
        organizationId={organizationId}
        dictionary={dictionary}
      />
      <SidebarInset className="bg-transparent">
        <div className="flex-1 px-6 py-6 md:px-8 md:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
