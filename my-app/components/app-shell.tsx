import { AuthButton } from "@/components/auth-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { hasEnvVars } from "@/lib/utils";
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plus,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense, type ComponentType, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  organizationId?: string;
  organizationName?: string;
  assessmentId?: string;
  assessmentTitle?: string;
};

const globalLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/organizations/inbox", label: "Inbox", icon: Inbox },
  { href: "/organizations/new", label: "New organization", icon: Plus },
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
          href: `/new/${organizationId}`,
          label: "New assessment",
          icon: Plus,
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
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
            <Link href="/dashboard" className="px-2 text-sm font-semibold">
              NIS2 Compliance Checker
            </Link>
            <p className="px-2 text-xs text-muted-foreground">
              Compliance workspace
            </p>
          </SidebarHeader>

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

          <SidebarFooter>
            {hasEnvVars ? (
              <Suspense>
                <AuthButton />
              </Suspense>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">
                Supabase environment variables missing.
              </p>
            )}
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
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
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </SidebarMenuButton>
  );
}
