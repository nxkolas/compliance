import type { Locale } from "@/src/i18n/config";

export function resolveGapContentTranslation(
  translations: Map<string, Map<string, string>>,
  contentRevisionId: string,
  requestedLocale: Locale,
  defaultLocale: string,
) {
  const values = translations.get(contentRevisionId);
  const value =
    values?.get(requestedLocale) ?? values?.get(defaultLocale);
  if (value === undefined) {
    throw new Error(
      `Published gap release content ${contentRevisionId} has no runtime translation`,
    );
  }
  return value;
}
