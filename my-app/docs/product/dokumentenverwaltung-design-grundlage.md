# Dokumentenverwaltung: Produktgrundlage für das UI-Design

Status: bestätigte Produktgrundlage für das Redesign. Dieses Dokument
beschreibt, welche Informationen und fachlichen Bedeutungen die
Dokumentenverwaltung vermitteln muss. Es beschreibt weder die derzeitige UI
noch gibt es Layouts, Komponenten, Icons, Bezeichnungen oder Interaktionsmuster
vor.

## Zweck

Die Dokumentenverwaltung ist die gemeinsame Nachweisbibliothek einer
Organisation. Nutzer müssen dort verstehen können:

- welche Organisationsdokumente vorhanden sind;
- welche Dateiversion die neueste ist;
- welche älteren Versionen weiterhin relevant sind;
- ob eine Version bereits für Compliance-Arbeit verwendet wurde;
- ob neuere Nachweise noch nicht in den genehmigten Compliance-Stand
  eingeflossen sind; und
- wie Dokumente zu einer neuen Gap-Analyse oder Neubewertung beitragen können.

Die Seite dient sowohl der Verwaltung von Dokumenten als auch als Einstieg, um
diese Dokumente als Nachweise zu verwenden. Das Hochladen oder Auswählen eines
Dokuments ist noch keine Compliance-Bewertung.

## Umfang und Gestaltungsfreiheit

Diese Grundlage definiert:

- die Beziehung zwischen Dokumenten, Gap-Analyse und Maßnahmenplan;
- die Bedeutung der Dokument- und Versionszustände;
- die Informationen, die Nutzer verstehen können müssen; und
- die Fähigkeiten, die die Dokumentenverwaltung unterstützen muss.

Der UI-Designer entscheidet, wie diese Informationen strukturiert und
dargestellt werden. Dieses Dokument verlangt keine bestimmte Tabelle, Karte,
Statusanzeige, kein bestimmtes Icon, Dialogfenster, Filter- oder
Navigationsmuster und keine vorgegebene Formulierung.

Bewusst nicht Bestandteil dieser Grundlage sind:

- Aufbau und Verhalten der derzeitigen UI;
- technische Abläufe der Dokumentverarbeitung;
- ein detailliertes Redesign des Gap-Analyse-Workflows; und
- eine direkte Navigation von einem Dokument zu einer bestimmten Gap-Analyse
  oder einem bestimmten Maßnahmenplan.

## Zentrales Fachmodell

### Dokument

Ein Dokument ist die beständige Identität einer realen organisatorischen
Quelle in der Bibliothek, beispielsweise einer
Informationssicherheitsrichtlinie.

Sein Titel ist ein bearbeitbares organisatorisches Merkmal. Eine Umbenennung
erzeugt keine neue Version und verändert die Compliance-Beziehungen des
Dokuments nicht.

### Dokumentversion

Eine Version ist eine unveränderliche hochgeladene Datei, die zu einem Dokument
gehört. Geänderte Dateiinhalte erzeugen eine neue Version desselben Dokuments,
wenn sie weiterhin dieselbe reale organisatorische Quelle darstellen.

Eine inhaltlich eigenständige Quelle ist ein neues Dokument und keine neue
Version.

Das Hochladen einer neuen Version:

- erweitert die bestehende Versionshistorie;
- macht den neuen Upload zur neuesten verfügbaren Version für zukünftige
  Arbeit;
- erhält alle älteren Versionen;
- ersetzt keine Nachweise, die von einer bestehenden Gap-Analyse verwendet
  werden; und
- verändert den aktiven Maßnahmenplan nicht.

„Neueste Version“ darf nicht mit „derzeit für Compliance verwendete Version“
gleichgesetzt werden. Dabei kann es sich um unterschiedliche Versionen handeln.

### Unveränderliche Compliance-Stände

Eine Gap-Analyse verwendet eine genaue Zusammenstellung von Dokumentversionen.
Sobald eine Analyse generiert wurde, verändert sich dieser Nachweisstand nicht
mehr.

Die genehmigte Gap-Analyse ist das maßgebliche Bewertungsergebnis. Das
Hochladen einer Datei, das Erstellen einer neuen Version oder das Auswählen von
Nachweisen verändert sie nicht rückwirkend.

Der aktive Maßnahmenplan basiert auf einer genehmigten Gap-Analyse. Er wird
daher indirekt von genau den Dokumentversionen unterstützt, die in dieser
Gap-Analyse verwendet wurden. Dokumente werden Maßnahmen nicht direkt
zugeordnet.

```text
Organisationsdokument
        |
        v
genaue Dokumentversion
        |
        v
genehmigte Gap-Analyse und ihre Findings
        |
        v
aktiver Maßnahmenplan
```

Der aktive Maßnahmenplan kann vorübergehend einen älteren Stand als die
neueste genehmigte Gap-Analyse abbilden, solange eine Planaktualisierung noch
aussteht. Deshalb kann die Version, die den Plan unterstützt, von der Version
abweichen, die in der aktuellen genehmigten Gap-Analyse verwendet wird.

## Statusmodell

Die Dokumentinformationen dürfen nicht zu einem einzigen, mehrdeutigen
Gesamtstatus zusammengefasst werden. Zwei voneinander unabhängige Dimensionen
sind relevant.

### 1. Dokumentlebenszyklus

- **Aktiv:** steht für die Dokumentenverwaltung und zukünftige Bewertungen zur
  Verfügung.
- **Archiviert:** steht für zukünftige Bewertungen nicht mehr zur Auswahl,
  bleibt aber mit vollständiger Historie und bestehenden
  Compliance-Beziehungen erhalten.

Ein archiviertes Dokument kann wiederhergestellt werden. Dabei bleiben
Dokumentidentität und Versionshistorie erhalten. Die Wiederherstellung erzeugt
weder ein neues Dokument noch verändert sie ein genehmigtes Ergebnis.

### 2. Compliance-Beziehung

Compliance-Beziehungen gelten für genaue Versionen und nicht unspezifisch für
das Dokument als Ganzes.

- **Noch nicht bewertet:** Die Version ist in der Bibliothek verfügbar, wurde
  aber noch nicht für Compliance-Arbeit verwendet.
- **Für Neubewertung ausgewählt:** Die Version gehört zu den Nachweisen, die für
  eine zukünftige Gap-Analyse vorbereitet werden. Die Auswahl macht sie nicht
  maßgeblich.
- **In der aktuellen genehmigten Gap-Analyse verwendet:** Die maßgebliche
  Bewertung stützt sich auf genau diese Version.
- **Unterstützt den aktiven Maßnahmenplan:** Der Plan basiert auf einer
  Gap-Analyse, die sich auf genau diese Version gestützt hat.

Eine Version kann gleichzeitig mehrere Beziehungen haben. Insbesondere kann
die von der genehmigten Gap-Analyse verwendete Version zugleich den aktiven
Maßnahmenplan unterstützen.

„Noch nicht bewertet“ ist der Ausgangszustand, wenn keine spezifischere
Workflow-Beziehung besteht. Eine für die Neubewertung ausgewählte Version ist
weiterhin nicht maßgeblich, ihre Auswahl ist aber die aussagekräftigere
Beziehung.

Das Dokument als Ganzes kann die Beziehungen seiner Versionen zusammenfassen.
Die genaue Bedeutung ergibt sich jedoch aus der Versionshistorie.

### Wichtiger abgeleiteter Zustand: Neuere Nachweise sind noch nicht bewertet

Das Design muss verständlich machen, wenn:

- eine ältere Version von der genehmigten Gap-Analyse oder dem aktiven
  Maßnahmenplan verwendet wird; und
- eine neuere Version hochgeladen wurde, aber noch nicht Teil dieses
  genehmigten Compliance-Stands ist.

Dieser Zustand ist wichtiger als die bloße Anzeige der höchsten Versionsnummer.
Er zeigt dem Nutzer, dass die Bibliothek neuere organisatorische Nachweise
enthält, während das maßgebliche Compliance-Ergebnis weiterhin auf älteren
Nachweisen beruht.

### Vorläufige Unterscheidung von Arbeitsständen

Der zukünftige Gap-Analyse-Workflow kann unterscheiden zwischen:

- Nachweisen, die ausgewählt wurden, während eine Bewertung noch vorbereitet
  wird; und
- Nachweisen, die bereits zur Generierung einer neuen, noch nicht geprüften
  oder genehmigten Bewertung verwendet wurden.

Diese Unterscheidung kann hilfreich sein, weil sich die erste
Nachweiszusammenstellung noch ändern kann, während die zweite bereits feststeht.
Der Gap-Analyse-Workflow wird sich voraussichtlich jedoch noch ändern. Deshalb
ist dies ein vorläufiger Gestaltungsaspekt und keine beständige Anforderung an
die Dokumentenverwaltung.

Die dauerhafte Regel lautet: Nicht genehmigte Arbeit darf nicht als Bestandteil
der aktuellen genehmigten Gap-Analyse dargestellt werden.

## Informationen, die die Seite vermitteln muss

Der Designer kann entscheiden, auf welcher Ebene und an welcher Stelle
Informationen erscheinen. Nutzer müssen jedoch Folgendes verstehen können.

### Für jedes Dokument

- den organisatorischen Titel;
- ob es aktiv oder archiviert ist;
- welche Version die neueste ist;
- eine kompakte Zusammenfassung seiner Compliance-Beziehungen;
- ob eine ältere Version weiterhin den genehmigten Compliance-Stand
  unterstützt; und
- ob neuere Nachweise vorhanden sind, die noch nicht in diesen Stand
  eingeflossen sind.

### Für jede Version

Mindestens:

- Versionsnummer;
- ursprünglicher Dateiname;
- Upload-Datum;
- hochladende Person; und
- die jeweils zutreffenden Compliance-Beziehungen.

Datei-Hashes, Speicherorte, Extraktionsdetails, Suchdaten, Modellnamen oder
andere technische Verarbeitungsinformationen müssen nicht dargestellt werden.

## Fähigkeiten im Umfang

Die Dokumentenverwaltung muss Folgendes ermöglichen:

- ein oder mehrere neue Dokumente hochzuladen;
- eine neue Version zu einem bestehenden Dokument hinzuzufügen;
- den organisatorischen Titel eines Dokuments zu bearbeiten;
- die Versionshistorie eines Dokuments einzusehen;
- ein aktives Dokument zu archivieren;
- archivierte Dokumente aufzurufen und wiederherzustellen;
- Dokumente als Nachweise für die Gap-Analyse auszuwählen; und
- mit ausgewählten Dokumenten und bestehender Bewertungsarbeit eine neue
  Gap-Analyse oder Neubewertung anzustoßen.

Die genaue Übergabe an die Gap-Analyse ist Gegenstand eines späteren Redesigns.
Die beständige Produktgrenze lautet:

- Nachweise können hinzugefügt werden, solange neue Bewertungsarbeit vorbereitet
  wird;
- ein bereits generierter oder genehmigter Nachweisstand wird niemals
  verändert; und
- später hinzugefügte Nachweise starten neue Bewertungsarbeit oder fließen in
  diese ein.

## Upload-Verhalten

Der Upload soll ausschließlich in Begriffen beschrieben werden, die für den
Nutzer relevant sind:

1. Der Nutzer wählt eine oder mehrere Dateien aus.
2. Die Dateien werden hochgeladen.
3. Erfolgreiche Uploads stehen als Dokumente oder Versionen zur Verfügung.
4. Fehlgeschlagene Dateien werden als fehlgeschlagene Upload-Versuche
   gemeldet und bleiben nicht als Dokumenteinträge bestehen.

Bei einem Batch-Upload bleiben erfolgreiche Dateien erfolgreich, auch wenn eine
andere Datei fehlschlägt.

Technische Zwischenschritte sind kein Dokumentstatus und dürfen nicht Teil der
normalen Sprache der Dokumentenverwaltung werden. Nutzer müssen insbesondere
nichts über Indexierung, Extraktion, Chunks, Embeddings, Speicherung oder
interne Verarbeitungsgenerationen wissen.

## Beispiele zur Versionierung

### Neuere Version wartet auf Bewertung

```text
Informationssicherheitsrichtlinie

Version 2
  In der aktuellen genehmigten Gap-Analyse verwendet
  Unterstützt den aktiven Maßnahmenplan

Version 3
  Neueste Version
  Noch nicht bewertet
```

Das genehmigte Ergebnis und der Maßnahmenplan bleiben gültige historische
Stände. Version 3 steht für eine Neubewertung zur Verfügung, hat aber keinen der
beiden Stände stillschweigend verändert.

### Die genehmigte Gap-Analyse ist neuer als der aktive Maßnahmenplan

```text
Informationssicherheitsrichtlinie

Version 2
  Unterstützt den aktiven Maßnahmenplan

Version 3
  Neueste Version
  In der aktuellen genehmigten Gap-Analyse verwendet
```

Dieser Zustand ist gültig, solange der Maßnahmenplan noch nicht auf Grundlage
der neuen genehmigten Gap-Analyse aktualisiert wurde.

### Nachweis für zukünftige Arbeit ausgewählt

```text
Informationssicherheitsrichtlinie

Version 2
  In der aktuellen genehmigten Gap-Analyse verwendet
  Unterstützt den aktiven Maßnahmenplan

Version 3
  Neueste Version
  Für Neubewertung ausgewählt
```

Die Auswahl drückt eine Absicht aus. Sie bedeutet nicht, dass die neue Version
bereits die maßgebliche Bewertung oder den Maßnahmenplan beeinflusst hat.

## Regeln zu Lebenszyklus und Aufbewahrung

- Normale Nutzer archivieren Dokumente, anstatt sie dauerhaft zu löschen.
- Die Archivierung verhindert die zukünftige Auswahl, entfernt aber nicht die
  Versionshistorie.
- Bestehende Nachweise der Gap-Analyse und die Unterstützung des
  Maßnahmenplans bleiben nach der Archivierung erhalten.
- Eine Wiederherstellung macht dasselbe Dokument erneut verfügbar, ohne die
  Historie umzuschreiben.
- Die dauerhafte Löschung ist eine außergewöhnliche Verwaltungs- oder
  Aufbewahrungsfrage und liegt außerhalb dieser Designgrundlage.

## Berechtigungskontext

Die verfügbaren Aktionen können an die Organisationsrollen angepasst werden:

- Owner, Administratoren und Mitglieder können Dokumente beitragen und
  Bewertungsnachweise vorbereiten;
- Auditoren haben ausschließlich Lesezugriff; und
- die Genehmigung von Gap-Analyse-Ergebnissen und die Aktivierung aktualisierter
  Maßnahmenpläne sind gesonderte privilegierte Aktionen außerhalb der
  Dokumentenverwaltung.

Berechtigungen beeinflussen, welche Aktionen verfügbar sind, nicht aber die
Bedeutung der Dokumentstatus.

## Prüffragen für das Design

Ein Design erfüllt diese Grundlage, wenn ein Nutzer folgende Fragen beantworten
kann:

1. Was ist die neueste Version dieses Dokuments?
2. Ist diese neueste Version bereits in der genehmigten Gap-Analyse
   berücksichtigt?
3. Welche genaue Version unterstützt den aktiven Maßnahmenplan?
4. Gibt es neuere Nachweise, die noch auf eine Bewertung warten?
5. Ist eine Version lediglich für zukünftige Arbeit ausgewählt oder bereits
   maßgeblich?
6. Was ist mit älteren Versionen geschehen?
7. Was verändert sich durch das Hochladen einer neuen Version – und was nicht?
8. Kann dieses Dokument weiterhin für zukünftige Bewertungsarbeit verwendet
   werden?

Die Antworten können auf jede geeignete Weise visuell vermittelt werden. Diese
Grundlage verlangt Klarheit der Bedeutung und keine bestimmte UI-Lösung.

## Verwandte Dokumentation

- [Englische Fassung dieser Designgrundlage](./document-management-design-baseline.md)
- [Current Gap-Analysis Workflow](./gap-analysis-current-workflow.md)
  beschreibt den implementierten operativen Ablauf und bekannte technische
  Einschränkungen.
- [Document Management, Gap Reassessment, and Plan Reconciliation](../plans/document-management-reassessment-and-plan-reconciliation.md)
  dokumentiert das zugrunde liegende Implementierungsdesign.
