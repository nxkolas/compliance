"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  localeCookieName,
  locales,
  type Locale,
} from "@/lib/i18n-config";
import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  languageNames: Readonly<Record<Locale, string>>;
};

export function LanguageSwitcher({
  locale,
  label,
  languageNames,
}: LanguageSwitcherProps) {
  const router = useRouter();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="size-4" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {locales.map((availableLocale) => (
          <DropdownMenuItem
            key={availableLocale}
            onClick={() => setLocale(availableLocale)}
          >
            <span className="min-w-20">{languageNames[availableLocale]}</span>
            {locale === availableLocale && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
