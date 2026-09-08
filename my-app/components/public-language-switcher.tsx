import { LanguageButtons } from "@/components/language-switcher";
import { ThemeToggleButton } from "@/components/theme-switcher";
import { getDictionary, getLocale } from "@/src/i18n";
import { cn } from "@/src/utils";

export async function PublicLanguageSwitcher({
  showThemeSwitcher = false,
  compactOnMobile = false,
  inline = false,
  className,
}: {
  showThemeSwitcher?: boolean;
  compactOnMobile?: boolean;
  inline?: boolean;
  className?: string;
}) {
  const [locale, dictionary] = await Promise.all([
    getLocale(),
    getDictionary(),
  ]);

  const languageButtons = (
    <LanguageButtons
      locale={locale}
      languageNames={dictionary.languages}
      ariaLabel={dictionary.common.chooseLanguage}
      compactOnMobile={compactOnMobile}
      className={
        showThemeSwitcher
          ? "h-8 gap-1 border-0 bg-transparent p-0 shadow-none backdrop-blur-none [&_[aria-pressed=true]]:bg-[#002BFF] [&_[aria-pressed=true]]:text-white [&_[aria-pressed=true]]:shadow-sm [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:hover:bg-foreground/10"
          : inline
            ? undefined
          : "safe-area-top fixed right-4 z-50"
      }
    />
  );

  if (!showThemeSwitcher) return languageButtons;

  return (
    <div
      data-public-preferences
      className={cn(
        "flex h-10 shrink-0 items-center gap-1 rounded-lg border border-input bg-background p-1 text-foreground shadow-xs dark:bg-input/30",
        !inline && "safe-area-top fixed right-4 z-50",
        className,
      )}
    >
      {languageButtons}
      <span
        aria-hidden="true"
        className="mx-1 h-6 w-px shrink-0 bg-border-strong/70"
      />
      <ThemeToggleButton
        switchToDarkLabel={dictionary.common.switchToDarkMode}
        switchToLightLabel={dictionary.common.switchToLightMode}
        className="size-8 rounded-lg border-0 bg-foreground/[0.06] text-foreground shadow-none hover:bg-foreground/[0.12] hover:text-foreground"
      />
    </div>
  );
}
