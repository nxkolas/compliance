import type { Locale } from "@/src/i18n/config";

const localeTags = {
  de: "de-DE",
  en: "en-GB",
} as const satisfies Record<Locale, string>;

export function localeTag(locale: Locale) {
  return localeTags[locale];
}

export function formatDate(
  value: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  },
) {
  return new Intl.DateTimeFormat(localeTag(locale), options).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatDateTime(value: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

export function formatPercent(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string,
) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
  }).format(value);
}

export function localizedFilename(
  localizedStem: string,
  locale: Locale,
  extension: string,
) {
  const safeStem = localizedStem
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLocaleLowerCase(localeTag(locale));
  const safeExtension = extension.replace(/^\./, "").toLowerCase();

  return `${safeStem}-${locale}.${safeExtension}`;
}
