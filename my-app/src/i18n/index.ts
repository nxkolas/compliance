import { cookies } from "next/headers";
import {
  defaultLocale,
  localeCookieName,
  locales,
  type Locale,
} from "@/src/i18n/config";
import { coreMessages } from "@/src/i18n/messages/core";
import { authMessages } from "@/src/i18n/messages/auth";
import { navigationMessages } from "@/src/i18n/messages/navigation";
import { aiMessages } from "@/src/i18n/messages/ai";
import { organizationsMessages } from "@/src/i18n/messages/organizations";
import { assessmentMessages } from "@/src/i18n/messages/assessment";
import { modulesMessages } from "@/src/i18n/messages/modules";
import { guestMessages } from "@/src/i18n/messages/guest";
import { homeMessages } from "@/src/i18n/messages/home";
import { reportsMessages } from "@/src/i18n/messages/reports";
import { tutorialMessages } from "@/src/i18n/messages/tutorial";
import { nis2ReleaseMessages } from "@/src/i18n/messages/nis2-release";
import { legalPagesMessages } from "@/src/i18n/messages/legal-pages";

export { defaultLocale, localeCookieName, locales, type Locale };

const dictionaries = {
  de: {
    ...coreMessages.de,
    ...authMessages.de,
    ...navigationMessages.de,
    ...aiMessages.de,
    ...organizationsMessages.de,
    ...assessmentMessages.de,
    ...modulesMessages.de,
    ...guestMessages.de,
    ...homeMessages.de,
    ...reportsMessages.de,
    ...tutorialMessages.de,
    ...nis2ReleaseMessages.de,
    ...legalPagesMessages.de,
  },
  en: {
    ...coreMessages.en,
    ...authMessages.en,
    ...navigationMessages.en,
    ...aiMessages.en,
    ...organizationsMessages.en,
    ...assessmentMessages.en,
    ...modulesMessages.en,
    ...guestMessages.en,
    ...homeMessages.en,
    ...reportsMessages.en,
    ...tutorialMessages.en,
    ...nis2ReleaseMessages.en,
    ...legalPagesMessages.en,
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(localeCookieName)?.value;

  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary(): Promise<Dictionary> {
  return getDictionaryForLocale(await getLocale());
}

export function getDictionaryForLocale(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function getDefaultDictionary(): Dictionary {
  return getDictionaryForLocale(defaultLocale);
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}
