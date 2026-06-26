# Produktstruktur: NIS2 Compliance Checker

Dieses Dokument beschreibt die neue Modulstruktur des NIS2 Compliance Checkers.
Es dient als fachliche Orientierung fuer UI, Datenmodell und spaetere API-
Implementierung.

## Dashboard

### Zweck

Zentrale Uebersicht ueber den aktuellen NIS2-Status einer Organisation.

### Inhalt

- Betroffenheitsstatus
- Sicherheitsmassnahmen
- Analysefortschritt
- Kritische Bereiche
- Naechste Schritte
- Dokumentenstatus

### Datenbasis

- Aktuell implementiert: `organizations`, `organization_fact_definitions`,
  `organization_fact_values`, `compliance_frameworks`,
  `compliance_framework_versions`, `compliance_modules`,
  `questionnaires`, `questionnaire_versions`, `questions`,
  `question_options` und `question_fact_mappings`
- Geplant: `assessments`, `assessment_revisions` und
  `assessment_answers` fuer Betroffenheit und Analysefortschritt
- Geplant: `generated_artifacts`, `generated_artifact_revisions` und
  `artifact_revision_sources` fuer Ergebnisse, Dokumentenstatus, naechste
  Schritte und exportierbare Berichte

## Betroffenheitscheck

### Zweck

Pruefen, ob ein Unternehmen unter NIS2 faellt.

### Inhalt

- Branchenauswahl
- Mitarbeiteranzahl
- Umsatz/Bilanzsumme
- Kritische Dienstleistungen
- Ergebnis:
  - betroffen
  - moeglicherweise betroffen
  - aktuell nicht betroffen

### Zusaetzlich

Kurze Erklaerung: "Warum ist mein Unternehmen betroffen?"

### Datenbasis

- `organizations` fuer stabile Unternehmensidentitaet
- `questionnaires`, `questionnaire_versions`, `questions` und
  `question_options` fuer den versionierten NIS2-Betroffenheitscheck
- `question_fact_mappings` fuer die Zuordnung von Fragen zu stabilen
  Organisationsfakten wie Mitarbeiteranzahl, Umsatz, Bilanzsumme, Branche und
  kritische Dienstleistungen
- `organization_fact_definitions` und spaeter `organization_fact_values` fuer
  wiederverwendbare Compliance-Fakten
- Geplant: `assessments`, `assessment_revisions`, `assessment_answers` sowie
  `generated_artifacts` fuer gespeicherte Antworten, finales Ergebnis und
  Begruendung

## Gap-Analyse

### Zweck

Pruefung der aktuellen Sicherheitsmassnahmen.

### Inhalt

Fragebogen zu:

- Zugriffskontrolle
- Backup & Recovery
- Incident Response
- Lieferkettensicherheit
- Netzwerk-/Systemschutz
- Awareness-Schulungen
- Risikoanalyse

### Ergebnis

- Handlungsbedarf
- Teilweise umgesetzt
- Grundanforderungen erfuellt

### Zusaetzlich

- Fortschrittsanzeige
- Priorisierte Massnahmen

### Datenbasis

- Geplant: `questionnaires`, `questionnaire_versions`, `questions`,
  `question_options`, `assessments`, `assessment_revisions` und
  `assessment_answers` fuer Fragebogen, Fortschritt und Ergebnis
- Geplant: `compliance_requirements` und `gap_findings` fuer Anforderungen,
  Luecken und Nachweise
- Geplant: `action_plan_items` fuer priorisierte Massnahmen

## Dokumentenpruefung

### Zweck

Automatische KI-Pruefung hochgeladener Dokumente.

### Inhalt

Upload von:

- Richtlinien
- Policies
- Sicherheitskonzepten
- Notfallplaenen

KI erkennt:

- vorhanden
- unvollstaendig
- nicht gefunden

### Beispiele

- Passwort-Richtlinie
- MFA-Richtlinie
- Incident-Response-Dokument
- Backup-Konzept

### Datenbasis

- Geplant: `documents` und `document_versions` fuer Uploads,
  Textextraktion und Versionshistorie
- Geplant: `generated_artifacts`, `generated_artifact_revisions` und
  `artifact_revision_sources` fuer Prueflaeufe und nachvollziehbare Quellen
- Geplant: `gap_findings` und `action_plan_items` fuer Ergebnisse und Aufgaben
  aus fehlenden oder unvollstaendigen Dokumenten

## Massnahmenplan

### Zweck

Konkrete naechste Schritte anzeigen.

### Inhalt

Priorisierte Aufgaben:

- Zugriffskontrollen dokumentieren
- Notfallmanagement definieren
- Mitarbeiterschulungen nachweisen

### Zusaetzlich

- Prioritaet
- Status
- Fortschritt

### Ziel

"Was muss ich jetzt konkret tun?"

### Datenbasis

- Geplant: `action_plan_items` als zentrale Aufgabenliste
- Geplant: `generated_artifact_revisions` und `artifact_revision_sources` fuer
  die Herleitung aus Fragebogen, Gap-Analyse und Dokumentenpruefung
- Optionale Quellen:
  - `assessment_revisions`
  - `gap_findings`
  - `document_versions`

## PDF-Export

### Zweck

Bericht exportieren.

### Inhalt

- Zusammenfassung des aktuellen Status
- Kritische Bereiche
- Massnahmenliste
- Dokumentenpruefung
- Fortschritt der Analyse

### Zielgruppe

- Geschaeftsfuehrung
- externe Beratung
- interne Dokumentation

### Datenbasis

- Geplant: Export-Historie als eigener Artifact- oder Export-Datensatz
- PDF-Inhalt wird aus dem aktuellen Organisationsstatus, den versionierten
  Fragebogen, Dokumentenpruefungen und Massnahmen generiert

## Einstellungen

### Zweck

Persoenliche und organisatorische Einstellungen.

### Inhalt

- Unternehmensdaten
- Benutzerkonto
- Sprache
- Benachrichtigungen
- Datenschutz

### Datenbasis

- `organizations` fuer Unternehmensdaten
- Supabase Auth fuer Benutzerkonto und Login-Daten
- Geplant: Tabellen fuer Benutzerpraeferenzen und Organisationseinstellungen
  fuer Sprache, Benachrichtigungen, Datenschutz und UI-Einstellungen

## Hilfe & Glossar

### Zweck

NIS2 verstaendlich erklaeren.

### Inhalt

Einfache Erklaerungen zu Begriffen wie:

- Incident Response
- MFA
- Risikoanalyse
- Lieferkettensicherheit
- Business Continuity

### Zusaetzlich

- FAQ
- kurze Hilfetexte
- Tooltips im gesamten System

### Umsetzung

Hilfe & Glossar ist bewusst statisch. Inhalte werden als HTML, Markdown oder
React-Komponenten umgesetzt und haben keine Datenbanktabellen.
