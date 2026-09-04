import { defineFeatureMessages } from "@/src/i18n/define-messages";

export const coreMessages = defineFeatureMessages({
  de: {
    metadata: {
          title: "NIS2 Compliance Checker",
          description:
            "Ein übersichtlicher NIS2-Compliance-Checker für Organisationen.",
        },
    common: {
          account: "Konto",
          assessment: "Bewertung",
          complyx: "complyx",
          inbox: "Postfach",
      language: "Sprache",
      chooseLanguage: "Sprache wählen",
      switchToDarkMode: "Zum dunklen Modus wechseln",
      switchToLightMode: "Zum hellen Modus wechseln",
          loadingProfile: "Profilmenü wird geladen",
          logout: "Abmelden",
          signIn: "Anmelden",
          signedInAs: "Angemeldet als",
          signUp: "Registrieren",
          supabaseMissing: "Supabase-Umgebungsvariablen fehlen.",
          workspace: "Arbeitsbereich",
          loading: "Wird geladen...",
          total: "gesamt",
          open: "Öffnen",
          unknown: "Unbekannt",
          sizeUnknown: "Größe unbekannt",
          employees: "Mitarbeitende",
          withoutDate: "ohne Datum",
          withoutDeadline: "ohne Frist",
        },
    languages: {
          de: "Deutsch",
          en: "English",
        },
    profile: {
          openMenu: "Profilmenü öffnen",
          darkMode: "Dunkler Modus",
        },
  },
  en: {
    metadata: {
          title: "NIS2 Compliance Checker",
          description: "A clear NIS2 compliance checker for organizations.",
        },
    common: {
          account: "Account",
          assessment: "Assessment",
          complyx: "complyx",
          inbox: "Inbox",
      language: "Language",
      chooseLanguage: "Choose language",
      switchToDarkMode: "Switch to dark mode",
      switchToLightMode: "Switch to light mode",
          loadingProfile: "Loading profile menu",
          logout: "Log out",
          signIn: "Sign in",
          signedInAs: "Signed in as",
          signUp: "Sign up",
          supabaseMissing: "Supabase environment variables missing.",
          workspace: "Workspace",
          loading: "Loading...",
          total: "total",
          open: "Open",
          unknown: "Unknown",
          sizeUnknown: "Size unknown",
          employees: "employees",
          withoutDate: "without date",
          withoutDeadline: "without deadline",
        },
    languages: {
          de: "Deutsch",
          en: "English",
        },
    profile: {
          openMenu: "Open profile menu",
          darkMode: "Dark mode",
        },
  }
});
