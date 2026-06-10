import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getDefaultDictionary, type Dictionary } from "@/lib/i18n";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  organizationId?: string;
  dictionary?: Dictionary;
  sidebar?: ReactNode;
};

export function AppShell({
  children,
  organizationId,
  dictionary = getDefaultDictionary(),
  sidebar,
}: AppShellProps) {
  return (
    <SidebarProvider>
      {sidebar ?? (
        <AppSidebar
          organizationId={organizationId}
          dictionary={dictionary}
        />
      )}
      <SidebarInset className="bg-transparent">
        <div className="flex-1 px-[53px] pt-[54px] pb-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
