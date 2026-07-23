# Design-Grundlage Dokumentenverwaltung

Status: am 23.07.2026 an den einmaligen Gap-Analyse-Lebenszyklus angepasst.

## Produktgrenze

Die Dokumentenseite ist eine allgemeine Dokumentenverwaltung der Organisation.
Sie unterstützt:

- Upload von PDF, DOCX, TXT und Markdown;
- Suche nach Titel und Dateiname;
- Extraktions- und Indexierungsstatus;
- unveränderliche Versionshistorie und Upload neuer Versionen;
- Archivierung und Anzeige archivierter Dokumente.

Die Seite zeigt und steuert keine Beziehungen zur Gap-Analyse oder zum
Maßnahmenplan. Sie enthält keine Auswahl-Checkboxen für Analysen, keine
Entwurfsaktionen und keine Nutzungskennzeichen für Ergebnisse oder Maßnahmen.

## Verwendung in der Gap-Analyse

Vor der einmaligen Generierung kann der separate Schritt **Dokumente
auswählen** geeignete aktuelle Versionen aus der Bibliothek lesen. Die Auswahl
ist optional und gehört ausschließlich zu den Eingaben der ersten Generierung.

Nach erfolgreicher Generierung sind die exakten `document_version`-Quellen an
die Gap-Revision gepinnt. Die separate Ansicht **Verwendete Eingaben** liest
diese Quellen direkt. Eine neue Dokumentversion oder spätere Archivierung
verändert den Schnappschuss nicht.

Die allgemeine Dokumentenseite führt keine aufwendige Nutzungs-Union-Abfrage
aus, weil sie diese Beziehungen nicht darstellt. Interne Quelldatensätze
bleiben für Audit und Eingabeschnappschuss erhalten.

## Sicherheit und Speicherung

Dateien bleiben im Bucket `organization-evidence` privat. Serverautorisierte
Upload-Sessions prüfen Organisation, Größe, MIME-Typ, Speicherpfad und
Inhaltshash, bevor eine unveränderliche Version entsteht. Extraktion, Chunks
und Embeddings werden getrennt von der Originalversion verwaltet.

Organisationszugriff und Schreibrechte werden serverseitig geprüft.
Archivierung löscht weder unveränderliche Versionen noch zitierte Evidenz.

Siehe [Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md).
