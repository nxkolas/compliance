import { defineFeatureMessages } from "@/lib/i18n/define-messages";

export const legalPagesMessages = defineFeatureMessages({
  de: {
    legal: {
      footerNavigationLabel: "Rechtliche Informationen",
      imprint: {
        metadataTitle: "Impressum | ComplyX",
        metadataDescription:
          "Gesetzlich vorgeschriebene Anbieterangaben und Kontaktmöglichkeiten von ComplyX.",
        title: "Impressum",
        introduction:
          "Hier finden Sie die gesetzlich vorgeschriebenen Angaben zum Anbieter von ComplyX sowie unsere Kontaktmöglichkeiten. Die Angaben erfolgen gemäß § 5 DDG und § 18 MStV.",
        provider: {
          title: "Anbieter",
          teamName: "ComplyX (studentisches Projektteam)",
          members: [
            "Melanie Kurmaschev",
            "Quynh Anh Dang",
            "Marie Meinhardt",
            "Nikolas Keller",
            "Eya Sdouga",
          ],
          institution: "Technische Hochschule Würzburg-Schweinfurt",
          street: "Sanderheinrichsleitenweg 20",
          city: "97074 Würzburg",
        },
        contact: {
          title: "Kontakt",
          emailLabel: "E-Mail:",
          email: "complyxx@gmail.com",
          phoneLabel: "Telefon:",
          phone: "+49 152 08198263",
          websiteLabel: "Website:",
        },
        project: {
          title: "Angaben zum Projekt",
          paragraphs: [
            "ComplyX ist ein studentisches Projekt, das im Rahmen eines Hochschulprojekts an der Technischen Hochschule Würzburg-Schweinfurt",
            "im Sommersemester 2026 entwickelt wurde.",
            "Die Anwendung unterstützt Unternehmen dabei, sich einen ersten Überblick über eine mögliche NIS2-Betroffenheit, den bestehenden Stand ihrer IT-Sicherheit und mögliche nächste Schritte zu verschaffen.",
            "ComplyX ist ein prototypisches Projekt und kein offizielles Angebot der Technischen Hochschule Würzburg-Schweinfurt.",
          ],
        },
        usage: {
          title: "Hinweise zur Nutzung",
          paragraphs: [
            "Die über ComplyX bereitgestellten Inhalte und Ergebnisse dienen ausschließlich der allgemeinen Information und einer ersten Orientierung.",
            "Sie stellen insbesondere keine Rechtsberatung, keine IT-Sicherheitsberatung, keine Zertifizierung und keine verbindliche Prüfung der NIS2-Betroffenheit oder NIS2-Compliance dar.",
            "Die Ergebnisse beruhen auf den von den Nutzenden eingegebenen Informationen und gegebenenfalls bereitgestellten Dokumenten.",
            "Für eine verbindliche Beurteilung sollten qualifizierte Rechts- oder IT-Sicherheitsfachstellen hinzugezogen werden.",
          ],
        },
        liability: {
          title: "Haftungsausschluss",
          paragraphs: [
            "Die Inhalte dieser Anwendung wurden mit größter Sorgfalt erstellt.",
            "Dennoch kann keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der bereitgestellten Inhalte und Ergebnisse übernommen werden.",
            "Die Nutzung der Anwendung und der daraus abgeleiteten Ergebnisse erfolgt in eigener Verantwortung. Die Haftung der Anbieterinnen und Anbieter richtet sich nach den gesetzlichen Vorschriften. Zwingende gesetzliche Haftungsregelungen bleiben unberührt.",
          ],
        },
      },
    },
  },
  en: {
    legal: {
      footerNavigationLabel: "Legal information",
      imprint: {
        metadataTitle: "Legal notice | ComplyX",
        metadataDescription:
          "Legally required provider information and contact details for ComplyX.",
        title: "Legal notice",
        introduction:
          "This page contains the legally required information about the provider of ComplyX and our contact details. The information is provided in accordance with Section 5 DDG and Section 18 MStV.",
        provider: {
          title: "Provider",
          teamName: "ComplyX (student project team)",
          members: [
            "Melanie Kurmaschev",
            "Quynh Anh Dang",
            "Marie Meinhardt",
            "Nikolas Keller",
            "Eya Sdouga",
          ],
          institution: "Technical University of Applied Sciences Würzburg-Schweinfurt",
          street: "Sanderheinrichsleitenweg 20",
          city: "97074 Würzburg, Germany",
        },
        contact: {
          title: "Contact",
          emailLabel: "Email:",
          email: "complyxx@gmail.com",
          phoneLabel: "Telephone:",
          phone: "+49 152 08198263",
          websiteLabel: "Website:",
        },
        project: {
          title: "Project information",
          paragraphs: [
            "ComplyX is a student project developed as part of a university project at the Technical University of Applied Sciences Würzburg-Schweinfurt during the 2026 summer semester.",
            "The application helps organizations obtain an initial overview of whether they may be affected by NIS2, the current state of their IT security, and possible next steps.",
            "ComplyX is a prototype project and not an official service of the Technical University of Applied Sciences Würzburg-Schweinfurt.",
          ],
        },
        usage: {
          title: "Usage information",
          paragraphs: [
            "The content and results provided through ComplyX are intended solely for general information and initial guidance.",
            "In particular, they do not constitute legal advice, IT security consulting, certification, or a binding assessment of NIS2 applicability or NIS2 compliance.",
            "The results are based on information entered by users and any documents they provide. Qualified legal or IT security professionals should be consulted for a binding assessment.",
          ],
        },
        liability: {
          title: "Disclaimer",
          paragraphs: [
            "The content of this application has been prepared with the greatest possible care. Nevertheless, no guarantee can be given for the accuracy, completeness, or timeliness of the content and results provided.",
            "Use of the application and any results derived from it is at the user's own responsibility. The liability of the providers is governed by statutory provisions. Mandatory statutory liability rules remain unaffected.",
          ],
        },
      },
    },
  },
});
