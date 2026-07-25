import { defineFeatureMessages } from "@/lib/i18n/define-messages";

export const homeMessages = defineFeatureMessages({
  de: {
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
                "Dokumentieren Sie Maßnahmen für Governance, Technik und Organisation.",
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
  }
});
