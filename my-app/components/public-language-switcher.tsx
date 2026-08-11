import { LanguageButtons } from "@/components/language-switcher";
import { ThemeToggleButton } from "@/components/theme-switcher";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function PublicLanguageSwitcher({
  showThemeSwitcher = false,
}: {
  showThemeSwitcher?: boolean;
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
      className={showThemeSwitcher ? undefined : "fixed right-4 top-4 z-50"}
    />
  );

  if (!showThemeSwitcher) return languageButtons;

  return (
    <div className="fixed right-4 top-14 z-50 flex -translate-y-1/2 items-center gap-2">
      {languageButtons}
      <ThemeToggleButton
        switchToDarkLabel={dictionary.common.switchToDarkMode}
        switchToLightLabel={dictionary.common.switchToLightMode}
      />
    </div>
  );
}
