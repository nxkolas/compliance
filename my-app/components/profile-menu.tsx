"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { Dictionary, Locale } from "@/src/i18n";
import { getLanguageOptions } from "@/src/i18n/language-options";
import { ChevronDown, Inbox, LogOut, UserRound } from "lucide-react";
import Link from "next/link";

type ProfileMenuProps = {
  email: string | null;
  displayName?: string | null;
  locale: Locale;
  variant?: "default" | "sidebar";
  showPreferences?: boolean;
  labels: {
    common: Dictionary["common"];
    languages: Dictionary["languages"];
    profile: Dictionary["profile"];
    sidebar?: Dictionary["sidebar"];
  };
};

export function getProfileMenuLanguageOptions(
  locale: Locale,
  languageNames: Dictionary["languages"],
) {
  return getLanguageOptions(locale, languageNames);
}

export function ProfileMenu({
  email,
  displayName,
  locale,
  labels,
  showPreferences = true,
  variant = "default",
}: ProfileMenuProps) {
  if (!email) {
    if (variant === "sidebar") {
      return (
        <div className="grid gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">{labels.common.signIn}</Link>
          </Button>

          <Button asChild size="sm">
            <Link href="/auth/sign-up">{labels.common.signUp}</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">{labels.common.signIn}</Link>
        </Button>

        <Button asChild size="sm">
          <Link href="/auth/sign-up">{labels.common.signUp}</Link>
        </Button>
      </div>
    );
  }

  const initials = getProfileInitials(displayName, email);

  return (
    <>
      {variant === "sidebar" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={labels.profile.openMenu}
              className="
                h-12
                w-72
                gap-[11px]
                rounded-lg
                px-[17px]
                py-0
                text-base
                font-semibold
                leading-5

                data-[state=open]:bg-sidebar-accent
                data-[state=open]:text-sidebar-accent-foreground
              "
            >
              <span
                className="
                  flex
                  size-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-foreground-subtle/60
                  font-['Space_Grotesk']
                  text-[9px]
                  font-normal
                  uppercase
                  leading-none
                  text-foreground
                "
                aria-hidden="true"
              >
                {initials}
              </span>

              <span className="min-w-0 flex-1 truncate">
                {labels.sidebar?.profile ?? labels.common.account}
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <ProfileMenuContent
            email={email}
            locale={locale}
            labels={labels}
            showPreferences={showPreferences}
            variant="sidebar"
          />
        </DropdownMenu>
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1.5 rounded-lg px-1.5 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:[&_svg]:rotate-180"
              aria-label={labels.profile.openMenu}
            >
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-md bg-primary font-['Space_Grotesk'] text-[9px] font-semibold uppercase leading-none text-primary-foreground"
              >
                {initials}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground transition-transform" />
            </Button>
          </DropdownMenuTrigger>

          <ProfileMenuContent
            email={email}
            locale={locale}
            labels={labels}
            showPreferences={showPreferences}
            variant="default"
          />
        </DropdownMenu>
      )}
    </>
  );
}

function ProfileMenuContent({
  email,
  locale,
  labels,
  showPreferences,
  variant,
}: Pick<ProfileMenuProps, "email" | "locale" | "labels" | "showPreferences"> & {
  variant: "default" | "sidebar";
}) {
  return (
    <DropdownMenuContent
      align={variant === "sidebar" ? "start" : "end"}
      side={variant === "sidebar" ? "right" : "bottom"}
      className="w-56"
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel className="truncate">
          {email}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/tool/inbox">
            <Inbox className="size-4" />
            {labels.sidebar?.inbox ?? labels.common.inbox}
          </Link>
        </DropdownMenuItem>

        {showPreferences ? (
          <>
            <LanguageSwitcher
              locale={locale}
              label={labels.common.language}
              languageNames={labels.languages}
              options={getProfileMenuLanguageOptions(
                locale,
                labels.languages,
              )}
            />

            <ThemeSwitcher label={labels.profile.darkMode} />
          </>
        ) : null}
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuItem asChild>
        <LogoutButton
          variant="ghost"
          className="w-full justify-start"
        >
          <LogOut className="size-4" />
          {labels.common.logout}
        </LogoutButton>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

export function ProfileMenuFallback({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "sidebar";
}) {
  if (variant === "sidebar") {
    return (
      <SidebarMenuButton
        size="lg"
        aria-label={label}
        disabled
        className="
          h-12
          w-72
          gap-[11px]
          rounded-lg
          px-[17px]
          py-0
          text-base
          font-semibold
          leading-5
        "
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground-subtle/60">
          <UserRound className="size-4 text-foreground" />
        </span>

        <span className="min-w-0 flex-1 truncate">
          {label}
        </span>
      </SidebarMenuButton>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 gap-1.5 rounded-lg px-1.5"
      aria-label={label}
      disabled
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <UserRound className="size-3.5" />
      </span>
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

function getProfileInitials(
  displayName: string | null | undefined,
  email: string,
) {
  const cleanedName = displayName?.trim();

  if (cleanedName) {
    const nameParts = cleanedName
      .split(/\s+/)
      .filter(Boolean);

    if (nameParts.length === 1) {
      return nameParts[0].slice(0, 2).toUpperCase();
    }

    const firstInitial =
      nameParts[0]?.charAt(0) ?? "";

    const lastInitial =
      nameParts[nameParts.length - 1]?.charAt(0) ?? "";

    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  const emailName = email.split("@")[0] ?? "";

  const emailParts = emailName
    .split(/[._\-\s]+/)
    .filter(Boolean);

  if (emailParts.length >= 2) {
    const firstInitial =
      emailParts[0]?.charAt(0) ?? "";

    const lastInitial =
      emailParts[emailParts.length - 1]?.charAt(0) ?? "";

    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  return emailName.slice(0, 2).toUpperCase() || "PR";
}
