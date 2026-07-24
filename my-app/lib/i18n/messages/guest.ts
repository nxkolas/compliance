import { defineFeatureMessages } from "@/lib/i18n/define-messages";

export const guestMessages = defineFeatureMessages({
  de: {
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
            backToResult: "Zurück zum Ergebnis",
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
            description: "Sie wählen gleich die passende Organisation aus.",
            claimFailed: "Der Schnellcheck konnte nicht übernommen werden.",
            signIn: "Mit bestehendem Konto anmelden",
            claiming: "Organisationen werden geöffnet...",
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
  },
  en: {
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
            backToResult: "Back to result",
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
            description: "You will choose the destination organization next.",
            claimFailed: "The quick check could not be transferred.",
            signIn: "Sign in with an existing account",
            claiming: "Opening organizations...",
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
  }
});
