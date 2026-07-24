import { LanguageButtons } from "@/components/language-switcher";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function PublicLanguageSwitcher() {
  const [locale, dictionary] = await Promise.all([
    getLocale(),
    getDictionary(),
  ]);

  return (
    <LanguageButtons
      locale={locale}
      languageNames={dictionary.languages}
      ariaLabel={dictionary.common.chooseLanguage}
      className="fixed right-4 top-4 z-50"
    />
  );
}
