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

  const mainLinks = organizationId
    ? [
        {
          href: `/tool/organizations/${organizationId}`,
          label: labels.dashboard,
          icon: DashboardIcon,
          iconClassName: "h-[18px] w-[18px]",
          match: "exact" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/applicability-check`,
          label: labels.applicabilityCheck,
          icon: ApplicabilityCheckIcon,
          iconClassName: "h-[19px] w-[18px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/gap-analysis`,
          label: labels.gapAnalysis,
          icon: GapAnalysisIcon,
          iconClassName: "h-[11px] w-[19px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/documents`,
          label: labels.documents,
          icon: DocumentsIcon,
          iconClassName: "h-[14px] w-[16px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/action-plan`,
          label: labels.actionPlan,
          icon: ActionPlanIcon,
          iconClassName: "size-[21px]",
          match: "prefix" as const,
        },
        {
          href: `/tool/organizations/${organizationId}/pdf-export`,
          label: labels.pdfExport,
          icon: PdfExportIcon,
          iconClassName: "size-[15px]",
          match: "prefix" as const,
        },
      ]
    : [];

  const settingsLink = organizationId
    ? {
        href: `/tool/organizations/${organizationId}/settings`,
        label: labels.settings,
        icon: SettingsIcon,
        iconClassName: "h-[19px] w-[18px]",
        match: "prefix" as const,
      }
    : null;

  const tutorialLink = {
    href: "/tool/help",
    label: labels.startTutorial,
    icon: TutorialIcon,
    iconClassName: "size-[21px]",
    match: "prefix" as const,
  };

  return (
    <div className="h-svh w-full overflow-hidden bg-transparent font-['Space_Grotesk']">
      <div className="flex h-full min-h-0 w-full flex-col bg-transparent px-[54px] py-[52px] [@media(max-height:950px)]:py-5">
        {/* Logo */}
        <SidebarHeader className="w-72 shrink-0 bg-transparent p-0">
          <Link
            href="/tool/organizations"
            className="inline-flex w-72 flex-col items-start gap-4"
          >
            <div className="relative h-11 w-72">
              <Image
                src="/images/robot.svg"
                alt=""
                aria-hidden="true"
                width={80}
                height={48}
                className="absolute left-0 top-[-11px] h-12 w-20 object-contain"
              />

              <div className="absolute left-[96px] top-[-2px] h-8 w-48">
                <span className="absolute left-[-0.4px] top-0 w-36 whitespace-nowrap text-3xl font-normal leading-7 text-white">
                  {labels.brandPrefix}
                </span>

                <Image
                  src="/images/comply-x.svg"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={28}
                  className="absolute left-[109px] top-[-3px] h-7 w-5 object-contain"
                />
              </div>
            </div>

            <div className="w-72 text-sm font-normal leading-5 text-indigo-50">
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
            w-72
            min-w-0
            shrink-0
            [@media(max-height:950px)]:mt-5

            [&>*]:h-12
            [&>*]:w-full
            [&_[data-sidebar=menu]]:gap-0

            [&_[data-sidebar=menu-button]]:h-12
            [&_[data-sidebar=menu-button]]:w-72
            [&_[data-sidebar=menu-button]]:justify-start
            [&_[data-sidebar=menu-button]]:gap-[11px]
            [&_[data-sidebar=menu-button]]:rounded-lg
            [&_[data-sidebar=menu-button]]:px-[17px]
            [&_[data-sidebar=menu-button]]:py-0
            [&_[data-sidebar=menu-button]]:text-base
            [&_[data-sidebar=menu-button]]:font-semibold
            [&_[data-sidebar=menu-button]]:leading-5
            [&_[data-sidebar=menu-button]]:text-neutral-50

            [&_[data-sidebar=menu-button]]:hover:bg-[#18275D]
            [&_[data-sidebar=menu-button]]:hover:text-white
            [&_[data-sidebar=menu-button]>svg]:text-white
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
              w-72
              flex-1
              overflow-x-hidden
              overflow-y-auto
              overscroll-contain
              bg-transparent
              p-0
              [@media(max-height:950px)]:mt-5
            "
          >
            <SidebarGroup className="w-72 p-0">
              <SidebarMenu className="w-72 gap-4 [@media(max-height:950px)]:gap-2">
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
            mt-auto
            w-72
            shrink-0
            bg-transparent
            p-0
          "
        >
          <SidebarGroup className="w-72 p-0">
            <SidebarMenu className="w-72 gap-4 [@media(max-height:950px)]:gap-2">
              {settingsLink ? (
                <SidebarLink
                  currentPath={pathname}
                  {...settingsLink}
                />
              ) : (
                <SidebarStaticItem
                  label={labels.settings}
                  icon={SettingsIcon}
                  iconClassName="h-[19px] w-[18px]"
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
                    [&_[data-sidebar=menu-button]]:px-[18px]
                    [&_[data-sidebar=menu-button]]:py-0
                    [&_[data-sidebar=menu-button]]:text-base
                    [&_[data-sidebar=menu-button]]:font-semibold
                    [&_[data-sidebar=menu-button]]:leading-5
                    [&_[data-sidebar=menu-button]]:text-neutral-50

                    [&_[data-sidebar=menu-button]]:hover:bg-[#18275D]
                    [&_[data-sidebar=menu-button]]:hover:text-white

                    [&_[data-sidebar=menu-button]>svg]:text-white
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
          hover:[&_[data-sidebar-icon]]:text-[#FBFBFB]

          data-[active=true]:bg-[#FBFBFB]
          data-[active=true]:text-[#002BFF]
          data-[active=true]:shadow-[0_4px_4px_0_rgba(0,0,0,0.12)]
          data-[active=true]:[&_[data-sidebar-icon]]:text-[#002BFF]
        "
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          className="flex h-12 w-72 items-center gap-[14px] px-[18px]"
        >
          <span
            data-sidebar-icon
            className={`
              flex
              size-[24px]
              shrink-0
              items-center
              justify-center
              text-neutral-50
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

function SidebarStaticItem({
  label,
  icon: Icon,
  iconClassName = "size-5",
}: {
  label: string;
  icon: ComponentType<SidebarIconProps>;
  iconClassName?: string;
}) {
  return (
    <SidebarMenuItem className="h-12 w-72">
      <div
        aria-disabled="true"
        className="flex h-12 w-72 cursor-not-allowed items-center gap-[14px] rounded-lg px-[18px] text-neutral-50"
      >
        <span className="flex size-[24px] shrink-0 items-center justify-center">
          <Icon className={iconClassName} />
        </span>

        <span className="min-w-0 flex-1 truncate text-base font-semibold leading-5">
          {label}
        </span>
      </div>
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

function ApplicabilityCheckIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 17 18"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.2119 0.0126953C11.3395 0.0382424 11.4583 0.101031 11.5518 0.194336L16.1357 4.77832C16.26 4.90289 16.33 5.0721 16.3301 5.24805V15.665C16.33 16.2832 16.0845 16.8763 15.6475 17.3135C15.2103 17.7507 14.6163 17.997 13.998 17.9971H2.33203C1.96498 17.9971 1.66734 17.699 1.66699 17.332C1.66699 16.9648 1.96476 16.667 2.33203 16.667H13.998C14.2636 16.6669 14.5193 16.5608 14.707 16.373C14.8946 16.1853 14.9999 15.9304 15 15.665V6.33008H10.665C10.2979 6.33008 10.0002 6.03216 10 5.66504V1.33008H3.99805C3.73258 1.33016 3.4778 1.43538 3.29004 1.62305C3.10219 1.8109 2.99707 2.06637 2.99707 2.33203V4.83203C2.99672 5.19879 2.69879 5.49672 2.33203 5.49707C1.96498 5.49707 1.66734 5.199 1.66699 4.83203V2.33203C1.66699 1.71363 1.91234 1.11989 2.34961 0.682617C2.78679 0.245523 3.37984 8.61591e-05 3.99805 0H11.082L11.2119 0.0126953ZM3.16504 7.5C3.58052 7.50004 3.99212 7.58223 4.37598 7.74121C4.75982 7.90026 5.10952 8.13296 5.40332 8.42676C5.69706 8.72059 5.92987 9.07025 6.08887 9.4541C6.24778 9.83795 6.33008 10.2496 6.33008 10.665C6.33004 11.0805 6.24785 11.4921 6.08887 11.876C6.01561 12.0528 5.92564 12.2218 5.82227 12.3818L6.96875 13.5283C7.22796 13.7881 7.22829 14.2092 6.96875 14.4688C6.70921 14.7283 6.28806 14.728 6.02832 14.4688L4.88184 13.3223C4.72184 13.4256 4.5528 13.5156 4.37598 13.5889C3.99212 13.7478 3.58052 13.83 3.16504 13.8301C2.32578 13.8301 1.52028 13.4967 0.926758 12.9033C0.333282 12.3098 8.612e-05 11.5043 0 10.665C0 9.82563 0.333205 9.02031 0.926758 8.42676C1.52031 7.83321 2.32563 7.5 3.16504 7.5ZM3.16504 8.83008C2.67837 8.83008 2.21132 9.02306 1.86719 9.36719C1.52306 9.71132 1.33008 10.1784 1.33008 10.665C1.33016 11.1516 1.52314 11.6188 1.86719 11.9629C2.21129 12.3068 2.67852 12.5 3.16504 12.5C3.40588 12.5 3.64467 12.4525 3.86719 12.3604C4.08976 12.2681 4.29254 12.1332 4.46289 11.9629C4.63324 11.7925 4.76814 11.5898 4.86035 11.3672C4.95251 11.1447 4.99996 10.9059 5 10.665C5 10.4242 4.95244 10.1854 4.86035 9.96289C4.76819 9.7404 4.63313 9.53752 4.46289 9.36719C4.2926 9.19689 4.08967 9.06194 3.86719 8.96973C3.64467 8.87757 3.40588 8.83012 3.16504 8.83008ZM11.3301 5H14.4756L11.3301 1.85449V5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GapAnalysisIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 18 10"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.3321 0C17.6992 0.000176196 17.9972 0.297878 17.9972 0.665039V5.66504C17.9972 6.0322 17.6992 6.3299 17.3321 6.33008C16.9649 6.32997 16.6671 6.03224 16.6671 5.66504V2.27051L10.7188 8.21875C10.4592 8.4783 10.0381 8.47825 9.77842 8.21875L6.08115 4.52148L1.13584 9.46875C0.876132 9.72835 0.454099 9.72842 0.194433 9.46875C-0.0648651 9.20917 -0.0647568 8.78797 0.194433 8.52832L5.61142 3.11133C5.87104 2.85172 6.29213 2.85189 6.55185 3.11133L10.2481 6.80762L15.7257 1.33008H12.3321C11.9649 1.32997 11.6671 1.03224 11.6671 0.665039C11.6671 0.297835 11.9649 0.000105134 12.3321 0H17.3321Z"
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

function SettingsIcon({ className }: SidebarIconProps) {
  return (
    <svg
      viewBox="0 0 17 18"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8.36302 0.665039H7.99636C7.55433 0.665039 7.13041 0.840634 6.81784 1.15319C6.50528 1.46575 6.32969 1.88968 6.32969 2.33171V2.48171C6.32939 2.77398 6.25224 3.06103 6.10597 3.31407C5.95971 3.56711 5.74947 3.77724 5.49636 3.92337L5.13802 4.13171C4.88466 4.27799 4.59725 4.355 4.30469 4.355C4.01213 4.355 3.72472 4.27799 3.47136 4.13171L3.34636 4.06504C2.96391 3.84442 2.50955 3.78458 2.08302 3.89863C1.65649 4.01268 1.29265 4.29132 1.07136 4.67337L0.888022 4.99004C0.667408 5.37248 0.607559 5.82684 0.721612 6.25337C0.835666 6.6799 1.1143 7.04375 1.49636 7.26504L1.62136 7.34837C1.87325 7.4938 2.08271 7.70261 2.2289 7.95406C2.37509 8.20552 2.45293 8.49085 2.45469 8.78171V9.20671C2.45586 9.50039 2.3794 9.78917 2.23306 10.0438C2.08672 10.2984 1.8757 10.5099 1.62136 10.6567L1.49636 10.7317C1.1143 10.953 0.835666 11.3168 0.721612 11.7434C0.607559 12.1699 0.667408 12.6243 0.888022 13.0067L1.07136 13.3234C1.29265 13.7054 1.65649 13.9841 2.08302 14.0981C2.50955 14.2122 2.96391 14.1523 3.34636 13.9317L3.47136 13.865C3.72472 13.7188 4.01213 13.6417 4.30469 13.6417C4.59725 13.6417 4.88466 13.7188 5.13802 13.865L5.49636 14.0734C5.74947 14.2195 5.95971 14.4296 6.10597 14.6827C6.25224 14.9357 6.32939 15.2228 6.32969 15.515V15.665C6.32969 16.1071 6.50528 16.531 6.81784 16.8435C7.13041 17.1561 7.55433 17.3317 7.99636 17.3317H8.36302C8.80505 17.3317 9.22897 17.1561 9.54153 16.8435C9.85409 16.531 10.0297 16.1071 10.0297 15.665V15.515C10.03 15.2228 10.1071 14.9357 10.2534 14.6827C10.3997 14.4296 10.6099 14.2195 10.863 14.0734L11.2214 13.865C11.4747 13.7188 11.7621 13.6417 12.0547 13.6417C12.3473 13.6417 12.6347 13.7188 12.888 13.865L13.013 13.9317C13.3955 14.1523 13.8498 14.2122 14.2764 14.0981C14.7029 13.9841 15.0667 13.7054 15.288 13.3234L15.4714 12.9984C15.692 12.6159 15.7518 12.1616 15.6378 11.735C15.5237 11.3085 15.2451 10.9447 14.863 10.7234L14.738 10.6567C14.4837 10.5099 14.2727 10.2984 14.1263 10.0438C13.98 9.78917 13.9035 9.50039 13.9047 9.20671V8.79004C13.9035 8.49636 13.98 8.20758 14.1263 7.95295C14.2727 7.69832 14.4837 7.48688 14.738 7.34004L14.863 7.26504C15.2451 7.04375 15.5237 6.6799 15.6378 6.25337C15.7518 5.82684 15.692 5.37248 15.4714 4.99004L15.288 4.67337C15.0667 4.29132 14.7029 4.01268 14.2764 3.89863C13.8498 3.78458 13.3955 3.84442 13.013 4.06504L12.888 4.13171C12.6347 4.27799 12.3473 4.355 12.0547 4.355C11.7621 4.355 11.4747 4.27799 11.2214 4.13171L10.863 3.92337C10.6099 3.77724 10.3997 3.56711 10.2534 3.31407C10.1071 3.06103 10.03 2.77398 10.0297 2.48171V2.33171C10.0297 1.88968 9.85409 1.46575 9.54153 1.15319C9.22897 0.840634 8.80505 0.665039 8.36302 0.665039Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8.17969 11.4984C9.5604 11.4984 10.6797 10.3791 10.6797 8.99837C10.6797 7.61766 9.5604 6.49837 8.17969 6.49837C6.79898 6.49837 5.67969 7.61766 5.67969 8.99837C5.67969 10.3791 6.79898 11.4984 8.17969 11.4984Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        fill="white"
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
