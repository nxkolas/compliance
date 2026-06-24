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
      signInDescription: "Melden Sie sich an, um fortzufahren.",
      createAccountTitle: "Konto erstellen",
      createAccountSubtitle: "Erstellen Sie Ihr Konto, um zu beginnen.",
      name: "Name",
      namePlaceholder: "Max Mustermann",
      emailPlaceholder: "ihre@email.com",
      passwordPlaceholder: "Min. 10 Zeichen, mind. 1 Zahl",
      passwordRequirements:
        "Das Passwort muss mindestens 10 Zeichen und eine Zahl enthalten.",
      confirmPassword: "Passwort bestätigen",
      acceptTermsPrefix: "Ich akzeptiere die",
      terms: "Nutzungsbedingungen",
      termsConnector: "und die",
      privacyPolicy: "Datenschutzerklärung",
      termsRequired: "Bitte akzeptieren Sie die Nutzungsbedingungen.",
      showPassword: "Passwort anzeigen",
      hidePassword: "Passwort ausblenden",
      backgroundAlt: "Hintergrund",
    },
    languages: {
      de: "Deutsch",
      en: "Englisch",
    },
    sidebar: {
      actionPlan: "Maßnahmenplan",
      applicabilityCheck: "Betroffenheitscheck",
      assessment: "Bewertung",
      assistant: "Assistent",
      experimental: "Experimentell",
      dashboard: "Dashboard",
      documentReview: "Dokumentenprüfung",
      gapAnalysis: "Gap-Analyse",
      general: "Allgemein",
      helpGlossary: "Hilfe & Glossar",
      inbox: "Postfach",
      organizations: "Organisationen",
      overview: "Übersicht",
      pdfExport: "PDF-Export",
      profile: "Profil",
      questionnaire: "Fragebogen",
      registration: "Registrierung",
      requirements: "Anforderungen",
      result: "Ergebnis",
      riskManagement: "Risikomanagement",
      settings: "Einstellungen",
      suppliers: "Lieferanten",
      team: "Team",
      startTutorial: "NIS2-Tutorial starten",
      workspace: "Arbeitsbereich",
    },
    aiAssistant: {
      title: "Assistent",
      assistant: "Assistent",
      you: "Du",
      chats: "Chats",
      newChat: "Neuer Chat",
      noChats: "Noch keine Chats.",
      emptyTitle: "NIS2- oder BSIG-Frage stellen",
      emptyDescription:
        "Der Assistent nutzt Organisationsdaten und optional angehÃ¤ngte Dokumente in diesem Chat.",
      placeholder: "Frage zu Betroffenheit, Pflichten, Nachweisen oder Massnahmen...",
      attach: "Dokument anhÃ¤ngen",
      attachments: "AnhÃ¤nge",
      removeAttachment: "Anhang entfernen",
      uploadedFileMessage: "Bitte analysiere die angehÃ¤ngten Dokumente",
      uploading: "Dokumente werden hochgeladen",
      retry: "Erneut versuchen",
      stop: "Stoppen",
      provider: "KI-Anbieter",
      mode: "Assistentenmodus",
      modes: {
        general_compliance_qa: "Allgemeine Compliance-Frage",
        nis2_gap_analysis: "NIS2-Gap-Analyse",
        bsig_gap_analysis: "BSIG-Gap-Analyse",
        document_review: "Dokumentenprüfung",
        policy_drafting: "Policy-Entwurf",
        evidence_mapping: "Nachweis-Mapping",
        audit_preparation: "Audit-Vorbereitung",
        implementation_checklist: "Umsetzungscheckliste",
      },
      providers: {
        companyHosted: "Complyx gehostet",
        openai: "OpenAI",
        selfHosted: "Self-hosted",
      },
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
    organizationSettings: {
      accountTitle: "Benutzerkonto",
      accountItems: ["E-Mail-Adresse", "Passwort", "Account-Sicherheit"],
      languageTitle: "Sprache",
      languageItems: ["Deutsch", "Englisch", "Persönliche Präferenz"],
      notificationsTitle: "Benachrichtigungen",
      notificationItems: ["Offene Maßnahmen", "Dokumentenstatus", "Fristen"],
      privacyTitle: "Datenschutz",
      privacyItems: [
        "Datenaufbewahrung",
        "Dokumentenverarbeitung",
        "Organisationsrichtlinien",
      ],
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
      dashboard: {
        title: "NIS2 COMPLIANCE DASHBOARD",
        description:
          "Übersicht über Ihren aktuellen NIS2-Compliance-Status, dringende nächste Schritte sowie den Fortschritt Ihrer laufenden Analysen auf einen Blick.",
        metrics: [
          { label: "Betroffenheitsstatus", value: "Offen" },
          { label: "Analysefortschritt", value: "0%" },
          { label: "Nächste Schritte", value: "Noch nicht erstellt" },
        ],
      },
      applicabilityCheck: {
        title: "Betroffenheitscheck",
        description:
          "Prüfen Sie, ob Ihr Unternehmen unter die NIS2-Richtlinie fällt.",
        metrics: [
          { label: "Ergebnisoptionen", value: "3" },
          { label: "Eingabebereiche", value: "4" },
          { label: "Erklärung", value: "Kurzbegründung" },
        ],
      },
      actionPlan: {
        title: "Maßnahmenplan",
        description:
          "Setzen Sie offene Anforderungen gezielt um: Hier finden Sie Ihre priorisierte Aufgabenliste mit konkreten To-Dos, Status-Tracking und Zuständigkeiten.",
        metrics: [
          { label: "Aufgabentyp", value: "Priorisiert" },
          { label: "Status", value: "Nachverfolgbar" },
          { label: "Fortschritt", value: "Pro Aufgabe" },
        ],
      },
      gapAnalysis: {
        title: "Gap-Analyse",
        description:
          "Identifizieren Sie Sicherheitslücken durch unseren gezielten Fragebogen zu Kernbereichen wie Backup, Incident Response und Zugriffskontrolle, um Ihren Handlungsbedarf zu ermitteln.",
        metrics: [
          { label: "Fragebogenbereiche", value: "7" },
          { label: "Ergebnisstufen", value: "3" },
          { label: "Maßnahmen", value: "Priorisiert" },
        ],
      },
      helpGlossary: {
        title: "Hilfe & Glossar",
        description:
          "Hilfe, Glossar, FAQ und Tooltips bleiben statische Inhalte ohne Datenbankinteraktion.",
        metrics: [
          { label: "Datenbank", value: "Keine" },
          { label: "Inhalt", value: "Statisch" },
          { label: "Nutzung", value: "Erklärungen" },
        ],
      },
      pdfExport: {
        title: "PDF-Export",
        description:
          "Generieren und exportieren Sie Ihren offiziellen Statusbericht mit allen kritischen Bereichen und Maßnahmen als druckoptimiertes PDF für die Geschäftsführung und externe Prüfer.",
        metrics: [
          { label: "Zielgruppen", value: "3" },
          { label: "Berichtsbereiche", value: "5" },
          { label: "Historie", value: "Vorgesehen" },
        ],
      },
      documentReview: {
        title: "Dokumentenprüfung",
        description:
          "Laden Sie Ihre Sicherheitskonzepte und Richtlinien hoch. Unsere KI prüft diese automatisch auf Vollständigkeit und Konformität mit den NIS2-Anforderungen.",
        metrics: [
          { label: "Upload-Arten", value: "4" },
          { label: "Prüfstatus", value: "3" },
          { label: "Beispiele", value: "4" },
        ],
        cards: [
          {
            title: "Upload von",
            description: "Dokumente, die für die KI-Prüfung vorgesehen sind.",
            items: [
              "Richtlinien",
              "Policies",
              "Sicherheitskonzepte",
              "Notfallpläne",
            ],
          },
          {
            title: "KI erkennt",
            description:
              "Die spätere Analyse ordnet jedes erwartete Dokument ein.",
            items: ["Vorhanden", "Unvollständig", "Nicht gefunden"],
          },
          {
            title: "Beispiele",
            description: "Typische Dokumente im NIS2-Kontext.",
            items: [
              "Passwort-Richtlinie",
              "MFA-Richtlinie",
              "Incident-Response-Dokument",
              "Backup-Konzept",
            ],
          },
          {
            title: "Folgeaufgaben",
            description:
              "Fehlende oder unvollständige Inhalte werden später in den Maßnahmenplan übertragen.",
            items: [
              "Fehlendes Dokument erstellen",
              "Unvollständige Policy überarbeiten",
              "Nachweis einem Sicherheitsbereich zuordnen",
            ],
          },
        ],
      },
      requirementsDescription:
        "Platzhalter für Requirements Engineering aus Recherche, Interview-Leitfäden und Unternehmensinterviews.",
      riskManagementDescription:
        "Platzhalter für die Dokumentation technischer und organisatorischer Massnahmen aus den Risikomanagementbereichen des BSIG.",
      suppliersDescription:
        "Platzhalter für Supply-Chain-Risk-Mapping und die spätere Erfassung direkter Zulieferer und Dienstleister.",
      registrationDescription:
        "Platzhalter für den zweistufigen Registrierungsprozess mit MUK/ELSTER-Organisationskonto und BSI-Portal.",
    },
    guestCheck: {
      shell: {
        noAccount: "Ohne Konto",
      },
      start: {
        title: "NIS2 Schnellcheck",
        description:
          "Beantworten Sie sechs kurze Fragen und erhalten Sie eine erste, unverbindliche Einschätzung. Ein Konto ist dafür nicht erforderlich.",
        companyName: "Unternehmensname",
        companyNamePlaceholder: "Beispiel GmbH",
        retentionNotice:
          "Ihre Eingaben werden für 30 Tage in diesem Browser gespeichert.",
        anonymousAuthDisabled:
          "Anonyme Anmeldungen sind für dieses Supabase-Projekt noch nicht aktiviert.",
        anonymousAuthInstructions:
          "Aktivieren Sie in Supabase unter Authentication → Providers → Anonymous Sign-Ins die Option „Allow anonymous sign-ins“.",
        openAuthSettings: "Auth-Einstellungen öffnen",
        start: "Schnellcheck starten",
        starting: "Schnellcheck wird gestartet...",
        startFailed: "Der Schnellcheck konnte nicht gestartet werden.",
      },
      questionnaire: {
        title: "Ihre Unternehmensangaben",
        description:
          "Ihre Antworten werden automatisch gespeichert. Sie können den Schnellcheck in diesem Browser später fortsetzen.",
        loading: "Fragebogen wird geladen...",
        notFound: "Schnellcheck nicht gefunden.",
        loadFailed: "Fragebogen konnte nicht geladen werden.",
        saveFailed: "Antwort konnte nicht gespeichert werden.",
        evaluationFailed: "Ergebnis konnte nicht berechnet werden.",
        notesPlaceholder: "Optionale Anmerkungen",
        showResult: "Ergebnis anzeigen",
        recalculateResult: "Ergebnis neu berechnen",
        backToPreviousResult: "Zurück zum vorherigen Ergebnis",
        calculating: "Ergebnis wird berechnet...",
        disclaimer:
          "Der Schnellcheck ist eine unverbindliche Erstorientierung und ersetzt keine rechtliche Beratung.",
        sectionTitle: "Unternehmensangaben",
        sectionDescription: "Sechs kurze Fragen für eine erste Orientierung.",
        questions: {
          country: {
            prompt: "In welchem Land ist Ihr Unternehmen niedergelassen?",
            helpText:
              "Dieser Schnellcheck ist auf Deutschland und die EU ausgerichtet.",
            options: {
              DE: "Deutschland",
              EU: "Anderer EU-Mitgliedstaat",
              OTHER: "Außerhalb der EU",
            },
          },
          covered_sector: {
            prompt: "Ist Ihr Unternehmen in einem von NIS2 erfassten Sektor tätig?",
            helpText:
              "Dazu zählen unter anderem Energie, Verkehr, Gesundheit, digitale Infrastruktur und bestimmte produzierende Branchen.",
            options: { yes: "Ja", no: "Nein", unsure: "Unsicher" },
          },
          medium_threshold: {
            prompt:
              "Erreicht Ihr Unternehmen mindestens die Schwelle eines mittleren Unternehmens?",
            helpText:
              "Als Orientierung: mindestens 50 Beschäftigte oder mehr als 10 Mio. EUR Jahresumsatz und Bilanzsumme.",
            options: { yes: "Ja", no: "Nein", unsure: "Unsicher" },
          },
          special_entity: {
            prompt:
              "Gehört Ihr Unternehmen zu einer größenunabhängig erfassten Sonderkategorie?",
            helpText:
              "Beispiele können bestimmte Vertrauensdienste, DNS-Dienste oder besonders kritische Einrichtungen sein.",
            options: { yes: "Ja", no: "Nein", unsure: "Unsicher" },
          },
          lex_specialis: {
            prompt:
              "Könnte eine sektorspezifische Regelung wie DORA vorrangig gelten?",
            helpText:
              "Eine vorrangige Spezialregelung erfordert eine individuelle rechtliche Prüfung.",
            options: { yes: "Ja", no: "Nein", unsure: "Unsicher" },
          },
          notes: {
            prompt: "Möchten Sie ergänzende Angaben machen?",
            helpText:
              "Optional. Tragen Sie hier Besonderheiten oder offene Fragen ein.",
            options: {},
          },
        },
      },
      result: {
        title: "Ihre erste Einschätzung",
        description:
          "Sie können das Ergebnis jetzt exportieren, löschen oder durch ein Konto dauerhaft sichern.",
        loading: "Ergebnis wird geladen...",
        notFound: "Ergebnis nicht gefunden.",
        loadFailed: "Ergebnis konnte nicht geladen werden.",
        confirmDelete: "Möchten Sie dieses Ergebnis endgültig löschen?",
        deleteFailed: "Ergebnis konnte nicht gelöscht werden.",
        disclaimer:
          "Diese Einschätzung ist eine unverbindliche Erstorientierung und keine Rechtsberatung. Für eine abschließende Bewertung müssen Ihre konkreten Tätigkeiten und Unternehmensdaten geprüft werden.",
        createAccount: "Konto erstellen und Ergebnis sichern",
        claim: "Mit bestehendem Konto übernehmen",
        backToAnswers: "Zurück zu den Antworten",
        downloadPdf: "PDF herunterladen",
        delete: "Ergebnis löschen",
        deleting: "Wird gelöscht...",
        presentations: {
          affected: "Voraussichtlich betroffen",
          notAffected: "Aktuell nicht erkennbar betroffen",
          possiblyAffected: "Individuelle Prüfung erforderlich",
        },
        details: {
          important: {
            summary: "Ihr Unternehmen ist voraussichtlich von NIS2 betroffen.",
            reasoning:
              "Die Angaben sprechen für einen erfassten Sektor und das Erreichen der maßgeblichen Größenschwelle.",
          },
          specialCase: {
            summary:
              "Ihr Unternehmen könnte unabhängig von seiner Größe erfasst sein.",
            reasoning:
              "Die angegebene Sonderkategorie kann zu einer größenunabhängigen NIS2-Betroffenheit führen.",
          },
          notAffected: {
            summary:
              "Nach Ihren Angaben besteht aktuell keine erkennbare NIS2-Betroffenheit.",
            reasoning:
              "Weder ein erfasster Sektor noch eine größenunabhängige Sonderkategorie wurde angegeben.",
          },
          unknown: {
            summary: "Eine individuelle Prüfung ist erforderlich.",
            reasoning:
              "Die Kombination Ihrer Angaben sollte individuell geprüft werden.",
          },
        },
      },
      finalizer: {
        title: "Konto wird erstellt",
        description: "Ihr Schnellcheck wird jetzt mit dem Konto verknüpft.",
        claimFailed: "Der Schnellcheck konnte nicht übernommen werden.",
        signIn: "Mit bestehendem Konto anmelden",
        claiming: "Ergebnis wird übernommen...",
        backgroundAlt: "Hintergrund",
      },
      pdf: {
        title: "Ergebnis Ihres NIS2 Schnellchecks",
        subject: "Unverbindliche NIS2-Erstorientierung",
        createdOn: "Erstellt am",
        assessment: "EINSCHÄTZUNG",
        answers: "Ihre Angaben",
        noAnswer: "—",
        disclaimer:
          "Dieser Schnellcheck dient ausschließlich der unverbindlichen Erstorientierung und ist keine Rechtsberatung. Eine abschließende Bewertung erfordert die Prüfung Ihrer konkreten Umstände.",
        fileName: "nis2-schnellcheck",
      },
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
      signInDescription: "Sign in to continue.",
      createAccountTitle: "Create account",
      createAccountSubtitle: "Create your account to get started.",
      name: "Name",
      namePlaceholder: "Jane Smith",
      emailPlaceholder: "you@example.com",
      passwordPlaceholder: "Min. 10 characters, including 1 number",
      passwordRequirements:
        "The password must contain at least 10 characters and one number.",
      confirmPassword: "Confirm password",
      acceptTermsPrefix: "I accept the",
      terms: "Terms of use",
      termsConnector: "and the",
      privacyPolicy: "Privacy policy",
      termsRequired: "Please accept the terms of use.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      backgroundAlt: "Background",
    },
    languages: {
      de: "German",
      en: "English",
    },
    sidebar: {
      actionPlan: "Action plan",
      applicabilityCheck: "Applicability check",
      assessment: "Assessment",
      assistant: "Assistant",
      experimental: "Experimental",
      dashboard: "Dashboard",
      documentReview: "Document review",
      gapAnalysis: "Gap analysis",
      general: "General",
      helpGlossary: "Help & glossary",
      inbox: "Inbox",
      organizations: "Organizations",
      overview: "Overview",
      pdfExport: "PDF export",
      profile: "Profile",
      questionnaire: "Questionnaire",
      registration: "Registration",
      requirements: "Requirements",
      result: "Result",
      riskManagement: "Risk management",
      settings: "Settings",
      suppliers: "Suppliers",
      team: "Team",
      startTutorial: "Start NIS2 tutorial",
      workspace: "Workspace",
    },
    aiAssistant: {
      title: "Assistant",
      assistant: "Assistant",
      you: "You",
      chats: "Chats",
      newChat: "New chat",
      noChats: "No chats yet.",
      emptyTitle: "Ask a NIS2 or BSIG question",
      emptyDescription:
        "The assistant uses organization data and optional documents attached in this chat.",
      placeholder: "Ask about scope, duties, evidence, or measures...",
      attach: "Attach document",
      attachments: "Attachments",
      removeAttachment: "Remove attachment",
      uploadedFileMessage: "Please analyze the attached documents",
      uploading: "Uploading documents",
      retry: "Retry",
      stop: "Stop",
      provider: "AI provider",
      mode: "Assistant mode",
      modes: {
        general_compliance_qa: "General compliance Q&A",
        nis2_gap_analysis: "NIS2 gap analysis",
        bsig_gap_analysis: "BSIG gap analysis",
        document_review: "Document review",
        policy_drafting: "Policy drafting",
        evidence_mapping: "Evidence mapping",
        audit_preparation: "Audit preparation",
        implementation_checklist: "Implementation checklist",
      },
      providers: {
        companyHosted: "Complyx hosted",
        openai: "OpenAI",
        selfHosted: "Self-hosted",
      },
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
    organizationSettings: {
      accountTitle: "User account",
      accountItems: ["Email address", "Password", "Account security"],
      languageTitle: "Language",
      languageItems: ["German", "English", "Personal preference"],
      notificationsTitle: "Notifications",
      notificationItems: ["Open actions", "Document status", "Deadlines"],
      privacyTitle: "Privacy",
      privacyItems: [
        "Data retention",
        "Document processing",
        "Organization policies",
      ],
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
      dashboard: {
        title: "NIS2 COMPLIANCE DASHBOARD",
        description:
          "See your current NIS2 compliance status, urgent next steps, and the progress of ongoing analyses at a glance.",
        metrics: [
          { label: "Applicability status", value: "Pending" },
          { label: "Analysis progress", value: "0%" },
          { label: "Next steps", value: "Not created yet" },
        ],
      },
      applicabilityCheck: {
        title: "Applicability check",
        description:
          "Check whether your organization falls under the NIS2 Directive.",
        metrics: [
          { label: "Result options", value: "3" },
          { label: "Input areas", value: "4" },
          { label: "Explanation", value: "Short rationale" },
        ],
      },
      actionPlan: {
        title: "Action plan",
        description:
          "Implement open requirements with a prioritized task list, status tracking, and clear responsibilities.",
        metrics: [
          { label: "Task type", value: "Prioritized" },
          { label: "Status", value: "Trackable" },
          { label: "Progress", value: "Per task" },
        ],
      },
      gapAnalysis: {
        title: "Gap analysis",
        description:
          "Identify security gaps with a focused questionnaire covering backups, incident response, access control, and other core areas.",
        metrics: [
          { label: "Questionnaire areas", value: "7" },
          { label: "Result levels", value: "3" },
          { label: "Actions", value: "Prioritized" },
        ],
      },
      helpGlossary: {
        title: "Help & glossary",
        description:
          "Help, glossary, FAQ, and tooltip content is available without database interaction.",
        metrics: [
          { label: "Database", value: "None" },
          { label: "Content", value: "Static" },
          { label: "Use", value: "Explanations" },
        ],
      },
      pdfExport: {
        title: "PDF export",
        description:
          "Generate a print-ready status report covering critical areas and actions for management and external reviewers.",
        metrics: [
          { label: "Audiences", value: "3" },
          { label: "Report areas", value: "5" },
          { label: "History", value: "Planned" },
        ],
      },
      documentReview: {
        title: "Document review",
        description:
          "Upload your security concepts and policies. Our AI automatically reviews them for completeness and conformity with NIS2 requirements.",
        metrics: [
          { label: "Upload types", value: "4" },
          { label: "Review statuses", value: "3" },
          { label: "Examples", value: "4" },
        ],
        cards: [
          {
            title: "Upload",
            description: "Documents intended for AI review.",
            items: [
              "Guidelines",
              "Policies",
              "Security concepts",
              "Emergency plans",
            ],
          },
          {
            title: "AI classification",
            description: "The analysis classifies each expected document.",
            items: ["Available", "Incomplete", "Not found"],
          },
          {
            title: "Examples",
            description: "Typical documents in the NIS2 context.",
            items: [
              "Password policy",
              "MFA policy",
              "Incident response document",
              "Backup concept",
            ],
          },
          {
            title: "Follow-up tasks",
            description:
              "Missing or incomplete content is transferred to the action plan.",
            items: [
              "Create a missing document",
              "Revise an incomplete policy",
              "Assign evidence to a security area",
            ],
          },
        ],
      },
      requirementsDescription:
        "Placeholder for requirements engineering from research, interview guides, and company interviews.",
      riskManagementDescription:
        "Placeholder for documenting technical and organizational measures from the BSIG risk management areas.",
      suppliersDescription:
        "Placeholder for supply-chain risk mapping and the later capture of direct suppliers and service providers.",
      registrationDescription:
        "Placeholder for the two-step registration process with the MUK/ELSTER organization account and the BSI portal.",
    },
    guestCheck: {
      shell: {
        noAccount: "No account",
      },
      start: {
        title: "NIS2 quick check",
        description:
          "Answer six short questions and receive an initial, non-binding assessment. No account is required.",
        companyName: "Company name",
        companyNamePlaceholder: "Example Ltd.",
        retentionNotice:
          "Your entries are stored in this browser for 30 days.",
        anonymousAuthDisabled:
          "Anonymous sign-ins have not yet been enabled for this Supabase project.",
        anonymousAuthInstructions:
          "In Supabase, open Authentication → Providers → Anonymous Sign-Ins and enable “Allow anonymous sign-ins”.",
        openAuthSettings: "Open auth settings",
        start: "Start quick check",
        starting: "Starting quick check...",
        startFailed: "The quick check could not be started.",
      },
      questionnaire: {
        title: "Your company details",
        description:
          "Your answers are saved automatically. You can continue the quick check later in this browser.",
        loading: "Loading questionnaire...",
        notFound: "Quick check not found.",
        loadFailed: "The questionnaire could not be loaded.",
        saveFailed: "The answer could not be saved.",
        evaluationFailed: "The result could not be calculated.",
        notesPlaceholder: "Optional notes",
        showResult: "Show result",
        recalculateResult: "Recalculate result",
        backToPreviousResult: "Back to previous result",
        calculating: "Calculating result...",
        disclaimer:
          "The quick check provides non-binding initial guidance and does not replace legal advice.",
        sectionTitle: "Company details",
        sectionDescription: "Six short questions for initial guidance.",
        questions: {
          country: {
            prompt: "In which country is your company established?",
            helpText:
              "This quick check is designed for Germany and the EU.",
            options: {
              DE: "Germany",
              EU: "Another EU member state",
              OTHER: "Outside the EU",
            },
          },
          covered_sector: {
            prompt: "Does your company operate in a sector covered by NIS2?",
            helpText:
              "These include energy, transport, healthcare, digital infrastructure, and certain manufacturing industries.",
            options: { yes: "Yes", no: "No", unsure: "Unsure" },
          },
          medium_threshold: {
            prompt:
              "Does your company meet at least the threshold for a medium-sized enterprise?",
            helpText:
              "As a guide: at least 50 employees or more than EUR 10 million in annual turnover and balance sheet total.",
            options: { yes: "Yes", no: "No", unsure: "Unsure" },
          },
          special_entity: {
            prompt:
              "Does your company belong to a special category covered regardless of size?",
            helpText:
              "Examples may include certain trust services, DNS services, or particularly critical entities.",
            options: { yes: "Yes", no: "No", unsure: "Unsure" },
          },
          lex_specialis: {
            prompt:
              "Could a sector-specific regulation such as DORA take precedence?",
            helpText:
              "A potentially overriding sector-specific rule requires an individual legal assessment.",
            options: { yes: "Yes", no: "No", unsure: "Unsure" },
          },
          notes: {
            prompt: "Would you like to add any further details?",
            helpText:
              "Optional. Add any special circumstances or open questions here.",
            options: {},
          },
        },
      },
      result: {
        title: "Your initial assessment",
        description:
          "You can now export or delete the result, or create an account to keep it permanently.",
        loading: "Loading result...",
        notFound: "Result not found.",
        loadFailed: "The result could not be loaded.",
        confirmDelete: "Do you want to permanently delete this result?",
        deleteFailed: "The result could not be deleted.",
        disclaimer:
          "This assessment provides non-binding initial guidance and is not legal advice. A final assessment requires a review of your specific activities and company data.",
        createAccount: "Create an account and save the result",
        claim: "Transfer to an existing account",
        backToAnswers: "Back to answers",
        downloadPdf: "Download PDF",
        delete: "Delete result",
        deleting: "Deleting...",
        presentations: {
          affected: "Likely affected",
          notAffected: "No current indication of being affected",
          possiblyAffected: "Individual assessment required",
        },
        details: {
          important: {
            summary: "Your company is likely affected by NIS2.",
            reasoning:
              "Your answers indicate a covered sector and that the relevant size threshold is met.",
          },
          specialCase: {
            summary: "Your company may be covered regardless of its size.",
            reasoning:
              "The selected special category may result in NIS2 applicability regardless of company size.",
          },
          notAffected: {
            summary:
              "Your answers currently show no indication that NIS2 applies.",
            reasoning:
              "Neither a covered sector nor a size-independent special category was selected.",
          },
          unknown: {
            summary: "An individual assessment is required.",
            reasoning:
              "The combination of your answers should be reviewed individually.",
          },
        },
      },
      finalizer: {
        title: "Creating your account",
        description: "Your quick check is now being linked to the account.",
        claimFailed: "The quick check could not be transferred.",
        signIn: "Sign in with an existing account",
        claiming: "Transferring result...",
        backgroundAlt: "Background",
      },
      pdf: {
        title: "Your NIS2 quick check result",
        subject: "Non-binding initial NIS2 guidance",
        createdOn: "Created on",
        assessment: "ASSESSMENT",
        answers: "Your answers",
        noAnswer: "—",
        disclaimer:
          "This quick check provides non-binding initial guidance and is not legal advice. A final assessment requires a review of your specific circumstances.",
        fileName: "nis2-quick-check",
      },
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
