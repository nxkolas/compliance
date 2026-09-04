import { defineFeatureMessages } from "@/src/i18n/define-messages";

export const homeMessages = defineFeatureMessages({
  de: {
    home: {
      brand: "ComplyX",
      navigation: {
        nis2: "NIS2 verstehen",
        workflow: "So funktioniert's",
        about: "Über uns",
      },
      eyebrow: "Compliance-Workflow für die NIS2-Vorbereitung",
      hero: {
        titleBefore: "setzt das Puzzle fort, für",
        titleHighlight: "NIS2-Schutz",
        titleAfter: "an jedem Ort.",
        secondaryCta: "Wie funktionierts?",
      },
      authenticatedHero: {
        welcomeTitleBeforeLogo: "Willkommen zurück bei",
        continuationBefore: "Setzen Sie Ihre",
        continuationHighlight: "NIS2-Umsetzung",
        continuationAfter: "fort.",
        description:
          "Verwalten Sie Ihre Organisationen, prüfen Sie deren Betroffenheit und setzen Sie die nächsten Schritte gezielt um.",
        previewTitle: "Ihr Arbeitsbereich",
        previewDescription: "Alle wichtigen NIS2-Bereiche an einem Ort.",
        previewItems: [
          "Organisationen",
          "Betroffenheitscheck",
          "Gap-Analyse",
          "Dokumente",
          "Maßnahmenplan",
        ],
      },
      newUserHero: {
        welcomeTitleBeforeLogo: "Willkommen bei",
        continuationBefore: "Starten Sie mit Ihrer",
        continuationHighlight: "ersten Organisation",
        continuationAfter: ".",
        description:
          "Legen Sie Ihre Organisation an und prüfen Sie anschließend, ob sie von NIS2 betroffen ist.",
        primaryCta: "Organisation anlegen",
        secondaryCta: "Wie funktioniert's?",
        previewTitle: "Ihr Arbeitsbereich",
      },
      heroDescription:
        "ComplyX ist die Web-Anwendung, die kleinen und mittelgroßen Unternehmen hilft, ihre NIS2-Betroffenheit zu prüfen, Risiken einzuschätzen und die nächsten Schritte klar zu erkennen.",
      dashboardCta: "Zum Dashboard",
      selfCheckCta: "Betroffenheit prüfen",
      trust: {
        gdpr: "DSGVO-konform",
        frankfurt: "Datenbank in Frankfurt",
        noItDepartment: "Ohne IT-Abteilung nutzbar",
      },
      directive: {
        titleBefore: "Eine",
        titleHighlight: "Richtlinie",
        titleAfter: ", die mehr Unternehmen betrifft, als viele denken.",
        paragraphs: [
          "NIS2 ist eine europäische Richtlinie zur Cybersicherheit, die für bestimmte Unternehmen und öffentliche Einrichtungen gilt. Sie soll dafür sorgen, dass wichtige Dienste und Unternehmensdaten besser vor Cyberangriffen, Ausfällen und Datenverlust geschützt werden.",
          "Betroffene Unternehmen müssen deshalb ihre IT-Risiken prüfen, geeignete Sicherheitsmaßnahmen umsetzen und auf Sicherheitsvorfälle vorbereitet sein. ComplyX hilft Ihnen dabei, einfach zu verstehen, ob Ihr Unternehmen betroffen sein könnte und welche nächsten Schritte sinnvoll sind.",
        ],
      },
      showcaseCta: "JETZT Betroffenheit prüfen",
      statusTitle: "Ihr NIS2-Überblick",
      statusSubtitle: "Fortschritt und nächste Schritte auf einen Blick",
      videoPlayLabel: "Produktvideo abspielen",
      videoFallback: "Ihr Browser unterstützt die Videowiedergabe nicht.",
      active: "Aktiv",
      modulesTitle: "Vier Puzzleteile, ein vollständiges Bild.",
      modulesDescription:
        "ComplyX zerlegt die NIS2-Richtlinie in klar abgegrenzte Bausteine. Jeder davon ist für sich verständlich — zusammen ergeben sie Ihre vollständige Einschätzung.",
      createAccount: "Account erstellen",
      metrics: {
        modules: "Produktbereiche",
        workflow: "zentraler Workflow",
        focus: "Fokus",
      },
      productLinks: [
        {
          label: "Betroffenheitscheck",
          description:
            "Ermittelt, ob und wie Ihr Unternehmen von NIS2 betroffen ist.",
          tag: "Prüfen",
        },
        {
          label: "Dokumente hochladen",
          description: "Prüft Ihre vorhandenen Richtlinien und Nachweise.",
          tag: "Sammeln",
        },
        {
          label: "Gap-Analyse",
          description:
            "31 Fragen zeigen, wo Ihr aktueller Sicherheitsstand steht.",
          tag: "Analysieren",
        },
        {
          label: "Maßnahmenplan",
          description:
            "Zeigt Ihre priorisierten nächsten Schritte auf einen Blick.",
          tag: "Umsetzen",
        },
      ],
      questions: {
        title: "Drei Fragen, die aktuell in vielen Unternehmen offen sind.",
        description:
          "Vor der eigentlichen Umsetzung steht meist erst einmal Klärungsbedarf. ComplyX beantwortet genau diese Fragen, bevor sie zum Stolperstein werden.",
        items: [
          {
            title: "Betrifft uns das überhaupt?",
            description: "Ohne Vorwissen kaum zu beantworten.",
            
          },
          {
            title: "Was steht da eigentlich?",
            description: "Fachtexte, die niemand versteht.",
          },
          {
            title: "Wer kümmert sich darum?",
            description: "Meist fehlt schlicht die zuständige Person.",
          },
        ],
      },
      about: {
        titleBefore: "Drei Studiengänge. Ein",
        titleHighlight: "Puzzle.",
        description:
          "ComplyX entsteht als studentisches Projekt an der Technischen Hochschule Würzburg-Schweinfurt (THWS). Jede Person im Team bringt ein eigenes Fachgebiet mit — E-Commerce, Digitale Gesellschaft und Wirtschaftsinformatik. Erst im Zusammenspiel dieser unterschiedlichen Perspektiven ergibt sich das vollständige Bild: eine Plattform, die NIS2 wirklich verständlich macht.",
        team: [
          { initials: "MK", name: "Melanie Kurmaschev", field: "Digitale Gesellschaft" },
          { initials: "QD", name: "Quynh Anh Dang", field: "E-Commerce" },
          { initials: "ES", name: "Eya Sdouga", field: "Digitale Gesellschaft" },
          { initials: "NK", name: "Nikolas Keller", field: "Wirtschaftsinformatik" },
          { initials: "MM", name: "Marie Meinhardt", field: "Digitale Gesellschaft" },
        ],
      },
      finalCta: {
        titleBefore: "Finden Sie in",
        titleHighlight: "wenigen",
        titleHighlightRest: "Minuten",
        titleAfter: "heraus, wo Ihr Unternehmen steht.",
        description:
          "Starten Sie den kostenlosen Betroffenheitscheck und erhalten Sie eine erste, verständliche Einschätzung zur NIS2-Richtlinie.",
      },
      footer: {
        cookie: "Cookie-Einstellungen",
        imprint: "Impressum",
        privacy: "Datenschutz",
        licenses: "Lizenzen",
        copyright: "© ComplyX 2026",

      },
    },
  },
  en: {
    home: {
      brand: "ComplyX",
      navigation: {
        nis2: "Understand NIS2",
        workflow: "How it works",
        about: "About us",
      },
      eyebrow: "Compliance workflow for NIS2 preparation",
      hero: {
        titleBefore: "completes the puzzle for",
        titleHighlight: "NIS2 protection",
        titleAfter: "wherever you are.",
        secondaryCta: "How does it work?",
      },
      authenticatedHero: {
        welcomeTitleBeforeLogo: "Welcome back to",
        continuationBefore: "Continue your",
        continuationHighlight: "NIS2 implementation",
        continuationAfter: "with confidence.",
        description:
          "Manage your organizations, assess their scope, and put the next steps into action with confidence.",
        previewTitle: "Your workspace",
        previewDescription: "All key NIS2 areas in one place.",
        previewItems: [
          "Organizations",
          "Scope check",
          "Gap analysis",
          "Documents",
          "Action plan",
        ],
      },
      newUserHero: {
        welcomeTitleBeforeLogo: "Welcome to",
        continuationBefore: "Start with your",
        continuationHighlight: "first organization",
        continuationAfter: ".",
        description:
          "Create your organization, then check whether it is affected by NIS2.",
        primaryCta: "Create organization",
        secondaryCta: "How does it work?",
        previewTitle: "Your workspace",
      },
      heroDescription:
        "ComplyX is the web application that helps small and medium-sized companies assess their NIS2 scope, understand risks, and clearly identify the next steps.",
      dashboardCta: "Go to dashboard",
      selfCheckCta: "Check your scope",
      trust: {
        gdpr: "GDPR compliant",
        frankfurt: "Database in Frankfurt",
        noItDepartment: "Works without an IT department",
      },
      directive: {
        titleBefore: "A",
        titleHighlight: "directive",
        titleAfter: " that affects more organizations than many realize.",
        paragraphs: [
          "NIS2 is a European cybersecurity directive that applies to certain companies and public-sector organizations. Its aim is to protect essential services and company data more effectively against cyberattacks, outages, and data loss.",
          "Organizations in scope must assess their IT risks, implement appropriate security measures, and prepare for security incidents. ComplyX helps you understand whether your organization may be affected and which next steps make sense.",
        ],
      },
      showcaseCta: "Check your scope now",
      statusTitle: "Your NIS2 overview",
      statusSubtitle: "Progress and next steps at a glance",
      videoPlayLabel: "Play product video",
      videoFallback: "Your browser does not support video playback.",
      active: "Active",
      modulesTitle: "Four puzzle pieces, one complete picture.",
      modulesDescription:
        "ComplyX breaks the NIS2 directive into clearly defined building blocks. Each is easy to understand on its own — together they provide your complete assessment.",
      createAccount: "Create account",
      metrics: {
        modules: "Product areas",
        workflow: "central workflow",
        focus: "Focus",
      },
      productLinks: [
        {
          label: "Scope check",
          description:
            "Determines whether and how your organization is affected by NIS2.",
          tag: "Check",
        },
        {
          label: "Upload documents",
          description: "Brings your existing policies and evidence together.",
          tag: "Collect",
        },
        {
          label: "Gap analysis",
          description:
            "Reviews your documents and makes outstanding requirements visible.",
          tag: "Analyze",
        },
        {
          label: "Action plan",
          description: "Shows your prioritized next steps at a glance.",
          tag: "Implement",
        },
      ],
      questions: {
        title: "Three questions many organizations are currently facing.",
        description:
          "Before implementation can begin, key questions usually need answering. ComplyX addresses them before they become obstacles.",
        items: [
          {
            title: "Does this even affect us?",
            description: "Almost impossible to answer without prior knowledge.",
          },
          {
            title: "What does that actually mean?",
            description: "Technical language that nobody understands.",
          },
          {
            title: "Who is responsible for it?",
            description: "Often, no one has been assigned responsibility.",
          },
        ],
      },
      about: {
        titleBefore: "Five degree programs. One",
        titleHighlight: "puzzle.",
        description:
          "ComplyX is being developed as a student project at the Technical University of Applied Sciences Würzburg-Schweinfurt (THWS). Each team member contributes a different area of expertise — E-Commerce, Digital Society, and Business Information Systems. Together, these perspectives form the complete picture: a platform that makes NIS2 genuinely understandable.",
        team: [
          { initials: "MK", name: "Melanie Kurmaschev", field: "Digital Society" },
          { initials: "QD", name: "Quynh Anh Dang", field: "E-Commerce" },
          { initials: "ES", name: "Eya Sdouga", field: "Digital Society" },
          { initials: "NK", name: "Nikolas Keller", field: "Business Information Systems" },
          { initials: "MM", name: "Marie Meinhardt", field: "Digital Society" },
        ],
      },
      finalCta: {
        titleBefore: "Find out in just a",
        titleHighlight: "few",
        titleHighlightRest: "minutes",
        titleAfter: "where your organization stands.",
        description:
          "Start the free scope check and receive an initial, easy-to-understand assessment of the NIS2 directive.",
      },
      footer: {
        cookie: "Cookie settings",
        imprint: "Legal notice",
        privacy: "Privacy",
        licenses: "Licenses",
        copyright: "© ComplyX 2026",
      },
    },
  },
});
