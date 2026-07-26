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
  FolderOpen,
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
          href: `/tool/organizations/${organizationId}/documents`,
          label: labels.documents,
          icon: FolderOpen,
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

  const settingsLink = organizationId
    ? {
        href: `/tool/organizations/${organizationId}/settings`,
        label: labels.settings,
        icon: Settings,
        match: "prefix" as const,
      }
    : null;

  const tutorialLink = {
    href: "/tool/help",
    label: labels.startTutorial,
    icon: BookOpen,
    match: "prefix" as const,
  };

  return (
    <div
      className="
        relative
        h-svh
        min-h-[800px]
        w-full
        overflow-hidden
        bg-transparent
        font-['Space_Grotesk']
      "
    >
      {/* Logo und Beschreibung */}
      <SidebarHeader
        className="
          absolute
          left-[54px]
          top-[52px]
          w-72
          bg-transparent
          p-0
        "
      >
        <Link
          href="/tool/organizations"
          className="
            inline-flex
            w-72
            flex-col
            items-start
            justify-start
            gap-4
          "
        >
          {/* Logozeile */}
          <div className="flex h-12 w-72 items-start">
            {/* Roboter */}
            <div className="relative h-12 w-20 shrink-0">
  <Image
    src="/images/robot.svg"
    alt=""
    aria-hidden="true"
    width={80}
    height={48}
    className="h-12 w-20 object-contain"
  />
</div>

{/* comply + Figma-Vector-X */}
<div className="ml-4 flex h-12 items-center">
  <span
    className="
      whitespace-nowrap
      font-['Space_Grotesk']
      text-3xl
      font-normal
      leading-7
      text-white
    "
  >
    comply
  </span>

  <Image
    src="/images/comply-x.svg"
    alt=""
    aria-hidden="true"
    width={20}
    height={28}
    className="
      relative
      -ml-[-2px]
      -top-[3px]
      h-7
      w-5
      shrink-0
      object-contain
    "
  />
</div>
          </div>

          {/* Beschreibung */}
          <div
            className="
              w-72
              font-['Space_Grotesk']
              text-sm
              font-normal
              leading-5
              text-indigo-50
            "
          >
            setzt das Puzzle fort, für NIS2-Schutz
            <br />
            an jedem Ort.
          </div>
        </Link>
      </SidebarHeader>

      {/* Organisationsauswahl */}
      <div
        className="
          absolute
          left-[54px]
          top-[231px]
          h-12
          w-72
          min-w-0
          [&>*]:h-12
          [&>*]:w-full
        "
      >
        {organizationSwitcher}
      </div>

      {/* Hauptnavigation */}
      {mainLinks.length > 0 && (
        <SidebarContent
          className="
            absolute
            left-[54px]
            top-[331px]
            w-72
            flex-none
            overflow-visible
            bg-transparent
            p-0
          "
        >
          <SidebarGroup className="w-72 p-0">
            <SidebarMenu className="w-72 gap-4">
              {mainLinks.map((link) => (
                <SidebarLink
                  key={link.href}
                  currentPath={pathname}
                  {...link}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      )}

      {/* Einstellungen, Tutorial und Profil */}
      <SidebarFooter
        className="
          absolute
          bottom-[54px]
          left-[54px]
          w-72
          bg-transparent
          p-0
        "
      >
        <SidebarGroup className="w-72 p-0">
          <SidebarMenu className="w-72 gap-4">
            {settingsLink ? (
              <SidebarLink
                currentPath={pathname}
                {...settingsLink}
              />
            ) : (
              <SidebarStaticItem
                label={labels.settings}
                icon={Settings}
              />
            )}

            <SidebarLink
              currentPath={pathname}
              {...tutorialLink}
            />

            <SidebarMenuItem className="h-12 w-72">
  <div
    className="
      h-12
      w-72
      min-w-0

      [&>*]:h-12
      [&>*]:w-full

      [&_[data-sidebar=menu-button]]:h-12
      [&_[data-sidebar=menu-button]]:w-72
      [&_[data-sidebar=menu-button]]:justify-start
      [&_[data-sidebar=menu-button]]:gap-[14px]
      [&_[data-sidebar=menu-button]]:rounded-lg
      [&_[data-sidebar=menu-button]]:px-[22px]
      [&_[data-sidebar=menu-button]]:py-0

      [&_[data-sidebar=menu-button]]:hover:bg-[#18275D]
      [&_[data-sidebar=menu-button]]:hover:text-white
    "
  >
    {profileMenu}
  </div>
</SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
    </div>
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
    <SidebarMenuItem className="h-12 w-72">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="
          relative
          h-12
          w-72
          rounded-lg
          p-0
          text-neutral-50

          hover:bg-[#18275D]
          hover:text-[#FBFBFB]
          hover:shadow-[0_4px_4px_0_rgba(0,0,0,0.12)]
          hover:[&_svg]:text-[#FBFBFB]

          data-[active=true]:bg-[#FBFBFB]
          data-[active=true]:text-[#002BFF]
          data-[active=true]:shadow-[0_4px_4px_0_rgba(0,0,0,0.12)]
          data-[active=true]:[&_svg]:text-[#002BFF]
        "
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          className="relative block h-12 w-72"
        >
          <Icon
            className="
              absolute
              left-[22px]
              top-[14px]
              size-5
              shrink-0
              text-neutral-50
            "
          />

          <span
            className="
              absolute
              left-[56px]
              top-[14.5px]
              max-w-[205px]
              truncate
              text-base
              font-semibold
              leading-5
            "
          >
            {label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarStaticItem({
  label,
  icon: Icon,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <SidebarMenuItem className="h-12 w-72">
      <div
        aria-disabled="true"
        className="
          relative
          h-12
          w-72
          cursor-not-allowed
          rounded-lg
          text-neutral-50
          opacity-70
        "
      >
        <Icon
          className="
            absolute
            left-[22px]
            top-[15px]
            size-5
            text-neutral-50
          "
        />

        <span
          className="
            absolute
            left-[56px]
            top-[14.5px]
            max-w-[205px]
            truncate
            text-base
            font-semibold
            leading-5
          "
        >
          {label}
        </span>
      </div>
    </SidebarMenuItem>
  );
}
