## MODIFIED Requirements

### Requirement: Wochenansicht pro Kalenderwoche
Das System SHALL einen Wochenplan für genau eine Kalenderwoche nach ISO 8601 anzeigen, von Montag bis Sonntag. Jeder Tag MUST mit deutschem Wochentagsnamen und Datum angezeigt werden und darunter die sichtbaren Mahlzeiten mit ihren Einträgen. Ist nur eine Mahlzeit sichtbar, MUST ihre Überschrift entfallen. Beim Öffnen der App MUST die aktuelle Kalenderwoche angezeigt werden.

#### Scenario: App öffnen
- **WHEN** ein Nutzer die App am Mittwoch, 30.09.2026 öffnet
- **THEN** zeigt das System die KW 40/2026 mit den Tagen Montag 28.09. bis Sonntag 04.10.

#### Scenario: Kalenderwoche wird angezeigt
- **WHEN** eine Woche angezeigt wird
- **THEN** sind Kalenderwoche und Jahr sichtbar, zum Beispiel „KW 40 · 2026“

#### Scenario: Mehrere Mahlzeiten
- **WHEN** Mittagessen und Abendessen sichtbar sind
- **THEN** zeigt jeder Tag die Abschnitte „Mittagessen“ und „Abendessen“ mit ihren Einträgen

### Requirement: Geplantes Rezept öffnen
Das System SHALL für jeden Rezepteintrag und jeden Reste-Eintrag einen direkten Weg zur Detailansicht des Rezepts anbieten.

#### Scenario: Vom Plan zum Rezept
- **WHEN** der Nutzer auf einen Rezepteintrag tippt
- **THEN** öffnet das System die Detailansicht dieses Rezepts

### Requirement: Gemeinsamer, dauerhafter Plan
Das System SHALL alle Einträge im Wochenplan dauerhaft speichern, sodass alle Nutzer denselben Plan sehen. Eine Änderung MUST nach dem Neuladen der Seite und auf anderen Geräten sichtbar sein. Bestehende Zuordnungen aus der Zeit vor Mahlzeiten MUST als Abendessen erhalten bleiben.

#### Scenario: Anderes Gerät
- **WHEN** ein Nutzer am Handy für Freitag ein Rezept hinzufügt und ein anderer Nutzer danach die Woche am Laptop öffnet
- **THEN** sieht der zweite Nutzer für Freitag dieses Rezept

#### Scenario: Neuladen
- **WHEN** der Nutzer nach dem Hinzufügen die Seite neu lädt
- **THEN** ist der Eintrag weiterhin vorhanden

#### Scenario: Bestehender Plan
- **WHEN** vor dieser Änderung für den 02.10.2026 „Linsensuppe“ geplant war
- **THEN** steht „Linsensuppe“ danach als Abendessen am 02.10.2026

## ADDED Requirements

### Requirement: Einträge planen
Das System SHALL es ermöglichen, einer Mahlzeit eines Tages beliebig viele Einträge hinzuzufügen und einzelne Einträge zu entfernen. Ein Eintrag MUST eine der Arten Rezept, Notiz oder Einzelzutat haben. Die Reihenfolge der Einträge einer Mahlzeit MUST der Reihenfolge des Hinzufügens entsprechen.

#### Scenario: Rezept hinzufügen
- **WHEN** der Nutzer beim Abendessen eines leeren Tages „Hinzufügen“ tippt und ein Rezept wählt
- **THEN** zeigt die Mahlzeit den Titel dieses Rezepts

#### Scenario: Beilage ergänzen
- **WHEN** der Nutzer bei einem Abendessen mit „Hähnchen-Curry“ zusätzlich „Basmatireis“ hinzufügt
- **THEN** zeigt die Mahlzeit beide Einträge in dieser Reihenfolge

#### Scenario: Notiz
- **WHEN** der Nutzer beim Samstag die Notiz „Essen bei Oma“ hinzufügt
- **THEN** zeigt der Tag die Notiz als Eintrag ohne Link zu einem Rezept

#### Scenario: Einzelzutat
- **WHEN** der Nutzer beim Abendessen die Einzelzutat „1 Baguette“ hinzufügt
- **THEN** zeigt die Mahlzeit „1 Baguette“ als Zutat

#### Scenario: Eintrag entfernen
- **WHEN** der Nutzer bei einem Eintrag „Entfernen“ wählt
- **THEN** verschwindet nur dieser Eintrag, andere Einträge des Tages bleiben

#### Scenario: Auswahl abbrechen
- **WHEN** der Nutzer den Dialog zum Hinzufügen ohne Auswahl schließt
- **THEN** bleibt der Tag unverändert

### Requirement: Portionen pro Eintrag
Das System SHALL für jeden Rezepteintrag eine Portionenzahl von 1 bis 99 speichern. Beim Hinzufügen MUST sie mit den Portionen des Rezepts vorbelegt sein. Hat das Rezept keine Portionen, MUST der Eintrag ohne Portionenzahl gespeichert werden. Der Nutzer MUST die Portionen eines Eintrags ändern können, ohne das Rezept zu ändern. Weicht die Zahl vom Rezept ab, MUST der Eintrag sie anzeigen.

#### Scenario: Für mehr Personen
- **WHEN** der Nutzer bei einem Eintrag „Linsensuppe“ (Rezept: 6 Portionen) die Portionen auf 8 setzt
- **THEN** zeigt der Eintrag „8 Portionen“, und das Rezept hat weiterhin 6 Portionen

### Requirement: Reste einplanen
Das System SHALL es ermöglichen, zu einem Rezepteintrag einen Reste-Eintrag an einem anderen Tag oder in einer anderen Mahlzeit anzulegen. Ein Reste-Eintrag MUST auf den ursprünglichen Eintrag verweisen, als „Reste“ gekennzeichnet sein und das Datum des Originals nennen. Wird der ursprüngliche Eintrag entfernt, MUST der Reste-Eintrag als Notiz mit dem Rezepttitel erhalten bleiben.

#### Scenario: Reste am nächsten Tag
- **WHEN** der Nutzer beim Montags-Abendessen „Gulasch“ „Reste einplanen“ wählt und Dienstag Mittag auswählt
- **THEN** zeigt Dienstag Mittag „Reste: Gulasch (von Mo 28.09.)“

#### Scenario: Original entfernt
- **WHEN** der Nutzer das Montags-Gulasch entfernt
- **THEN** bleibt am Dienstag die Notiz „Reste: Gulasch“ stehen

### Requirement: Eintrag verschieben
Das System SHALL es ermöglichen, einen Eintrag auf einen anderen Tag oder in eine andere Mahlzeit zu verschieben. Ziel MUST jedes Datum sein können, auch in einer anderen Woche. Der Eintrag MUST dabei seine Art, seine Portionen und seine Reste-Verweise behalten.

#### Scenario: Auf morgen verschieben
- **WHEN** der Nutzer das Abendessen vom Mittwoch auf Donnerstag verschiebt
- **THEN** steht der Eintrag am Donnerstag, und der Mittwoch ist leer

### Requirement: Woche kopieren
Das System SHALL es ermöglichen, alle Einträge einer Woche in eine andere Woche zu kopieren, jeweils auf denselben Wochentag und dieselbe Mahlzeit. Hat die Zielwoche bereits Einträge, MUST der Nutzer zwischen „Ergänzen“ und „Ersetzen“ wählen. Reste-Einträge MUST so kopiert werden, dass sie auf die Kopie ihres Originals verweisen. Rezepte, die nicht mehr verfügbar sind, MUST übersprungen werden, und das System MUST nennen, wie viele Einträge übersprungen wurden.

#### Scenario: In leere Woche
- **WHEN** der Nutzer KW 40 nach KW 42 kopiert und KW 42 leer ist
- **THEN** enthält KW 42 dieselben Einträge an denselben Wochentagen

#### Scenario: Zielwoche belegt
- **WHEN** KW 42 bereits Einträge hat und der Nutzer „Ersetzen“ wählt
- **THEN** enthält KW 42 danach nur die kopierten Einträge

### Requirement: Planungsverlauf
Das System SHALL in der Detailansicht eines Rezepts anzeigen, wann es zuletzt geplant war und wie oft insgesamt. Reste-Einträge MUST dabei nicht mitzählen. Auf Wunsch MUST die Liste aller Daten aufklappbar sein, neueste zuerst, jeweils mit Link zur Woche.

#### Scenario: Verlauf
- **WHEN** „Linsensuppe“ am 02.10. und am 16.10.2026 geplant war und der Nutzer das Rezept öffnet
- **THEN** zeigt die Detailansicht „Zuletzt geplant: Fr 16.10.2026 · insgesamt 2-mal“

#### Scenario: Nie geplant
- **WHEN** ein Rezept noch nie geplant war
- **THEN** zeigt die Detailansicht „Noch nie geplant“

### Requirement: Plan drucken
Das System SHALL für den Wochenplan eine Druckansicht bereitstellen, die auf eine A4-Seite im Querformat passt. Navigation und Bedienelemente MUST dabei ausgeblendet sein.

#### Scenario: Drucken
- **WHEN** der Nutzer in der Wochenansicht „Drucken“ wählt
- **THEN** öffnet sich der Druckdialog mit einer Tabelle aus sieben Tagen und den sichtbaren Mahlzeiten ohne Navigation

## REMOVED Requirements

### Requirement: Rezept einem Tag zuordnen
**Reason**: Ein Tag hat nicht mehr höchstens ein Rezept, sondern mehrere Mahlzeiten mit beliebig vielen Einträgen.
**Migration**: Ersetzt durch „Einträge planen“. Bestehende Zuordnungen werden als Abendessen übernommen (siehe „Gemeinsamer, dauerhafter Plan“). Ersetzen bedeutet jetzt: Eintrag entfernen und neuen hinzufügen.
