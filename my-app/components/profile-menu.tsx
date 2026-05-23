"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary, Locale } from "@/lib/i18n";
import { UserRound } from "lucide-react";
import Link from "next/link";

type ProfileMenuProps = {
  email: string | null;
  locale: Locale;
  labels: {
    common: Dictionary["common"];
    languages: Dictionary["languages"];
    profile: Dictionary["profile"];
  };
};

export function ProfileMenu({ email, locale, labels }: ProfileMenuProps) {
  if (!email) {
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <LanguageSwitcher
          locale={locale}
          label={labels.common.language}
          languageNames={labels.languages}
        />
        <ThemeSwitcher label={labels.profile.darkMode} />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <LogoutButton variant="ghost" className="w-full justify-start">
            {labels.common.logout}
          </LogoutButton>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProfileMenuFallback({
  label = "Loading profile menu",
}: {
  label?: string;
}) {
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
