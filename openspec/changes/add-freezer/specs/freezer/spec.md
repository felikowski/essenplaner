## Purpose

Den Überblick über vorgekochte, eingefrorene Gerichte behalten und sie wie Rezepte einplanen, ohne dafür einzukaufen.

## ADDED Requirements

### Requirement: Gefrierfach ansehen
Das System SHALL eine Seite „Gefrierfach“ anbieten, die über die Hauptnavigation erreichbar ist. Sie MUST alle Gerichte mit verfügbaren Portionen zeigen, das am längsten eingefrorene zuerst, jeweils mit Name, verfügbaren und reservierten Portionen, Einfrierdatum, Alter („seit 5 Wochen“) und Notiz. Gerichte, die länger als die eingestellte Lagerdauer eingefroren sind, MUST hervorgehoben sein. Ist ein Gericht mit einem Rezept verknüpft, MUST sein Name zur Rezeptdetailansicht verlinken.

#### Scenario: Liste
- **WHEN** „Gulasch“ (3 Portionen, seit 02.08.) und „Linsensuppe“ (4 Portionen, seit 20.09.) eingefroren sind
- **THEN** zeigt die Seite „Gulasch“ zuerst, mit „seit 2 Monaten“ hervorgehoben bei einer Lagerdauer von 2 Monaten

#### Scenario: Leer
- **WHEN** das Gefrierfach leer ist
- **THEN** erklärt die Seite, wie man Gerichte über „Einfrieren“ im Plan oder „Hinzufügen“ einträgt

### Requirement: Gericht einfrieren
Das System SHALL Gerichte auf zwei Wegen ins Gefrierfach aufnehmen: frei mit Name (1 bis 100 Zeichen), optionalem Rezept, Portionen (1 bis 99), Einfrierdatum (voreingestellt heute, nicht in der Zukunft) und Notiz (bis 200 Zeichen), oder über „Einfrieren“ an einem Rezepteintrag im Plan. Dabei sind Rezept und Name vorbelegt, das Einfrierdatum ist das Datum des Eintrags, und als Portionen die Hälfte der Eintragsportionen, aufgerundet.

#### Scenario: Aus dem Plan
- **WHEN** der Nutzer beim Montags-Eintrag „Gulasch · 8 Portionen“ „Einfrieren“ wählt und 4 Portionen bestätigt
- **THEN** enthält das Gefrierfach „Gulasch“ mit 4 Portionen und dem Datum dieses Montags

#### Scenario: Datum in der Zukunft
- **WHEN** der Nutzer ein Einfrierdatum nach heute wählt
- **THEN** zeigt das System „Das Datum darf nicht in der Zukunft liegen“

### Requirement: Portionen entnehmen
Das System SHALL es ermöglichen, eine beliebige Zahl verfügbarer Portionen eines Gerichts zu entnehmen, ohne es einzuplanen, sowie ein Gericht ganz zu entfernen. Reservierte Portionen MUST sich nicht entnehmen lassen. Ein Gericht ohne verfügbare und ohne reservierte Portionen MUST aus der Liste verschwinden.

#### Scenario: Entnehmen
- **WHEN** der Nutzer bei „Gulasch“ (3 verfügbar) 3 Portionen entnimmt
- **THEN** verschwindet „Gulasch“ aus dem Gefrierfach

#### Scenario: Mehr als verfügbar
- **WHEN** der Nutzer mehr Portionen entnehmen will, als verfügbar sind
- **THEN** verhindert das System das und nennt die verfügbare Zahl

### Requirement: Aus dem Gefrierfach einplanen
Das System SHALL im Dialog „Hinzufügen“ des Plans und auf der Seite „Gefrierfach“ das Einplanen eines Gerichts mit einer Portionenzahl bis zur Zahl der verfügbaren Portionen ermöglichen. Der Plan MUST den Eintrag mit Schneeflocke, Name und Portionen anzeigen. Die Portionen MUST damit reserviert sein. Liegt das Datum des Eintrags in der Vergangenheit, MUST die Reservierung als verbraucht gelten. Wird ein Eintrag entfernt, dessen Datum noch nicht vergangen ist, MUST die Reservierung wieder verfügbar werden. Gefrierfach-Einträge MUST nicht auf die Einkaufsliste kommen und nicht im Planungsverlauf des Rezepts zählen. Beim Speichern als Menü MUST ein Gefrierfach-Eintrag als Rezepteintrag (mit Rezept) oder als Notiz (ohne Rezept) übernommen werden.

#### Scenario: Einplanen
- **WHEN** der Nutzer „Linsensuppe“ (4 verfügbar) mit 2 Portionen für Mittwoch einplant
- **THEN** zeigt der Plan am Mittwoch „❄ Linsensuppe · 2 Portionen“, und das Gefrierfach zeigt „2 verfügbar · 2 reserviert“

#### Scenario: Wieder entfernt
- **WHEN** der Nutzer den Eintrag vor Mittwoch wieder entfernt
- **THEN** zeigt das Gefrierfach „4 verfügbar“

#### Scenario: Einkaufsliste
- **WHEN** der Nutzer eine Woche mit einem Gefrierfach-Eintrag in die Einkaufsliste übernimmt
- **THEN** kommen für diesen Eintrag keine Zutaten auf die Liste

### Requirement: Hinweis beim Planen
Das System SHALL beim Hinzufügen eines Rezepts zum Plan einen Hinweis zeigen, wenn für dieses Rezept Portionen im Gefrierfach verfügbar sind, mit der Möglichkeit, stattdessen aus dem Gefrierfach einzuplanen.

#### Scenario: Noch eingefroren
- **WHEN** der Nutzer „Gulasch“ einplant, während 3 Portionen Gulasch eingefroren sind
- **THEN** zeigt das System „3 Portionen im Gefrierfach – stattdessen auftauen?“

### Requirement: Lagerdauer
Das System SHALL die Haushalts-Einstellung `freezerWarnMonths` (1 bis 24, Standard 3) anbieten, ab der eingefrorene Gerichte hervorgehoben werden.

#### Scenario: Einstellung
- **WHEN** der Nutzer die Lagerdauer auf 6 Monate setzt
- **THEN** werden nur Gerichte hervorgehoben, die länger als 6 Monate eingefroren sind

### Requirement: Gefrierfach-API
Das System SHALL das Gefrierfach unter `/api/freezer` bereitstellen: auflisten (mit `portions`, `reserved`, `available`), anlegen, ändern, Portionen entnehmen und löschen. Im Wochenplan MUST es die Eintragsart `freezer` mit `freezerItemId`, `servings`, `text` (Name) und gegebenenfalls `recipeId` geben, die über `POST /api/entries` angelegt wird. Ein Gefrierfach-Eintrag mit mehr als den verfügbaren Portionen MUST mit 422 abgewiesen werden. Ein Gericht mit reservierten Portionen in der Zukunft MUST sich nicht löschen lassen (409).

#### Scenario: Zu viele Portionen
- **WHEN** ein Client einen Gefrierfach-Eintrag mit 5 Portionen für ein Gericht mit 4 verfügbaren anlegt
- **THEN** antwortet das System mit 422, und nichts wird reserviert

#### Scenario: Löschen mit Reservierung
- **WHEN** ein Client ein Gericht löscht, das für nächste Woche eingeplant ist
- **THEN** antwortet das System mit 409
