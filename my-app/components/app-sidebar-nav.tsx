"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  Inbox,
  ListChecks,
  Settings,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

type AppSidebarNavProps = {
  organizationId?: string;
  organizationName?: string;
  assessmentId?: string;
  assessmentTitle?: string;
};

const globalLinks = [
  { href: "/tool/organizations", label: "Organizations", icon: Building2 },
  { href: "/tool/organizations/inbox", label: "Inbox", icon: Inbox },
];

export function AppSidebarNav({
  organizationId,
  organizationName,
  assessmentId,
  assessmentTitle,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const isSettings = pathname.includes("/settings");

  const organizationLinks = organizationId
    ? [
        {
          href: `/tool/organizations/${organizationId}`,
          label: "Overview",
          icon: ClipboardCheck,
        },
        {
          href: `/tool/organizations/${organizationId}/requirements`,
          label: "Requirements",
          icon: ListChecks,
        },
        {
          href: `/tool/organizations/${organizationId}/risk-management`,
          label: "Risk management",
          icon: ShieldCheck,
        },
        {
          href: `/tool/organizations/${organizationId}/suppliers`,
          label: "Suppliers",
          icon: Truck,
        },
        {
          href: `/tool/organizations/${organizationId}/registration`,
          label: "Registration",
          icon: FileCheck2,
        },
        {
          href: `/tool/organizations/${organizationId}/settings`,
          label: "Settings",
          icon: Settings,
        },
      ]
    : [];

  const settingsLinks =
    organizationId && isSettings
      ? [
          {
            href: `/tool/organizations/${organizationId}/settings`,
            label: "General",
            icon: Settings,
          },
          {
            href: `/tool/organizations/${organizationId}/settings/team`,
            label: "Team",
            icon: Users,
          },
        ]
      : [];

  const assessmentLinks = assessmentId
    ? [
        {
          href: `/tool/assessments/${assessmentId}`,
          label: "Assessment",
          icon: ClipboardCheck,
        },
        {
          href: `/tool/assessments/${assessmentId}/questionnaire`,
          label: "Questionnaire",
          icon: ListChecks,
        },
        {
          href: `/tool/assessments/${assessmentId}/result`,
          label: "Result",
          icon: UserRoundCheck,
        },
      ]
    : [];

  return (
    <>
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

      {settingsLinks.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsLinks.map((link) => (
              <SidebarLink key={link.href} {...link} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {assessmentLinks.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{assessmentTitle ?? "Assessment"}</SidebarGroupLabel>
          <SidebarMenu>
            {assessmentLinks.map((link) => (
              <SidebarLink key={link.href} {...link} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
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
