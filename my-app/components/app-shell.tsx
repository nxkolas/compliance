import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getDefaultDictionary, type Dictionary } from "@/lib/i18n";
import type { CSSProperties, ReactNode } from "react";

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
    <SidebarProvider
      className="max-xl:[&>[data-slot=sidebar]]:hidden"
      style={
        {
          "--sidebar-width": "24rem",
        } as CSSProperties
      }
    >
      {sidebar ?? (
        <AppSidebar
          organizationId={organizationId}
          dictionary={dictionary}
        />
      )}
      <SidebarInset className="min-w-0 bg-transparent">
        <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-white/10 bg-background/95 px-4 backdrop-blur-sm xl:hidden">
          <SidebarTrigger
            label={dictionary.sidebar.navigation}
            className="size-9 rounded-lg border border-white/15 bg-white/5 text-white shadow-sm hover:bg-white/10 hover:text-white"
          />
        </div>
        <div className="min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-6 sm:pt-7 md:px-8 md:pt-9 xl:px-[53px] xl:pt-[54px]">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
