"use client";

import { ApplicabilityCheckIcon, GapAnalysisIcon } from "@/components/workflow-icons";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Dictionary } from "@/src/i18n";
import { useSidebarOrganizationId } from "@/components/use-sidebar-organization-id";
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

type SidebarIconProps = {
  className?: string;
};

type SidebarLinkProps = {
  href: string;
  label: string;
  icon: ComponentType<SidebarIconProps>;
  currentPath: string;
  match: "exact" | "prefix";
  iconClassName?: string;
  iconWrapperClassName?: string;
};

export function AppSidebarNav({
  organizationId,
  labels,
  organizationSwitcher,
  profileMenu,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const sidebarOrganizationId = useSidebarOrganizationId(organizationId);

  const mainLinks = sidebarOrganizationId
    ? [
        {
          href: `/tool/organizations/${sidebarOrganizationId}`,
          label: labels.dashboard,
          icon: DashboardIcon,
          iconClassName: "h-[18px] w-[18px]",
          match: "exact" as const,
        },
        {
          href: `/tool/organizations/${sidebarOrganizationId}/applicability-check`,
          label: labels.applicabilityCheck,
          icon: ApplicabilityCheckIcon,
          iconClassName: "h-[19px] w-[18px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${sidebarOrganizationId}/gap-analysis`,
          label: labels.gapAnalysis,
          icon: GapAnalysisIcon,
          iconClassName: "h-[11px] w-[19px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${sidebarOrganizationId}/documents`,
          label: labels.documents,
          icon: DocumentsIcon,
          iconClassName: "h-[14px] w-[16px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${sidebarOrganizationId}/action-plan`,
          label: labels.actionPlan,
          icon: ActionPlanIcon,
          iconClassName: "size-[21px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${sidebarOrganizationId}/pdf-export`,
          label: labels.pdfExport,
          icon: PdfExportIcon,
          iconClassName: "size-[15px]",
          match: "prefix" as const,
        },
      ]
    : [];

  const tutorialLink = sidebarOrganizationId
    ? {
        href: `/tool/organizations/${sidebarOrganizationId}/help`,
        label: labels.startTutorial,
        icon: TutorialIcon,
        iconClassName: "size-[21px]",
        match: "prefix" as const,
      }
    : null;

  return (
    <div className="h-svh w-full overflow-hidden bg-transparent font-['Space_Grotesk']">
      <div className="flex h-full min-h-0 w-full flex-col bg-transparent px-[clamp(1.25rem,2.5vw,3rem)] py-[52px] [@media(max-height:950px)]:py-5 [@media(max-height:760px)]:py-3">
        {/* Logo */}
        <SidebarHeader className="w-full shrink-0 bg-transparent p-0">
          <Link
            href="/"
            aria-label={labels.productName}
            className="inline-flex w-full flex-col items-start gap-4"
          >
            <div className="relative h-11 w-full">
              <Image
                src="/images/robot.svg"
                alt=""
                aria-hidden="true"
                width={80}
                height={48}
                className="absolute left-0 top-[-11px] h-12 w-20 object-contain"
              />

              <div className="absolute left-[96px] top-[-2px] h-8 w-48">
                <span className="absolute left-[-0.4px] top-0 w-36 whitespace-nowrap text-3xl font-normal leading-7 text-black dark:text-foreground">
                  {labels.brandPrefix}
                </span>

                <Image
                  src="/images/comply-x.svg"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={28}
                  className="absolute left-[109px] top-[-3px] h-7 w-5 object-contain brightness-0 dark:brightness-100"
                />
              </div>
            </div>

            <div className="w-full text-sm font-normal leading-5 text-black dark:text-foreground">
              {labels.brandTaglineFirst}
              <br />
              {labels.brandTaglineSecond}
            </div>
          </Link>
        </SidebarHeader>

        {/* Organisationsauswahl */}
        <div
          className="
            mt-[79px]
            h-12
            w-full
            min-w-0
            shrink-0
            [@media(max-height:950px)]:mt-5
            [@media(max-height:760px)]:mt-3

            [&>*]:h-12
            [&>*]:w-full
            [&_[data-sidebar=menu]]:gap-0

            [&_[data-sidebar=menu-button]]:h-12
            [&_[data-sidebar=menu-button]]:w-full
            [&_[data-sidebar=menu-button]]:justify-start
            [&_[data-sidebar=menu-button]]:gap-[11px]
            [&_[data-sidebar=menu-button]]:rounded-lg
            [&_[data-sidebar=menu-button]]:px-[17px]
            [&_[data-sidebar=menu-button]]:py-0
            [&_[data-sidebar=menu-button]]:text-base
            [&_[data-sidebar=menu-button]]:font-semibold
            [&_[data-sidebar=menu-button]]:leading-5
            [&_[data-sidebar=menu-button]]:text-foreground

            [&_[data-sidebar=menu-button]]:hover:bg-sidebar-accent
            [&_[data-sidebar=menu-button]]:hover:text-sidebar-accent-foreground
            [&_[data-sidebar=menu-button]>svg]:text-sidebar-foreground
            [&_[data-slot=avatar]]:size-7
          "
        >
          {organizationSwitcher}
        </div>

        {/* Hauptnavigation */}
        {mainLinks.length > 0 && (
          <SidebarContent
            className="
              mt-[52px]
              min-h-0
              w-full
              flex-1
              overflow-x-hidden
              overflow-y-auto
              overscroll-contain
              [scrollbar-width:none]
              [&::-webkit-scrollbar]:hidden
              bg-transparent
              p-0
              [@media(max-height:950px)]:mt-5
              [@media(max-height:760px)]:mt-3
            "
          >
            <SidebarGroup className="w-full p-0">
              <SidebarMenu className="w-full gap-4 [@media(max-height:950px)]:gap-2 [@media(max-height:760px)]:gap-1">
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

        {/* Tutorial und Profil */}
        <SidebarFooter
          className="
            mt-auto
            w-full
            shrink-0
            bg-transparent
            p-0
          "
        >
          <SidebarGroup className="w-full p-0">
            <SidebarMenu className="w-full gap-4 [@media(max-height:950px)]:gap-2 [@media(max-height:760px)]:gap-1">
              {tutorialLink ? (
                <SidebarLink
                  currentPath={pathname}
                  {...tutorialLink}
                />
              ) : null}

              <SidebarMenuItem className="h-12 w-full">
                <div
                  className="
                    h-12
                    w-full
                    min-w-0

                    [&>*]:h-12
                    [&>*]:w-full

                    [&_[data-sidebar=menu-button]]:h-12
                    [&_[data-sidebar=menu-button]]:w-full
                    [&_[data-sidebar=menu-button]]:justify-start
                    [&_[data-sidebar=menu-button]]:gap-[14px]
                    [&_[data-sidebar=menu-button]]:rounded-lg
                    [&_[data-sidebar=menu-button]]:px-[18px]
                    [&_[data-sidebar=menu-button]]:py-0
                    [&_[data-sidebar=menu-button]]:text-base
                    [&_[data-sidebar=menu-button]]:font-semibold
                    [&_[data-sidebar=menu-button]]:leading-5
                    [&_[data-sidebar=menu-button]]:text-foreground

                    [&_[data-sidebar=menu-button]]:hover:bg-sidebar-accent
                    [&_[data-sidebar=menu-button]]:hover:text-sidebar-accent-foreground

                    [&_[data-sidebar=menu-button]>svg]:text-sidebar-foreground
                    [&_[data-slot=avatar]]:size-7
                  "
                >
                  {profileMenu}
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarFooter>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  iconClassName = "size-5",
  iconWrapperClassName = "",
  currentPath,
  match,
}: SidebarLinkProps) {
  const isActive =
    currentPath === href ||
    (match === "prefix" && currentPath.startsWith(`${href}/`));

  return (
    <SidebarMenuItem className="h-12 w-full">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="
          relative
          h-12
          w-full
          rounded-lg
          p-0
          text-sidebar-foreground

          hover:bg-sidebar-accent
          hover:text-sidebar-accent-foreground
          hover:shadow-navigation
          hover:[&_[data-sidebar-icon]]:text-sidebar-accent-foreground

          data-[active=true]:bg-sidebar-primary-foreground
          data-[active=true]:text-sidebar-primary
          data-[active=true]:shadow-navigation
          data-[active=true]:[&_[data-sidebar-icon]]:text-sidebar-primary
        "
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          className="flex h-12 w-full items-center gap-[14px] px-[18px]"
        >
          <span
            data-sidebar-icon
            className={`
              flex
              size-[24px]
              shrink-0
              items-center
              justify-center
              text-sidebar-foreground
              ${iconWrapperClassName}
            `}
          >
            <Icon className={iconClassName} />
          </span>

          <span className="min-w-0 flex-1 truncate text-base font-semibold leading-5">
            {label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function DashboardIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 17 17"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0.666992 0C1.03518 0 1.33398 0.298802 1.33398 0.666992V14C1.33398 14.2652 1.43942 14.5195 1.62695 14.707C1.81449 14.8946 2.06877 15 2.33398 15H15.667C16.0352 15 16.334 15.2988 16.334 15.667C16.334 16.0352 16.0352 16.334 15.667 16.334H2.33398C1.71515 16.334 1.12118 16.088 0.683594 15.6504C0.246009 15.2128 0 14.6188 0 14V0.666992C0 0.298802 0.298802 0 0.666992 0ZM4.83398 9.16699C5.20201 9.16719 5.50098 9.46592 5.50098 9.83398V12.334C5.50071 12.7018 5.20184 13.0008 4.83398 13.001C4.46596 13.001 4.16726 12.702 4.16699 12.334V9.83398C4.16699 9.46579 4.46579 9.16699 4.83398 9.16699ZM9 1.66699C9.36819 1.66699 9.66699 1.96579 9.66699 2.33398V12.334C9.66673 12.702 9.36803 13.001 9 13.001C8.63214 13.0008 8.33327 12.7018 8.33301 12.334V2.33398C8.33301 1.96592 8.63198 1.66719 9 1.66699ZM13.167 5C13.5352 5 13.834 5.2988 13.834 5.66699V12.334C13.8338 12.702 13.5351 13 13.167 13C12.7989 13 12.5002 12.702 12.5 12.334V5.66699C12.5 5.2988 12.7988 5 13.167 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DocumentsIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 15 13"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.33171 7.99844L4.33171 6.0651C4.44042 5.8492 4.60579 5.66691 4.81011 5.53774C5.01444 5.40856 5.25004 5.33737 5.49171 5.33177H12.665M12.665 5.33177C12.8687 5.33141 13.0698 5.37773 13.2528 5.46716C13.4358 5.55659 13.5959 5.68676 13.7208 5.84768C13.8456 6.0086 13.932 6.19599 13.9732 6.39547C14.0144 6.59495 14.0093 6.80122 13.9584 6.99844L12.9317 10.9984C12.8574 11.2861 12.6892 11.5408 12.4537 11.722C12.2181 11.9031 11.9288 12.0004 11.6317 11.9984H1.99837C1.64475 11.9984 1.30561 11.858 1.05556 11.6079C0.805515 11.3579 0.665039 11.0187 0.665039 10.6651V1.99844C0.665039 1.64481 0.805515 1.30568 1.05556 1.05563C1.30561 0.805579 1.64475 0.665103 1.99837 0.665103H4.59837C4.82136 0.662917 5.04134 0.716695 5.23817 0.821517C5.435 0.926338 5.6024 1.07885 5.72504 1.2651L6.26504 2.0651C6.38645 2.24946 6.55172 2.40078 6.74604 2.50551C6.94036 2.61023 7.15763 2.66507 7.37837 2.6651H11.3317C11.6853 2.6651 12.0245 2.80558 12.2745 3.05563C12.5246 3.30568 12.665 3.64481 12.665 3.99844V5.33177Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionPlanIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 7.2V10M10 12.8H10.0075M10 17C10 17 16 14.2 16 10V5.1L10 3L4 5.1V10C4 14.2 10 17 10 17Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfExportIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12.667 8C13.0352 8 13.334 8.2988 13.334 8.66699V11.334C13.3339 11.8643 13.123 12.3731 12.748 12.748C12.3731 13.123 11.8643 13.3339 11.334 13.334H2C1.46968 13.3339 0.960933 13.123 0.585938 12.748C0.210941 12.3731 8.61545e-05 11.8643 0 11.334V8.66699C0 8.2988 0.298802 8 0.666992 8C1.03518 8 1.33398 8.2988 1.33398 8.66699V11.334C1.33407 11.5107 1.40435 11.6797 1.5293 11.8047C1.65424 11.9296 1.82331 11.9999 2 12H11.334C11.5107 11.9999 11.6797 11.9296 11.8047 11.8047C11.9296 11.6797 11.9999 11.5107 12 11.334V8.66699C12 8.2988 12.2988 8 12.667 8ZM6.7002 0.00292969C6.72151 0.00397186 6.74252 0.00668773 6.76367 0.00976562C6.78347 0.0126556 6.80307 0.0149407 6.82227 0.0195312C6.84679 0.0253696 6.87067 0.0333387 6.89453 0.0419922C6.90795 0.0468815 6.92157 0.05093 6.93457 0.0566406C6.96601 0.0703976 6.99595 0.087593 7.02539 0.106445C7.03042 0.109669 7.03608 0.111881 7.04102 0.115234C7.07524 0.138477 7.10833 0.164988 7.13867 0.195312L10.4717 3.5293C10.7318 3.7896 10.7318 4.21138 10.4717 4.47168C10.2114 4.7318 9.78961 4.73179 9.5293 4.47168L7.33398 2.27637V8.66699C7.33398 9.03518 7.03518 9.33398 6.66699 9.33398C6.2988 9.33398 6 9.03518 6 8.66699V2.27637L3.80566 4.47168C3.54538 4.73197 3.12267 4.73185 2.8623 4.47168C2.60223 4.21143 2.60233 3.78962 2.8623 3.5293L6.19531 0.195312C6.26533 0.125291 6.35187 0.0734991 6.44727 0.0400391C6.47061 0.0318642 6.49362 0.0230807 6.51758 0.0175781C6.53421 0.0137629 6.55128 0.0123102 6.56836 0.00976562C6.59306 0.00606181 6.61767 0.00288099 6.64258 0.00195312C6.6507 0.00165986 6.6588 0 6.66699 0C6.67816 0 6.68916 0.00238624 6.7002 0.00292969Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TutorialIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width="30"
        height="30"
        rx="15"
        fill="currentColor"
        fillOpacity="0.2"
      />

      <circle
        cx="15"
        cy="15"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.33"
      />

      <path
        d="M12.8 12.4C12.8 11.1 13.78 10.25 15.05 10.25C16.28 10.25 17.2 11.03 17.2 12.15C17.2 13.08 16.73 13.56 15.87 14.12C15.17 14.58 14.83 14.97 14.83 15.75"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="14.83"
        cy="19.05"
        r="0.75"
        fill="currentColor"
      />
    </svg>
  );
}
