import { defineFeatureMessages } from "@/lib/i18n/define-messages";

export const reportsMessages = defineFeatureMessages({
  de: {
    reports: {
      workflow: {
        create: "Bericht erstellen",
        title: "Compliance-Bericht",
        download: "Herunterladen",
        cancel: "Abbrechen",
        empty: "Noch keine Berichte.",
        error: "Der Berichtsvorgang ist fehlgeschlagen.",
        sourceHash: "Quelldaten",
        statuses: {
          queued: "Warteschlange",
          rendering: "Wird erstellt",
          ready: "Bereit",
          failed: "Fehlgeschlagen",
          cancelled: "Abgebrochen",
        },
      },
      pdf: {
        title: "Compliance-Bericht",
        subject: "NIS2-Compliance-Statusbericht",
        eyebrow: "NIS2 · COMPLIANCE-BERICHT",
        immutableSnapshot: "Unveränderlicher Datenstand",
        fileName: "compliance-bericht",
        confidential: "Vertraulich",
        pageOf: "Seite {page} von {total}",
        disclaimer:
          "Dieser Bericht ist eine strukturierte Auswertung der hinterlegten Antworten und Nachweise und stellt keine abschließende Rechtsberatung dar.",
        scopeResult: "ERGEBNIS DER BETROFFENHEITSPRÜFUNG",
        jurisdiction: "Rechtsraum",
        applicabilitySection: "Betroffenheitsprüfung",
        applicabilityIntro:
          "Ergebnis der Prüfung und die vollständigen Angaben, auf denen es beruht.",
        answers: "Angaben zur Prüfung",
        findingsSection: "Feststellungen und Lücken",
        findingsIntro:
          "Jede Feststellung mit Status, Nachweislage und der zugrunde liegenden Rechtsgrundlage.",
        openGaps: "Offene Lücken",
        evidenceStatus: "Nachweislage",
        legalBasis: "Rechtsgrundlage",
        noFindings: "Die Gap-Analyse enthält keine Feststellungen.",
        actionsSection: "Maßnahmenplan",
        actionsIntro:
          "Maßnahmen nach Status sortiert und direkt der zugrunde liegenden Feststellung zugeordnet.",
        measures: "Maßnahmen",
        measure: "Maßnahme",
        noActions: "Es wurde kein Maßnahmenplan erstellt.",
        appendix: "Anhang",
        appendixIntro:
          "Vorgehen und Herkunft der ausgewerteten Quellen, ohne den Hauptbericht zu überladen.",
        methodology: "Methodik",
        methodologySteps: {
          applicability: {
            title: "Betroffenheit",
            text: "Prüfantworten werden zu Ergebnis, Einstufung und entscheidenden Merkmalen verdichtet.",
          },
          gapAnalysis: {
            title: "Gap-Analyse",
            text: "Antworten und Nachweise werden je Themenfeld in einen Status überführt.",
          },
          actions: {
            title: "Maßnahmen",
            text: "Aus jeder Feststellung werden konkrete Maßnahmen mit eindeutiger Zuordnung abgeleitet.",
          },
          report: {
            title: "Bericht",
            text: "Der Hauptteil zeigt die Ergebnisse; Herkunft und Vorgehen verbleiben im Anhang.",
          },
        },
        sourceRegister: "Quellenregister",
        registerSource: "QUELLE",
        registerReference: "RECHTSSTELLE",
        registerLocation: "FUNDSTELLE",
        noSources: "Für diesen Bericht sind keine Quellen verknüpft.",
      },
    },
  },
  en: {
    reports: {
      workflow: {
        create: "Create report",
        title: "Compliance report",
        download: "Download",
        cancel: "Cancel",
        empty: "No reports yet.",
        error: "The report operation failed.",
        sourceHash: "Source data",
        statuses: {
          queued: "Queued",
          rendering: "Rendering",
          ready: "Ready",
          failed: "Failed",
          cancelled: "Cancelled",
        },
      },
      pdf: {
        title: "Compliance report",
        subject: "NIS2 compliance status report",
        eyebrow: "NIS2 · COMPLIANCE REPORT",
        immutableSnapshot: "Immutable source snapshot",
        fileName: "compliance-report",
        confidential: "Confidential",
        pageOf: "Page {page} of {total}",
        disclaimer:
          "This report is a structured evaluation of the recorded answers and evidence and does not constitute final legal advice.",
        scopeResult: "APPLICABILITY RESULT",
        jurisdiction: "Jurisdiction",
        applicabilitySection: "Applicability assessment",
        applicabilityIntro:
          "The result of the assessment and the full set of answers it is based on.",
        answers: "Assessment answers",
        findingsSection: "Findings and gaps",
        findingsIntro:
          "Every finding with its status, evidence situation, and underlying legal basis.",
        openGaps: "Open gaps",
        evidenceStatus: "Evidence",
        legalBasis: "Legal basis",
        noFindings: "The gap analysis contains no findings.",
        actionsSection: "Action plan",
        actionsIntro:
          "Actions sorted by status and mapped directly to the finding they address.",
        measures: "Actions",
        measure: "Action",
        noActions: "No action plan has been created.",
        appendix: "Appendix",
        appendixIntro:
          "Method and provenance of the evaluated sources, kept out of the main report.",
        methodology: "Method",
        methodologySteps: {
          applicability: {
            title: "Applicability",
            text: "Assessment answers are condensed into a result, a classification, and the decisive attributes.",
          },
          gapAnalysis: {
            title: "Gap analysis",
            text: "Answers and evidence are translated into a status for each topic.",
          },
          actions: {
            title: "Actions",
            text: "Concrete actions are derived from each finding with an unambiguous mapping.",
          },
          report: {
            title: "Report",
            text: "The main part shows the results; provenance and method stay in the appendix.",
          },
        },
        sourceRegister: "Source register",
        registerSource: "SOURCE",
        registerReference: "LEGAL REFERENCE",
        registerLocation: "LOCATION",
        noSources: "No sources are linked to this report.",
      },
    },
  },
});
