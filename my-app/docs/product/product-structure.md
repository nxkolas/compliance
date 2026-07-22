# Produktstruktur: NIS2 Compliance Checker

Status: aktueller Produkt- und Implementierungsstand vom 17.07.2026.

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

Die Dokumentenbibliothek ist ein eigenständiges Organisationsmodul. Sie dient
als gemeinsame Evidenzquelle für Gap-Neubewertungen.

- Unterstützt werden Text-PDF, DOCX, TXT und Markdown bis 10 MB.
- Ein Dokument besitzt unveränderliche Versionen und genau einen aktuellen
  Versionszeiger.
- Direkte Upload-Sessions verifizieren die private Speicherung; unveränderliche
  Versionen werden anschließend verarbeitet und indexiert.
- Neue Versionen ersetzen historische Versionen nicht.
- Archivierung entfernt ein Dokument aus zukünftigen Auswahlen, löscht aber
  keine bereits zitierte Evidenz.
- Nutzungskennzeichen zeigen, ob eine Version noch nicht bewertet wurde, in
  einem Entwurf oder einer Kandidatenrevision steckt, genehmigte Evidenz ist
  oder den aktiven Maßnahmenplan unterstützt.

Die privaten Quelldateien liegen im Supabase-Bucket `organization-evidence`.
Metadaten und Suchdaten liegen in `documents`, `document_versions`,
`document_extractions`, `document_chunks`, `document_embedding_generations` und
`document_chunk_embeddings`.

## Gap-Analyse

Die Gap-Analyse ist ein KI-gestützter, aber serverseitig begrenzter
Organisationsworkflow. Sie ist ein eigener Prozess neben dem deterministischen
Betroffenheitscheck.

1. Eine aktive Gap-Release und ein kompatibles genehmigtes
   Betroffenheitscheck-Ergebnis sind erforderlich.
2. Der Nutzer speichert den Gap-Fragebogen als neue unveränderliche
   Assessment-Revision.
3. Er bereitet einen gemeinsamen Neubewertungsentwurf mit den vollständigen
   Dokumentversionen vor.
4. Erst die ausdrückliche Generierung sperrt die Eingaben und stellt einen
   dauerhaften Worker-Job in die Warteschlange.
5. Der Grounding Gateway recherchiert ausschließlich in gepinnten, freigegebenen
   Rechtsquellen und Organisationsevidenz. Die KI darf weder Anwendbarkeit noch
   Priorität bestimmen und jede Rechtsbehauptung benötigt ein gültiges Zitat.
6. Owner/Admins korrigieren und genehmigen die Kandidatenrevision.

Das zuletzt genehmigte Ergebnis bleibt über
`generated_artifacts.accepted_revision_id` verbindlich, während
`current_revision_id` eine neuere Arbeits- oder Kandidatenrevision zeigen kann.
Dadurch überschreibt eine Neubewertung das akzeptierte Ergebnis nicht vorzeitig.

Anforderungen, Releases, KI-Läufe und Ergebnisse liegen unter anderem in
`gap_requirements`, `gap_requirement_versions`, `gap_analysis_releases`,
`ai_processing_runs`, `gap_findings`, `gap_finding_evidence`,
`gap_reassessment_drafts` und `gap_reassessment_draft_documents`.

## Maßnahmenplan

Ein Maßnahmenplan wird deterministisch aus einer genehmigten Gap-Revision
erzeugt; dafür erfolgt kein weiterer KI-Aufruf.

- Nicht oder nur teilweise erfüllte Anforderungen sowie unzureichende Evidenz
  erzeugen Aufgaben.
- Mitglieder können Status, verantwortliche Benutzer-ID und Fälligkeitsdatum
  pflegen.
- Nach einer neu genehmigten Gap-Revision bleibt der aktive Plan zunächst
  vollständig nutzbar.
- Ein persistierter Planabgleich ordnet alte und neue Findings über stabile
  Anforderungsidentitäten zu.
- Unveränderte Aufgaben werden automatisch übernommen. Schließung,
  Wiedereröffnung, Folgemaßnahmen, geänderte Anforderungen und entfernte
  Anforderungen können eine Owner/Admin-Entscheidung mit Begründung verlangen.
- Erst die ausdrückliche Aktivierung ersetzt den aktiven Plan atomar. Der
  Vorgänger und seine Maßnahmen bleiben als schreibgeschützte Historie erhalten.

Die Daten liegen in `action_plans`, `action_plan_items`,
`action_plan_reconciliations` und `action_plan_item_reconciliations`.

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
