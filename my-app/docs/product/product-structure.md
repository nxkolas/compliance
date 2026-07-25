# Produktstruktur: NIS2 Compliance Checker

Status: aktueller Produkt- und Implementierungsstand vom 25.07.2026.

Dieses Dokument ordnet die sichtbaren Module fachlich ein. Der detaillierte
Ablauf von Gap-Analyse, Dokumentnachweisen und Maßnahmenplan steht unter
[Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md).

## Organisationen

Die Anwendung ist nach Organisationen getrennt. Mitgliedschaften bestimmen die
Rolle `owner`, `admin`, `member` oder `auditor`. Fachliche Daten werden immer im
Kontext einer Organisation gelesen und durch Server-APIs autorisiert; Browser-
Rollen greifen nicht direkt auf Anwendungstabellen zu.

## Betroffenheitscheck

Der Betroffenheitscheck ermittelt deterministisch, ob und wie eine Organisation
in den NIS2-Anwendungsbereich fällt.

- Fragebogen, Fakten, Rechtsquellen und Regeln stammen aus einer veröffentlichten,
  unveränderlichen Compliance-Release.
- Fragetext, dauerhaft sichtbare Kurzbeschreibung und ergänzender Tooltip
  werden lokalisiert aus genau dieser gepinnten Compliance-Release geladen.
- Jede gestartete Prüfung bleibt an ihre Release gebunden.
- Ergebnisse werden als unveränderliche Revisionen mit nachvollziehbarer Evidenz
  gespeichert.
- Eine neue aktive Release interpretiert historische Ergebnisse nicht neu.
- Der Organisationsworkflow liefert automatisch ein genehmigtes Ergebnis, das
  als Voraussetzung für die Gap-Analyse dient.

Wichtige Tabellen sind `assessments`, `assessment_revisions`,
`assessment_answers`, `generated_artifacts`, `generated_artifact_revisions` und
`nis2_result_projections` sowie die Tabellen der unveränderlichen
`compliance_check_releases`.

## Dokumente

Die Dokumentenbibliothek ist ein eigenständiges Organisationsmodul. Vor der
einmaligen Gap-Analyse kann sie als optionale Evidenzquelle dienen.

- Unterstützt werden Text-PDF, DOCX, TXT und Markdown bis 10 MB.
- Ein Dokument besitzt unveränderliche Versionen und genau einen aktuellen
  Versionszeiger.
- Direkte Upload-Sessions verifizieren die private Speicherung; unveränderliche
  Versionen werden anschließend verarbeitet und indexiert.
- Neue Versionen ersetzen historische Versionen nicht.
- Archivierung entfernt ein Dokument aus zukünftigen Auswahlen, löscht aber
  keine bereits zitierte Evidenz.
- Die Dokumentenseite zeigt keine Gap- oder Maßnahmenplan-Beziehungen. Gepinnte
  Quellen bleiben intern für den unveränderlichen Eingabeschnappschuss und die
  Audit-Historie erhalten.

Die privaten Quelldateien liegen im Supabase-Bucket `organization-evidence`.
Metadaten und Suchdaten liegen in `documents`, `document_versions`,
`document_extractions`, `document_chunks`, `document_embedding_generations` und
`document_chunk_embeddings`.

## Gap-Analyse

Die Gap-Analyse ist ein KI-gestützter, aber serverseitig begrenzter
Organisationsworkflow. Sie ist ein eigener Prozess neben dem deterministischen
Betroffenheitscheck.

Vor der Generierung führt die Oberfläche durch vier nummerierte Aufgaben:

1. **Fragen beantworten** speichert einen unveränderlichen Antwortstand.
2. **Dokumente auswählen** pinnt optional die neuesten verwendbaren Versionen;
   eine leere Auswahl ist gültig und entfernt übernommene Dokumente.
3. **Angaben prüfen** zeigt alle Antworten und Dateinamen vor dem ausdrücklichen
   KI-Aufruf.
4. **Gap-Analyse-Ergebnis** trennt den Umsetzungsstatus von der
   Dokumentunterstützung, bietet Filter und manuelle Änderungen und zeigt pro
   Finding eine kompakte, dauerhaft sichtbare Quellenzeile.

Nach der ersten erfolgreichen Generierung wird der Assistent durch
**Gap-Analyse-Ergebnis** und **Verwendete Eingaben** ersetzt. Die Eingaben
stammen aus den exakt gepinnten Antwort- und Dokumentversionen. Eine zweite
KI-Generierung ist nicht möglich.

Der Grounding Gateway recherchiert ausschließlich in gepinnten, freigegebenen
Rechtsquellen und ausgewählten Organisationsevidenzen. Fragebogenangaben können
einen Umsetzungsstatus stützen; `evidenceSufficiency` und der Hinweis auf ein
Organisationsdokument bleiben davon unabhängig. Die KI darf weder
Anwendbarkeit noch Priorität bestimmen und jede Rechtsbehauptung benötigt ein
gültiges Zitat.

Die Quellenzeile fasst Fragebogenangaben, exakt zitierte Dokumentversionen und
Versionen offizieller Rechtsquellen zusammen. Dokumente werden nur über
autorisierte, kurzlebige Links geöffnet; archivierte oder durch neuere
Versionen ersetzte Zitate bleiben dadurch auf ihre unveränderliche Version
bezogen. Der Browser erhält ausschließlich eine freigegebene
Ergebnisprojektion. Volltexte, Zitat-IDs, Annahmen, Widerspruchsdiagnosen,
Speicherpfade und vollständige Revisionsmetadaten bleiben serverseitig.

Bis zur Erstellung des Maßnahmenplans können Owner und Admins Findings manuell
korrigieren. Die atomare Planerstellung bestätigt den aktuellen Stand, setzt
`generated_artifacts.accepted_revision_id`, erstellt Plan und Maßnahmen und
sperrt die Gap-Analyse dauerhaft. Ein Fehler rollt alle Teilschritte zurück.

Anforderungen, Releases, KI-Läufe und Ergebnisse liegen unter anderem in
`gap_requirements`, `gap_requirement_versions`, `gap_analysis_releases`,
`ai_processing_runs`, `gap_findings`, `gap_finding_evidence`,
`gap_reassessment_drafts` und `gap_reassessment_draft_documents`.

## Maßnahmenplan

Ein Maßnahmenplan wird deterministisch beim Abschluss der aktuellen
Gap-Revision erzeugt; dafür erfolgt kein weiterer KI-Aufruf.

- Nicht oder nur teilweise erfüllte Anforderungen sowie unzureichende Evidenz
  erzeugen Aufgaben.
- Mitglieder können Status, verantwortliche Benutzer-ID und Fälligkeitsdatum
  pflegen.
- Pro Organisation existiert höchstens ein Plan mit einer festen
  Maßnahmenmenge.
- Es gibt keine Neugenerierung, keinen Planabgleich und keinen Ersatzplan.
- Status, Verantwortliche und Fälligkeitsdatum bleiben mit Audit-Historie
  bearbeitbar.

Die aktiven Daten liegen in `action_plans` und `action_plan_items`.

## Weitere Ausbaustufen

- ein fachlich vollständiger und rechtlich geprüfter NIS2-Anforderungskatalog;
- OCR und Unterstützung gescannter PDFs oder Bildnachweise;
- automatische KI-Aufrufe nach Upload oder Dokumentänderungen;
- Benachrichtigungen, Kommentare und eine komfortable Benutzer-Auswahl für
  Maßnahmenverantwortliche; und
- ein Gastzugang für die Gap-Analyse.

## Weitere Dokumentation

- [Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md)
- [Database structure](../architecture/database-structure.md)
- [Supabase security runbook](../database/supabase-security-runbook.md)
