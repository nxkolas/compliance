/**
 * Locale settings shared by server components, middleware, and UI controls.
 */
export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";
export const localeCookieName = "complyx-locale";
