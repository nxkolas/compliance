"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  localeCookieName,
  type Locale,
} from "@/src/i18n/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/src/utils";
import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  getLanguageOptions,
  type LanguageOption,
} from "@/src/i18n/language-options";

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  languageNames: Readonly<Record<Locale, string>>;
  options?: readonly LanguageOption[];
};

type LanguageButtonsProps = Pick<
  LanguageSwitcherProps,
  "locale" | "languageNames"
> & {
  ariaLabel: string;
  className?: string;
  compactOnMobile?: boolean;
};

function useLocaleChange() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return { isPending, setLocale };
}

export function LanguageSwitcher({
  locale,
  label,
  languageNames,
  options,
}: LanguageSwitcherProps) {
  const { setLocale } = useLocaleChange();
  const languageOptions = options ?? getLanguageOptions(locale, languageNames);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="size-4" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option.locale}
            onClick={() => setLocale(option.locale)}
          >
            <span className="min-w-20">{option.label}</span>
            {option.active && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function LanguageButtons({
  locale,
  languageNames,
  ariaLabel,
  className,
  compactOnMobile = false,
}: LanguageButtonsProps) {
  const { isPending, setLocale } = useLocaleChange();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur",
        className,
      )}
      aria-label={ariaLabel}
    >
      {getLanguageOptions(locale, languageNames).map((option) => (
        <Button
          key={option.locale}
          type="button"
          size="sm"
          variant={option.active ? "secondary" : "ghost"}
          aria-pressed={option.active}
          disabled={isPending}
          onClick={() => setLocale(option.locale)}
          className={
            compactOnMobile
              ? "min-w-0 px-2 sm:min-w-20 sm:px-3"
              : "min-w-20"
          }
        >
          {compactOnMobile ? (
            <>
              <span className="sm:hidden">{option.locale.toUpperCase()}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </>
          ) : (
            option.label
          )}
        </Button>
      ))}
    </div>
  );
}
