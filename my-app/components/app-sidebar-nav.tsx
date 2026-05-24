"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import type { Dictionary } from "@/lib/i18n";
import {
  Building2,
  Bot,
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
  labels: Dictionary["sidebar"];
};

export function AppSidebarNav({
  organizationId,
  organizationName,
  assessmentId,
  assessmentTitle,
  labels,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const isSettings = pathname.includes("/settings");
  const globalLinks = [
    { href: "/tool/organizations", label: labels.organizations, icon: Building2 },
    { href: "/tool/organizations/inbox", label: labels.inbox, icon: Inbox },
  ];

  const organizationLinks = organizationId
    ? [
        {
          href: `/tool/organizations/${organizationId}`,
          label: labels.overview,
          icon: ClipboardCheck,
        },
        {
          href: `/tool/organizations/${organizationId}/requirements`,
          label: labels.requirements,
          icon: ListChecks,
        },
        {
          href: `/tool/organizations/${organizationId}/risk-management`,
          label: labels.riskManagement,
          icon: ShieldCheck,
        },
        {
          href: `/tool/organizations/${organizationId}/assistant`,
          label: labels.assistant,
          icon: Bot,
        },
        {
          href: `/tool/organizations/${organizationId}/suppliers`,
          label: labels.suppliers,
          icon: Truck,
        },
        {
          href: `/tool/organizations/${organizationId}/registration`,
          label: labels.registration,
          icon: FileCheck2,
        },
        {
          href: `/tool/organizations/${organizationId}/settings`,
          label: labels.settings,
          icon: Settings,
        },
      ]
    : [];

  const settingsLinks =
    organizationId && isSettings
      ? [
          {
            href: `/tool/organizations/${organizationId}/settings`,
            label: labels.general,
            icon: Settings,
          },
          {
            href: `/tool/organizations/${organizationId}/settings/team`,
            label: labels.team,
            icon: Users,
          },
        ]
      : [];

  const assessmentLinks = assessmentId
    ? [
        {
          href: `/tool/assessments/${assessmentId}`,
          label: labels.assessment,
          icon: ClipboardCheck,
        },
        {
          href: `/tool/assessments/${assessmentId}/questionnaire`,
          label: labels.questionnaire,
          icon: ListChecks,
        },
        {
          href: `/tool/assessments/${assessmentId}/result`,
          label: labels.result,
          icon: UserRoundCheck,
        },
      ]
    : [];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{labels.workspace}</SidebarGroupLabel>
          <SidebarMenu>
            {globalLinks.map((link) => (
              <SidebarLink
                key={link.href}
                currentPath={pathname}
                match="exact"
                {...link}
              />
            ))}
          </SidebarMenu>
      </SidebarGroup>

      {organizationLinks.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>
            {organizationName ?? labels.organizations}
          </SidebarGroupLabel>
          <SidebarMenu>
            {organizationLinks.map((link) => (
              <SidebarLink
                key={link.href}
                currentPath={pathname}
                match="exact"
                {...link}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {settingsLinks.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{labels.settings}</SidebarGroupLabel>
          <SidebarMenu>
            {settingsLinks.map((link) => (
              <SidebarLink
                key={link.href}
                currentPath={pathname}
                match="exact"
                {...link}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {assessmentLinks.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{assessmentTitle ?? labels.assessment}</SidebarGroupLabel>
          <SidebarMenu>
            {assessmentLinks.map((link) => (
              <SidebarLink
                key={link.href}
                currentPath={pathname}
                match="exact"
                {...link}
              />
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
  currentPath,
  match = "exact",
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  currentPath: string;
  match?: "exact" | "prefix";
}) {
  const isActive =
    currentPath === href ||
    (match === "prefix" && currentPath.startsWith(`${href}/`));

  return (
    <SidebarMenuButton asChild>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        data-active={isActive ? "true" : undefined}
      >
        <Icon className="h-4 w-4 shrink-0 text-foreground/70" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    </SidebarMenuButton>
  );
}
