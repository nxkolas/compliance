import { LanguageButtons } from "@/components/language-switcher";
import { getDictionary, getLocale } from "@/src/i18n";
import { cn } from "@/src/utils";

export async function PublicLanguageSwitcher({
  compactOnMobile = false,
  inline = false,
  className,
}: {
  compactOnMobile?: boolean;
  inline?: boolean;
  className?: string;
}) {
  const [locale, dictionary] = await Promise.all([
    getLocale(),
    getDictionary(),
  ]);

  return (
    <LanguageButtons
      locale={locale}
      languageNames={dictionary.languages}
      ariaLabel={dictionary.common.chooseLanguage}
      compactOnMobile={compactOnMobile}
      className={cn(!inline && "safe-area-top fixed right-4 z-50", className)}
    />
  );
}
