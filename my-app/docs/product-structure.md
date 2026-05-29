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

- `self_check_assessments` und `questionnaire_runs` fuer Betroffenheit und Analysefortschritt
- `organization_requirements` fuer Sicherheitsmassnahmen
- `document_review_runs` und `document_review_findings` fuer Dokumentenstatus
- `action_plan_items` fuer naechste Schritte
- `report_exports` fuer vorhandene PDF-Berichte

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

- `organizations` fuer Mitarbeiteranzahl, Umsatz, Bilanzsumme und Unternehmensdaten
- `nis2_sectors` und `organization_sectors` fuer Branchen
- `nis2_critical_services` und `organization_critical_services` fuer kritische Dienstleistungen
- `questionnaire_templates`, `questionnaire_sections`, `questionnaire_questions`, `questionnaire_runs`, `questionnaire_answers` fuer strukturierte Fragen und Antworten
- `self_check_assessments` fuer finales Ergebnis und Begruendung

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

- `questionnaire_templates`, `questionnaire_sections`, `questionnaire_questions`, `questionnaire_runs`, `questionnaire_answers` fuer Fragebogen, Fortschritt und Ergebnis
- `tom_areas` und `organization_requirements` fuer Sicherheitsmassnahmen
- `action_plan_items` fuer priorisierte Massnahmen
- `requirement_evidence` fuer Nachweise zu Anforderungen

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

- `ai_documents` und `ai_document_chunks` fuer Uploads, Textextraktion und RAG-Suche
- `document_requirement_types` fuer erwartete Dokumenttypen
- `document_review_runs` fuer Prueflaeufe
- `document_review_findings` fuer Ergebnisse wie vorhanden, unvollstaendig oder nicht gefunden
- `action_plan_items` fuer Aufgaben aus fehlenden oder unvollstaendigen Dokumenten

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

- `action_plan_items` als zentrale Aufgabenliste
- Optionale Quellen:
  - `organization_requirements`
  - `questionnaire_runs`
  - `document_review_findings`
  - `ai_documents`

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

- `report_exports` fuer Export-Historie, Zielgruppe, Status und Speicherpfad
- PDF-Inhalt wird aus dem aktuellen Organisationsstatus, den Fragebogen,
  Dokumentenpruefungen und Massnahmen generiert

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
- `user_preferences` fuer Sprache, Benachrichtigungen, Datenschutz und UI-Einstellungen
- `organization_settings` fuer organisationsweite Benachrichtigungs-, Datenschutz- und Compliance-Einstellungen

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
