# menus Specification

## Purpose
Bewährte Pläne unter einem Namen speichern und mit einem Tippen in eine beliebige Woche übernehmen, damit die Familie nicht jede Woche von vorn plant.

## Requirements

### Requirement: Menüs ansehen
Das System SHALL eine Seite „Menüs“ anbieten, die über den Wochenplan erreichbar ist und alle Menüs alphabetisch mit Name, Zahl der Tage und Zahl der Rezepteinträge auflistet. Die Detailansicht eines Menüs MUST seine Tage als „Tag 1“, „Tag 2“ usw. mit den Mahlzeiten und Einträgen zeigen. Rezepteinträge MUST zur Rezeptdetailansicht verlinken. Nicht mehr verfügbare Rezepte MUST mit dem Hinweis „Nicht mehr verfügbar“ erscheinen.

#### Scenario: Liste
- **WHEN** es die Menüs „Herbstwoche“ (7 Tage, 6 Rezepte) und „Gäste-Wochenende“ (2 Tage, 4 Rezepte) gibt
- **THEN** zeigt die Seite beide alphabetisch mit diesen Angaben

#### Scenario: Keine Menüs
- **WHEN** es noch keine Menüs gibt
- **THEN** erklärt die Seite, dass Menüs über „Als Menü speichern“ im Wochenplan oder über „Neues Menü“ entstehen

### Requirement: Als Menü speichern
Das System SHALL im Wochenplan „Als Menü speichern“ anbieten. Der Nutzer MUST einen Namen eingeben und den Zeitraum wählen können, voreingestellt die angezeigte Woche. Alle Einträge des Zeitraums MUST mit Tag-Nummer, Mahlzeit, Reihenfolge, Art, Portionen und Text übernommen werden. Reste-Einträge MUST als Reste übernommen werden, sofern ihr Original im Zeitraum liegt, sonst als Notiz. Leere Tage am Ende des Zeitraums MUST entfallen.

#### Scenario: Woche speichern
- **WHEN** der Nutzer KW 40 mit fünf Abendessen und einer Notiz als „Herbstwoche“ speichert
- **THEN** gibt es ein Menü „Herbstwoche“ mit denselben Einträgen auf Tag 1 bis Tag 7

#### Scenario: Leere Woche
- **WHEN** der gewählte Zeitraum keine Einträge enthält
- **THEN** weist das System darauf hin und legt kein Menü an

### Requirement: Menü bearbeiten
Das System SHALL es ermöglichen, ein neues, leeres Menü anzulegen sowie Name (1 bis 100 Zeichen, eindeutig ohne Beachtung von Groß- und Kleinschreibung) und Beschreibung (bis 500 Zeichen) zu ändern. Einträge MUST sich wie im Wochenplan hinzufügen, entfernen, in Portionen ändern und auf einen anderen Tag oder eine andere Mahlzeit verschieben lassen. Tage MUST sich am Ende anfügen und einzeln entfernen lassen, wobei nachfolgende Tage aufrücken. Ein Menü MUST mindestens einen und höchstens 28 Tage haben. Ein Menü MUST sich nach Rückfrage löschen lassen, ohne dass sich der Plan ändert.

#### Scenario: Tag entfernen
- **WHEN** der Nutzer in einem Menü mit 7 Tagen Tag 3 entfernt
- **THEN** hat das Menü 6 Tage, und die Einträge der bisherigen Tage 4 bis 7 stehen auf Tag 3 bis 6

#### Scenario: Doppelter Name
- **WHEN** der Nutzer ein Menü „herbstwoche“ anlegen will und „Herbstwoche“ existiert
- **THEN** zeigt das System „Ein Menü mit diesem Namen gibt es schon“

#### Scenario: Löschen
- **WHEN** der Nutzer ein Menü löscht, das bereits eingeplant wurde
- **THEN** verschwindet das Menü, und die eingeplanten Einträge bleiben im Plan

### Requirement: Menü einplanen
Das System SHALL ein Menü ab einem gewählten Startdatum in den Plan übernehmen: Tag 1 auf das Startdatum, Tag 2 auf den Folgetag usw., jeweils in dieselbe Mahlzeit. Die Einträge MUST ans Ende der vorhandenen Einträge der jeweiligen Mahlzeit gestellt werden. Reste-Einträge MUST auf die eingeplante Kopie ihres Originals verweisen. Einträge mit nicht mehr verfügbaren Rezepten MUST übersprungen und danach mit Titel genannt werden. Der Vorgang MUST ganz oder gar nicht ausgeführt werden. Liegen Einträge in Mahlzeiten, die im Plan ausgeblendet sind, MUST das System darauf hinweisen.

#### Scenario: Ab Montag
- **WHEN** der Nutzer „Herbstwoche“ ab Montag, 12.10.2026 einplant
- **THEN** stehen die Einträge von Tag 1 am 12.10., die von Tag 7 am 18.10., und die App zeigt KW 42

#### Scenario: Belegte Tage
- **WHEN** am 12.10. bereits ein Abendessen geplant ist
- **THEN** steht das Abendessen aus dem Menü danach

#### Scenario: Rezept entfernt
- **WHEN** ein Rezept des Menüs nicht mehr verfügbar ist
- **THEN** werden die übrigen Einträge eingeplant, und das System meldet „Übersprungen: Gemüselasagne“

### Requirement: Menü-API
Das System SHALL Menüs unter `/api/menus` bereitstellen: auflisten, lesen, anlegen (leer oder aus einem Zeitraum des Plans mit `from` und `to`), Name und Beschreibung ändern, löschen, Einträge anlegen, ändern und löschen, Tage anfügen und entfernen sowie unter `POST /api/menus/{id}/apply` mit `{"start": "<Datum>"}` einplanen. Die Antwort auf das Einplanen MUST die betroffenen Wochenpläne und die übersprungenen Rezepttitel enthalten. Ungültige Eingaben MUST mit 400 oder 422 beantwortet werden, wie bei Planeinträgen.

#### Scenario: Einplanen über die API
- **WHEN** ein Client `POST /api/menus/{id}/apply` mit `{"start": "2026-10-12"}` für ein Menü mit 7 Tagen sendet
- **THEN** antwortet das System mit 200, den Plänen von `2026-W42` und `"skipped": []`

#### Scenario: Unbekanntes Menü
- **WHEN** ein Client ein nicht existierendes Menü einplant
- **THEN** antwortet das System mit 404
