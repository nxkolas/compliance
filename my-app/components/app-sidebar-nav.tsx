"use client";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Dictionary } from "@/lib/i18n";
import {
  BookOpen,
  ClipboardCheck,
  ListChecks,
  PieChart,
  ReceiptText,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

type AppSidebarNavProps = {
  organizationId?: string;
  labels: Dictionary["sidebar"];
  organizationSwitcher: ReactNode;
  profileMenu: ReactNode;
};

export function AppSidebarNav({
  organizationId,
  labels,
  organizationSwitcher,
  profileMenu,
}: AppSidebarNavProps) {
  const pathname = usePathname();

  const mainLinks = organizationId
    ? [
        {
          href: `/tool/organizations/${organizationId}`,
          label: labels.dashboard,
          icon: PieChart,
          match: "exact" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/applicability-check`,
          label: labels.applicabilityCheck,
          icon: ClipboardCheck,
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/gap-analysis`,
          label: labels.gapAnalysis,
          icon: ShieldCheck,
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/action-plan`,
          label: labels.actionPlan,
          icon: ListChecks,
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/pdf-export`,
          label: labels.pdfExport,
          icon: ReceiptText,
          match: "prefix" as const,
        },
      ]
    : [];

  const footerLinks = organizationId
    ? [
        {
          href: `/tool/organizations/${organizationId}/settings`,
          label: labels.settings,
          icon: Settings,
          match: "prefix" as const,
        },
        {
          href: "/tool/help",
          label: labels.startTutorial,
          icon: BookOpen,
          match: "prefix" as const,
        },
      ]
    : [
        {
          href: "/tool/help",
          label: labels.startTutorial,
          icon: BookOpen,
          match: "prefix" as const,
        },
      ];

  return (
    <>
      <SidebarHeader className="gap-8 px-[55px] pb-8 pt-10">
        <div className="flex flex-col gap-3">
          <Link
            href="/tool/organizations"
            className="flex items-start gap-3 overflow-hidden"
          >
            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#E8F1FF] p-2">
              <Image
                src="/images/X.svg"
                alt=""
                width={24}
                height={24}
                className="size-6 object-contain"
                priority
              />
            </span>
            <span className="flex flex-col gap-1">
              <span className="whitespace-nowrap text-[32px] font-semibold leading-7 tracking-[-0.439px] text-white">
                complyX
              </span>
              <span className="[font-family:Inter,sans-serif] text-xs font-normal leading-4 text-[#E8F1FF]">
                NIS2 Compliance Checker
              </span>
            </span>
          </Link>
          <p className="[font-family:Inter,sans-serif] text-sm font-normal leading-5 tracking-[-0.15px] text-[#E8F1FF]">
            Compliance &amp; Security Design Validation for Financial Services
          </p>
        </div>

        <div className="min-w-0">
          {organizationSwitcher}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {mainLinks.length > 0 && (
          <SidebarGroup className="px-[55px]">
            <SidebarMenu className="gap-4">
              {mainLinks.map((link) => (
                <SidebarLink
                  key={link.href}
                  currentPath={pathname}
                  {...link}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-0 pb-8">
        <SidebarGroup className="px-[55px]">
          <SidebarMenu className="gap-4">
            {footerLinks.map((link) => (
              <SidebarLink
                key={link.href}
                currentPath={pathname}
                {...link}
              />
            ))}
            <SidebarMenuItem>
              <div className="min-w-0">{profileMenu}</div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
    </>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  currentPath,
  match,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  currentPath: string;
  match: "exact" | "prefix";
}) {
  const isActive =
    currentPath === href ||
    (match === "prefix" && currentPath.startsWith(`${href}/`));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="h-auto gap-3 rounded-lg px-3 pt-[14.5px] pb-[13.5px] hover:bg-[#252A36] hover:text-[#FBFBFB] hover:shadow-[0_4px_4px_0_rgba(0,0,0,0.12)] hover:[&_svg]:text-[#FBFBFB] data-[active=true]:bg-[#FBFBFB] data-[active=true]:text-[#002BFF] data-[active=true]:shadow-[0_4px_4px_0_rgba(0,0,0,0.12)] data-[active=true]:[&_svg]:text-[#002BFF]"
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className="size-5 shrink-0 text-foreground/70" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
