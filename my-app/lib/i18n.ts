import { cookies } from "next/headers";
import {
  defaultLocale,
  localeCookieName,
  locales,
  type Locale,
} from "@/lib/i18n-config";

export { defaultLocale, localeCookieName, locales, type Locale };

export type Dictionary = (typeof dictionaries)[Locale];

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(localeCookieName)?.value;

  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary() {
  const locale = await getLocale();

  return dictionaries[locale];
}

export function getDefaultDictionary() {
  return dictionaries[defaultLocale];
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

const dictionaries = {
  de: {
    common: {
      account: "Konto",
      assessment: "Bewertung",
      complyx: "complyx",
      inbox: "Postfach",
      language: "Sprache",
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
    auth: {
      welcomeBack: "Willkommen zurück",
      signInContinue: "Melde dich an, um fortzufahren",
      signUp: "Registrieren",
      email: "E-Mail",
      password: "Passwort",
      keepSignedIn: "Angemeldet bleiben",
      forgotPassword: "Passwort vergessen?",
      signingIn: "Anmelden...",
      noAccount: "Noch kein Konto?",
      repeatPassword: "Passwort wiederholen",
      passwordsDoNotMatch: "Passwörter stimmen nicht überein",
      creatingAccount: "Account wird erstellt...",
      alreadyHaveAccount: "Du hast bereits ein Konto?",
      login: "Anmelden",
      createAccountDescription:
        "Erstelle einen Account für den NIS2 Compliance Checker.",
      checkEmailTitle: "Prüfe dein E-Mail-Postfach",
      resetInstructionsSent: "Anweisungen zum Zurücksetzen gesendet",
      resetEmailSent:
        "Wenn für diese E-Mail ein Account existiert, erhältst du eine E-Mail zum Zurücksetzen des Passworts.",
      resetPasswordTitle: "Passwort zurücksetzen",
      resetPasswordDescription:
        "Gib die E-Mail-Adresse für deinen NIS2 Compliance Checker Account ein.",
      sending: "Wird gesendet...",
      sendResetEmail: "E-Mail senden",
      alreadyHaveAnAccount: "Du hast bereits ein Konto?",
      newPassword: "Neues Passwort",
      newPasswordDescription:
        "Gib ein neues Passwort für deinen NIS2 Compliance Checker Account ein.",
      saving: "Wird gespeichert...",
      saveNewPassword: "Neues Passwort speichern",
      errorFallback: "Ein Fehler ist aufgetreten",
      sorryTitle: "Entschuldigung, etwas ist schiefgelaufen.",
      codeError: "Code-Fehler",
      unspecifiedError: "Ein unbekannter Fehler ist aufgetreten.",
      signupSuccessTitle: "Danke für deine Registrierung!",
      signupSuccessDescription:
        "Prüfe dein E-Mail-Postfach, um deinen Account zu bestätigen.",
      signupSuccessBody:
        "Du hast dich erfolgreich für den NIS2 Compliance Checker registriert. Bitte bestätige deinen Account, bevor du dich anmeldest.",
    },
    languages: {
      de: "Deutsch",
      en: "Englisch",
    },
    sidebar: {
      assessment: "Bewertung",
      assistant: "Assistent",
      general: "Allgemein",
      inbox: "Postfach",
      organizations: "Organisationen",
      overview: "Übersicht",
      questionnaire: "Fragebogen",
      registration: "Registrierung",
      requirements: "Anforderungen",
      result: "Ergebnis",
      riskManagement: "Risikomanagement",
      settings: "Einstellungen",
      suppliers: "Lieferanten",
      team: "Team",
      workspace: "Arbeitsbereich",
    },
    aiAssistant: {
      title: "Assistent",
      assistant: "Assistent",
      you: "Du",
      emptyTitle: "NIS2- oder BSIG-Frage stellen",
      emptyDescription:
        "Der Assistent nutzt Organisationsdaten, hochgeladene Nachweise und kuratierte Referenzen.",
      placeholder: "Frage zu Betroffenheit, Pflichten, Nachweisen oder Massnahmen...",
      retry: "Erneut versuchen",
      stop: "Stoppen",
      sources: "Quellen",
      documents: "Dokumente",
      upload: "Dokument hochladen",
      refresh: "Aktualisieren",
      noDocuments: "Noch keine Dokumente indexiert.",
      processing: "Wird verarbeitet",
      ready: "Bereit",
      failed: "Fehlgeschlagen",
    },
    organizations: {
      createFirst:
        "Erstelle den ersten Arbeitsbereich oder akzeptiere eine Einladung aus deinem Postfach.",
      description:
        "Prüfe alle Organisationen, zu denen du gehörst, und öffne einen Arbeitsbereich.",
      legalNameEmpty: "Kein rechtlicher Name gesetzt",
      loading: "Organisationen werden geladen...",
      newOrganization: "Neue Organisation",
      noOrganization: "Noch keine Organisation",
      openOrganization: "Organisation öffnen",
      selectDescription:
        "Wähle eine Organisation, um NIS2-Bewertungen zu erstellen und zu prüfen.",
      title: "Organisationen",
      total: "gesamt",
      yourOrganizations: "Deine Organisationen",
      pageDescription:
        "Prüfe alle Organisationen, zu denen du gehörst, und öffne einen Arbeitsbereich, um NIS2-Bewertungen zu verwalten.",
      newDescription:
        "Erstelle einen Arbeitsbereich für eine juristische Person und lade danach Teammitglieder ein.",
      loadingForm: "Organisationsformular wird geladen...",
      details: "Organisationsdaten",
      workspaceDescription:
        "Erstelle und prüfe NIS2-Bewertungen für diese Organisation.",
      settingsTitle: "Organisationseinstellungen",
      settingsDescription:
        "Bearbeite Stammdaten, die für diese Organisation verwendet werden.",
      settingsLoading: "Organisationseinstellungen werden geladen...",
      teamTitle: "Team",
      teamDescription:
        "Lade Teammitglieder ein und verwalte offene Einladungen für diese Organisation.",
      teamLoading: "Team wird geladen...",
    },
    organizationForm: {
      createTitle: "Organisation erstellen",
      createDescription:
        "Starte einen Compliance-Arbeitsbereich für eine juristische Person.",
      organizationName: "Organisationsname",
      legalName: "Rechtlicher Name",
      employees: "Mitarbeitende",
      size: "Größe",
      country: "Land",
      createButton: "Organisation erstellen",
      createPending: "Organisation wird erstellt...",
      createError: "Organisation konnte nicht erstellt werden",
      createErrorFallback: "Erstellung der Organisation fehlgeschlagen",
      dataTitle: "Organisationsdaten",
      dataDescription:
        "Aktualisiere das Unternehmensprofil für diesen Arbeitsbereich.",
      saveButton: "Organisation speichern",
      savePending: "Organisation wird gespeichert...",
      saveSuccess: "Organisationseinstellungen gespeichert.",
      updateError: "Organisation konnte nicht aktualisiert werden",
      updateErrorFallback: "Aktualisierung der Organisation fehlgeschlagen",
      sizeOptions: {
        unknown: "Unbekannt",
        micro: "Mikro",
        small: "Klein",
        medium: "Mittel",
        large: "Gross",
      },
    },
    assessment: {
      newTitle: "Neue NIS2-Bewertung",
      newDescription: "Erstelle eine Entwurfsbewertung für",
      loadingForm: "Bewertungsformular wird geladen...",
      createTitle: "NIS2-Bewertung erstellen",
      createDescription:
        "Starte eine neue Entwurfsbewertung für diese Organisation.",
      titleLabel: "Bewertungstitel",
      defaultTitle: "NIS2-Bewertung",
      createButton: "Bewertung erstellen",
      createPending: "Bewertung wird erstellt...",
      createError: "Bewertung konnte nicht erstellt werden",
      createErrorFallback: "Erstellung der Bewertung fehlgeschlagen",
      overviewTitle: "Bewertungsübersicht",
      overviewDescription:
        "Aktuelle NIS2-Betroffenheitsarbeit für diese Organisation.",
      newAssessment: "Neue Bewertung",
      listTitle: "NIS2-Bewertungen",
      listDescription:
        "Prüfe vorherige Durchläufe und fahre mit gespeicherten Entwürfen fort.",
      emptyTitle: "Noch keine Bewertungen",
      emptyDescription:
        "Erstelle den ersten Entwurf, um mit der NIS2-Betroffenheitsarbeit zu beginnen.",
      created: "Erstellt",
      completed: "Abgeschlossen",
      pageTitle: "Bewertung",
      pageDescription:
        "Übersicht für diesen NIS2-Bewertungsentwurf, inklusive Status, Ergebnis und nächsten Schritten.",
      questionnaireTitle: "Bewertungsfragebogen",
      questionnaireDescription:
        "Platzhalter für die spätere Prüfung von Sektor, Unternehmensgröße und Kategorie nach NIS2 beziehungsweise BSIG.",
      resultTitle: "Bewertungsergebnis",
      resultDescription:
        "Bewertungsspezifische NIS2-Klassifizierung, Begründung und Prüfergebnis für diese Organisation.",
      statuses: {
        draft: "Entwurf",
        in_review: "In Prüfung",
        completed: "Abgeschlossen",
        archived: "Archiviert",
      },
    },
    inbox: {
      title: "Einladungspostfach",
      description: "Akzeptiere offene Organisationseinladungen für dein Konto.",
      loading: "Einladungen werden geladen...",
      cardTitle: "Einladungspostfach",
      pendingFor: "Offene Einladungen für",
      yourAccount: "dein Konto",
      pending: "offen",
      empty: "Aktuell warten keine Einladungen.",
      role: "Rolle",
      expires: "Läuft ab",
      accept: "Akzeptieren",
      accepted: "Einladung akzeptiert.",
      acceptError: "Einladung konnte nicht akzeptiert werden",
      acceptErrorFallback: "Annahme der Einladung fehlgeschlagen",
      withoutDeadline: "ohne Frist",
    },
    invite: {
      title: "Teammitglied einladen",
      description: "Sende eine Einladung per E-Mail an diese Organisation.",
      email: "E-Mail",
      role: "Rolle",
      invite: "Einladen",
      historyTitle: "Einladungshistorie",
      historyDescription:
        "Aktuelle Einladungen, die für diese Organisation erstellt wurden.",
      empty: "Es wurden noch keine Einladungen gesendet.",
      expires: "Läuft ab",
      successPrefix: "Einladung für",
      successSuffix: "liegt jetzt im Postfach.",
      createError: "Einladung konnte nicht erstellt werden",
      createErrorFallback: "Erstellung der Einladung fehlgeschlagen",
      withoutDeadline: "ohne Frist",
    },
    modules: {
      dashboardTitle: "Dashboard",
      dashboardDescription:
        "Uebersicht für den NIS2 Compliance Checker. Von hier aus führen die ersten Schritte zur Betroffenheitsprüfung, Requirements-Erfassung, Risikomanagement, Lieferkettenbewertung und Registrierung.",
      requirementsDescription:
        "Platzhalter für Requirements Engineering aus Recherche, Interview-Leitfäden und Unternehmensinterviews.",
      riskManagementDescription:
        "Platzhalter für die Dokumentation technischer und organisatorischer Massnahmen aus den Risikomanagementbereichen des BSIG.",
      suppliersDescription:
        "Platzhalter für Supply-Chain-Risk-Mapping und die spätere Erfassung direkter Zulieferer und Dienstleister.",
      registrationDescription:
        "Platzhalter für den zweistufigen Registrierungsprozess mit MUK/ELSTER-Organisationskonto und BSI-Portal.",
    },
    profile: {
      openMenu: "Profilmenü öffnen",
      darkMode: "Dunkler Modus",
    },
    home: {
      brand: "NIS2 Compliance Checker",
      eyebrow: "Compliance-Workflow für die NIS2-Vorbereitung",
      heroDescription:
        "Strukturieren Sie Betroffenheitsprüfung, Anforderungen, Risikomanagement, Lieferkettenbewertung und Registrierung in einem klaren Produktfluss.",
      dashboardCta: "Zum Arbeitsbereich",
      selfCheckCta: "Self-check starten",
      statusTitle: "Compliance-Status",
      statusSubtitle: "Arbeitsbereiche und nächste Schritte",
      active: "Aktiv",
      modulesTitle: "Produktmodule",
      modulesDescription:
        "Die Bereiche, die den Compliance-Prozess vom ersten Check bis zur Registrierung abbilden.",
      createAccount: "Account erstellen",
      metrics: {
        modules: "Produktbereiche",
        workflow: "zentraler Workflow",
        focus: "Fokus",
      },
      productLinks: [
        {
          label: "Self-check",
          description:
            "Prüfen Sie Betroffenheit, Sektor und Unternehmensgröße für NIS2.",
          tag: "Start",
        },
        {
          label: "Requirements",
          description:
            "Sammeln Sie Anforderungen aus Recherche, Interviews und Nachweisen.",
          tag: "Analyse",
        },
        {
          label: "Risk management",
          description:
            "Dokumentieren Sie Massnahmen für Governance, Technik und Organisation.",
          tag: "Kontrolle",
        },
        {
          label: "Suppliers",
          description:
            "Bewerten Sie Zulieferer, Dienstleister und Risiken in der Lieferkette.",
          tag: "Supply chain",
        },
        {
          label: "Registration",
          description:
            "Bereiten Sie den Registrierungsprozess bei MUK/ELSTER und BSI vor.",
          tag: "Meldung",
        },
        {
          label: "Dashboard",
          description:
            "Behalten Sie Status, offene Aufgaben und nächste Schritte im Blick.",
          tag: "Überblick",
        },
      ],
    },
  },
  en: {
    common: {
      account: "Account",
      assessment: "Assessment",
      complyx: "complyx",
      inbox: "Inbox",
      language: "Language",
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
    auth: {
      welcomeBack: "Welcome back",
      signInContinue: "Sign in to continue",
      signUp: "Sign up",
      email: "Email",
      password: "Password",
      keepSignedIn: "Keep me signed in",
      forgotPassword: "Forgot password?",
      signingIn: "Signing in...",
      noAccount: "No account yet?",
      repeatPassword: "Repeat password",
      passwordsDoNotMatch: "Passwords do not match",
      creatingAccount: "Creating an account...",
      alreadyHaveAccount: "Already have a checker account?",
      login: "Login",
      createAccountDescription:
        "Create an account for the NIS2 Compliance Checker.",
      checkEmailTitle: "Check your email",
      resetInstructionsSent: "Password reset instructions sent",
      resetEmailSent:
        "If a checker account exists for this email, you will receive a password reset email.",
      resetPasswordTitle: "Reset your password",
      resetPasswordDescription:
        "Enter the email for your NIS2 Compliance Checker account.",
      sending: "Sending...",
      sendResetEmail: "Send reset email",
      alreadyHaveAnAccount: "Already have an account?",
      newPassword: "New password",
      newPasswordDescription:
        "Enter a new password for your NIS2 Compliance Checker account.",
      saving: "Saving...",
      saveNewPassword: "Save new password",
      errorFallback: "An error occurred",
      sorryTitle: "Sorry, something went wrong.",
      codeError: "Code error",
      unspecifiedError: "An unspecified error occurred.",
      signupSuccessTitle: "Thank you for signing up!",
      signupSuccessDescription:
        "Check your email to confirm your checker account.",
      signupSuccessBody:
        "You've successfully signed up for the NIS2 Compliance Checker. Please confirm your account before signing in.",
    },
    languages: {
      de: "German",
      en: "English",
    },
    sidebar: {
      assessment: "Assessment",
      assistant: "Assistant",
      general: "General",
      inbox: "Inbox",
      organizations: "Organizations",
      overview: "Overview",
      questionnaire: "Questionnaire",
      registration: "Registration",
      requirements: "Requirements",
      result: "Result",
      riskManagement: "Risk management",
      settings: "Settings",
      suppliers: "Suppliers",
      team: "Team",
      workspace: "Workspace",
    },
    aiAssistant: {
      title: "Assistant",
      assistant: "Assistant",
      you: "You",
      emptyTitle: "Ask a NIS2 or BSIG question",
      emptyDescription:
        "The assistant uses organization data, uploaded evidence, and curated references.",
      placeholder: "Ask about scope, duties, evidence, or measures...",
      retry: "Retry",
      stop: "Stop",
      sources: "Sources",
      documents: "Documents",
      upload: "Upload document",
      refresh: "Refresh",
      noDocuments: "No indexed documents yet.",
      processing: "Processing",
      ready: "Ready",
      failed: "Failed",
    },
    organizations: {
      createFirst:
        "Create the first workspace or accept an invitation from your inbox.",
      description:
        "Review every organization you belong to and open a workspace.",
      legalNameEmpty: "No legal name set",
      loading: "Loading your organizations...",
      newOrganization: "New organization",
      noOrganization: "No organization yet",
      openOrganization: "Open organization",
      selectDescription:
        "Select an organization to create and review NIS2 assessments.",
      title: "Organizations",
      total: "total",
      yourOrganizations: "Your organizations",
      pageDescription:
        "Review every organization you belong to and open a workspace to manage NIS2 assessments.",
      newDescription:
        "Create a workspace for a legal entity, then invite teammates from the organization page.",
      loadingForm: "Loading organization form...",
      details: "Organization details",
      workspaceDescription:
        "Create and review NIS2 assessments for this organization.",
      settingsTitle: "Organization settings",
      settingsDescription:
        "Edit the master data used for this organization.",
      settingsLoading: "Loading organization settings...",
      teamTitle: "Team",
      teamDescription:
        "Invite teammates and manage pending invitations for this organization.",
      teamLoading: "Loading team...",
    },
    organizationForm: {
      createTitle: "Create organization",
      createDescription:
        "Start a compliance workspace for one legal entity.",
      organizationName: "Organization name",
      legalName: "Legal name",
      employees: "Employees",
      size: "Size",
      country: "Country",
      createButton: "Create organization",
      createPending: "Creating organization...",
      createError: "Organization could not be created",
      createErrorFallback: "Organization creation failed",
      dataTitle: "Organization data",
      dataDescription:
        "Update the company profile used across this workspace.",
      saveButton: "Save organization",
      savePending: "Saving organization...",
      saveSuccess: "Organization settings saved.",
      updateError: "Organization could not be updated",
      updateErrorFallback: "Organization update failed",
      sizeOptions: {
        unknown: "Unknown",
        micro: "Micro",
        small: "Small",
        medium: "Medium",
        large: "Large",
      },
    },
    assessment: {
      newTitle: "New NIS2 assessment",
      newDescription: "Create a draft assessment for",
      loadingForm: "Loading assessment form...",
      createTitle: "Create NIS2 assessment",
      createDescription:
        "Start a new draft assessment for this organization.",
      titleLabel: "Assessment title",
      defaultTitle: "NIS2 assessment",
      createButton: "Create assessment",
      createPending: "Creating assessment...",
      createError: "Assessment could not be created",
      createErrorFallback: "Assessment creation failed",
      overviewTitle: "Assessment overview",
      overviewDescription:
        "Current NIS2 applicability work for this organization.",
      newAssessment: "New assessment",
      listTitle: "NIS2 assessments",
      listDescription:
        "Review previous runs and continue from saved drafts.",
      emptyTitle: "No assessments yet",
      emptyDescription:
        "Create the first draft to begin NIS2 applicability work.",
      created: "Created",
      completed: "Completed",
      pageTitle: "Assessment",
      pageDescription:
        "Overview for this NIS2 assessment draft, including status, result, and next steps.",
      questionnaireTitle: "Assessment questionnaire",
      questionnaireDescription:
        "Placeholder for the later review of sector, company size, and category under NIS2 or BSIG.",
      resultTitle: "Assessment result",
      resultDescription:
        "Assessment-specific NIS2 classification, reasoning, and review output for this organization.",
      statuses: {
        draft: "Draft",
        in_review: "In review",
        completed: "Completed",
        archived: "Archived",
      },
    },
    inbox: {
      title: "Invitation inbox",
      description: "Accept pending organization invitations for your account.",
      loading: "Loading invitations...",
      cardTitle: "Invitation inbox",
      pendingFor: "Pending invitations for",
      yourAccount: "your account",
      pending: "pending",
      empty: "No invitations waiting right now.",
      role: "Role",
      expires: "Expires",
      accept: "Accept",
      accepted: "Invitation accepted.",
      acceptError: "Invitation could not be accepted",
      acceptErrorFallback: "Invitation acceptance failed",
      withoutDeadline: "without deadline",
    },
    invite: {
      title: "Invite teammate",
      description: "Send an invitation to this organization by email.",
      email: "Email",
      role: "Role",
      invite: "Invite",
      historyTitle: "Invitation history",
      historyDescription:
        "Recent invitations created for this organization.",
      empty: "No invitations have been sent yet.",
      expires: "Expires",
      successPrefix: "Invitation for",
      successSuffix: "is now in their inbox.",
      createError: "Invitation could not be created",
      createErrorFallback: "Invitation creation failed",
      withoutDeadline: "without deadline",
    },
    modules: {
      dashboardTitle: "Dashboard",
      dashboardDescription:
        "Overview for the NIS2 Compliance Checker. From here, the first steps lead to scope checks, requirements collection, risk management, supplier review, and registration.",
      requirementsDescription:
        "Placeholder for requirements engineering from research, interview guides, and company interviews.",
      riskManagementDescription:
        "Placeholder for documenting technical and organizational measures from the BSIG risk management areas.",
      suppliersDescription:
        "Placeholder for supply-chain risk mapping and the later capture of direct suppliers and service providers.",
      registrationDescription:
        "Placeholder for the two-step registration process with the MUK/ELSTER organization account and the BSI portal.",
    },
    profile: {
      openMenu: "Open profile menu",
      darkMode: "Dark mode",
    },
    home: {
      brand: "NIS2 Compliance Checker",
      eyebrow: "Compliance workflow for NIS2 preparation",
      heroDescription:
        "Structure scope checks, requirements, risk management, supplier review, and registration in one clear product flow.",
      dashboardCta: "Open workspace",
      selfCheckCta: "Start self-check",
      statusTitle: "Compliance status",
      statusSubtitle: "Workspaces and next steps",
      active: "Active",
      modulesTitle: "Product modules",
      modulesDescription:
        "The areas that cover the compliance process from first check to registration.",
      createAccount: "Create account",
      metrics: {
        modules: "Product areas",
        workflow: "central workflow",
        focus: "Focus",
      },
      productLinks: [
        {
          label: "Self-check",
          description:
            "Check scope, sector, and company size for NIS2.",
          tag: "Start",
        },
        {
          label: "Requirements",
          description:
            "Collect requirements from research, interviews, and evidence.",
          tag: "Analysis",
        },
        {
          label: "Risk management",
          description:
            "Document measures for governance, technology, and organization.",
          tag: "Control",
        },
        {
          label: "Suppliers",
          description:
            "Assess suppliers, service providers, and supply-chain risks.",
          tag: "Supply chain",
        },
        {
          label: "Registration",
          description:
            "Prepare the registration process with MUK/ELSTER and the BSI portal.",
          tag: "Reporting",
        },
        {
          label: "Dashboard",
          description:
            "Keep status, open tasks, and next steps in view.",
          tag: "Overview",
        },
      ],
    },
  },
} as const;
