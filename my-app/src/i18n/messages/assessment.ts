import { defineFeatureMessages } from "@/src/i18n/define-messages";

export const assessmentMessages = defineFeatureMessages({
  de: {
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
          claimTitle: "Schnellcheck übernehmen",
          claimDescription:
            "Wähle eine Organisation, in die der abgeschlossene Schnellcheck übernommen werden soll.",
          addAssessment: "Bewertung hier hinzufügen",
          addingAssessment: "Bewertung wird hinzugefügt...",
          claimError: "Bewertung konnte nicht übernommen werden",
          statuses: {
            draft: "Entwurf",
            in_review: "In Prüfung",
            completed: "Abgeschlossen",
            archived: "Archiviert",
          },
        },
  },
  en: {
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
          claimTitle: "Add quick check",
          claimDescription:
            "Choose the organization where this completed quick check should be saved.",
          addAssessment: "Add assessment here",
          addingAssessment: "Adding assessment...",
          claimError: "Assessment could not be added",
          statuses: {
            draft: "Draft",
            in_review: "In review",
            completed: "Completed",
            archived: "Archived",
          },
        },
  }
});
