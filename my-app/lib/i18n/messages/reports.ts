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
        immutableSnapshot: "Unveränderlicher Datenstand",
        sources: "Quellen",
        applicability: "Betroffenheit",
        gapAnalysis: "Gap-Analyse",
        actionPlan: "Maßnahmenplan",
        documents: "Dokumente",
        provenance: "Nachweis",
        organization: "Organisation",
        report: "Bericht",
        inputHash: "Eingabe-SHA-256",
        fileName: "compliance-bericht",
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
        immutableSnapshot: "Immutable source snapshot",
        sources: "Sources",
        applicability: "Applicability",
        gapAnalysis: "Gap analysis",
        actionPlan: "Action plan",
        documents: "Documents",
        provenance: "Provenance",
        organization: "Organization",
        report: "Report",
        inputHash: "Input SHA-256",
        fileName: "compliance-report",
      },
    },
  },
});
