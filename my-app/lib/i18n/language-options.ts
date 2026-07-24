import { locales, type Locale } from "@/lib/i18n-config";

export type LanguageOption = {
  locale: Locale;
  label: string;
  active: boolean;
};

export function getLanguageOptions(
  locale: Locale,
  languageNames: Readonly<Record<Locale, string>>,
): LanguageOption[] {
  return locales.map((availableLocale) => ({
    locale: availableLocale,
    label: languageNames[availableLocale],
    active: availableLocale === locale,
  }));
}
