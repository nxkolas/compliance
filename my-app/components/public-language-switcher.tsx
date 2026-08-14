import { LanguageButtons } from "@/components/language-switcher";
import { ThemeToggleButton } from "@/components/theme-switcher";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function PublicLanguageSwitcher({
  showThemeSwitcher = false,
  compactOnMobile = false,
}: {
  showThemeSwitcher?: boolean;
  compactOnMobile?: boolean;
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
          ? undefined
          : "safe-area-top fixed right-4 top-0 z-50"
      }
    />
  );

  if (!showThemeSwitcher) return languageButtons;

  return (
    <div className="safe-area-top fixed right-4 top-0 z-50 flex items-center gap-2">
      {languageButtons}
      <ThemeToggleButton
        switchToDarkLabel={dictionary.common.switchToDarkMode}
        switchToLightLabel={dictionary.common.switchToLightMode}
      />
    </div>
  );
}
