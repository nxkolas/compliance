"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
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
import type { Dictionary, Locale } from "@/lib/i18n";
import { Inbox, LogOut, UserRound } from "lucide-react";
import Link from "next/link";

type ProfileMenuProps = {
  email: string | null;
  locale: Locale;
  variant?: "default" | "sidebar";
  labels: {
    common: Dictionary["common"];
    languages: Dictionary["languages"];
    profile: Dictionary["profile"];
    sidebar?: Dictionary["sidebar"];
  };
};

export function ProfileMenu({
  email,
  locale,
  labels,
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

  return (
    <>
      {variant === "sidebar" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={labels.profile.openMenu}
              className="h-auto gap-3 px-3 pt-[14.5px] pb-[13.5px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserRound className="size-5 shrink-0" />
              <span className="truncate">
                {labels.sidebar?.profile ?? labels.common.account}
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <ProfileMenuContent
            email={email}
            locale={locale}
            labels={labels}
            variant="sidebar"
          />
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label={labels.profile.openMenu}
            >
              <UserRound className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <ProfileMenuContent
            email={email}
            locale={locale}
            labels={labels}
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
  variant,
}: Pick<ProfileMenuProps, "email" | "locale" | "labels"> & {
  variant: "default" | "sidebar";
}) {
  return (
    <DropdownMenuContent
      align={variant === "sidebar" ? "start" : "end"}
      side={variant === "sidebar" ? "right" : "bottom"}
      className="w-56"
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/tool/inbox">
            <Inbox className="size-4" />
            {labels.sidebar?.inbox ?? labels.common.inbox}
          </Link>
        </DropdownMenuItem>
        <LanguageSwitcher
          locale={locale}
          label={labels.common.language}
          languageNames={labels.languages}
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <LogoutButton variant="ghost" className="w-full justify-start">
          <LogOut className="size-4" />
          {labels.common.logout}
        </LogoutButton>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

export function ProfileMenuFallback({
  label = "Loading profile menu",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "sidebar";
}) {
  if (variant === "sidebar") {
    return (
      <SidebarMenuButton
        size="lg"
        aria-label={label}
        disabled
        className="h-auto gap-3 px-3 pt-[14.5px] pb-[13.5px]"
      >
        <UserRound className="size-5 shrink-0" />
        <span>{label}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      aria-label={label}
      disabled
    >
      <UserRound className="h-4 w-4" />
    </Button>
  );
}
