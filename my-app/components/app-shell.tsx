import { AppTopbar } from "@/components/app-topbar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  Inbox,
  ListChecks,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ComponentType, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  organizationId?: string;
  organizationName?: string;
  assessmentId?: string;
  assessmentTitle?: string;
};

const globalLinks = [
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/organizations/inbox", label: "Inbox", icon: Inbox },
];

export function AppShell({
  children,
  organizationId,
  organizationName,
  assessmentId,
  assessmentTitle,
}: AppShellProps) {
  const organizationLinks = organizationId
    ? [
        {
          href: `/organizations/${organizationId}`,
          label: "Overview",
          icon: ClipboardCheck,
        },
        {
          href: `/organizations/${organizationId}/team`,
          label: "Team",
          icon: Users,
        },
        {
          href: `/organizations/${organizationId}/requirements`,
          label: "Requirements",
          icon: ListChecks,
        },
        {
          href: `/organizations/${organizationId}/risk-management`,
          label: "Risk management",
          icon: ShieldCheck,
        },
        {
          href: `/organizations/${organizationId}/suppliers`,
          label: "Suppliers",
          icon: Truck,
        },
        {
          href: `/organizations/${organizationId}/registration`,
          label: "Registration",
          icon: FileCheck2,
        },
      ]
    : [];

  const assessmentLinks = assessmentId
    ? [
        {
          href: `/assessments/${assessmentId}`,
          label: "Assessment",
          icon: ClipboardCheck,
        },
        {
          href: `/assessments/${assessmentId}/questionnaire`,
          label: "Questionnaire",
          icon: ListChecks,
        },
        {
          href: `/assessments/${assessmentId}/result`,
          label: "Result",
          icon: UserRoundCheck,
        },
      ]
    : [];

  return (
    <SidebarProvider>
      <AppTopbar
        organizationId={organizationId}
        organizationName={organizationName}
      />

      <div className="grid min-h-[calc(100vh-4rem)] md:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar className="md:sticky md:top-16 md:h-[calc(100vh-4rem)]">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                {globalLinks.map((link) => (
                  <SidebarLink key={link.href} {...link} />
                ))}
              </SidebarMenu>
            </SidebarGroup>

            {organizationLinks.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>
                  {organizationName ?? "Organization"}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {organizationLinks.map((link) => (
                    <SidebarLink key={link.href} {...link} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}

            {assessmentLinks.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>
                  {assessmentTitle ?? "Assessment"}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {assessmentLinks.map((link) => (
                    <SidebarLink key={link.href} {...link} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="p-0">
          <div className="px-6 py-6 md:px-8 md:py-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <SidebarMenuButton asChild>
      <Link href={href}>
        <Icon className="h-4 w-4 shrink-0 text-foreground/70" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    </SidebarMenuButton>
  );
}
