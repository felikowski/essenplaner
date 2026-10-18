# meal-plan Specification

## Purpose

Die Familie legt pro Kalenderwoche fest, welches Rezept es an welchem Tag zum Abendessen gibt, und sieht den Plan auf einen Blick.

## Requirements

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

### Requirement: Zwischen Wochen wechseln
Das System SHALL es ermöglichen, zur vorherigen und zur nächsten Kalenderwoche zu wechseln und von jeder Woche aus direkt zur aktuellen Woche zurückzuspringen. Jahreswechsel MUST korrekt nach ISO 8601 behandelt werden.

#### Scenario: Nächste Woche
- **WHEN** der Nutzer in KW 40/2026 „nächste Woche“ wählt
- **THEN** zeigt das System KW 41/2026 mit den dort geplanten Rezepten

#### Scenario: Jahreswechsel
- **WHEN** der Nutzer in KW 53/2026 „nächste Woche“ wählt
- **THEN** zeigt das System KW 1/2027, beginnend am Montag, 04.01.2027

#### Scenario: Zurück zu heute
- **WHEN** der Nutzer eine andere als die aktuelle Woche ansieht und „Heute“ wählt
- **THEN** zeigt das System die aktuelle Kalenderwoche

### Requirement: Geplantes Rezept öffnen
Das System SHALL für jeden Rezepteintrag und jeden Reste-Eintrag einen direkten Weg zur Detailansicht des Rezepts anbieten. Weichen die Portionen des Eintrags von denen des Rezepts ab, MUST die Detailansicht mit diesen Portionen geöffnet werden. Ein Reste-Eintrag MUST dafür die Portionen seines Originaleintrags verwenden, sofern dieser in der angezeigten Woche liegt.

#### Scenario: Vom Plan zum Rezept
- **WHEN** der Nutzer auf einen Rezepteintrag tippt
- **THEN** öffnet das System die Detailansicht dieses Rezepts

#### Scenario: Abweichende Portionen
- **WHEN** der Nutzer auf den Eintrag „Linsensuppe · 8 Portionen“ (Rezept: 6) tippt
- **THEN** öffnet das System die Detailansicht mit 8 gewählten Portionen

#### Scenario: Reste
- **WHEN** der Nutzer auf „Reste: Linsensuppe“ tippt und der Originaleintrag derselben Woche 8 Portionen hat
- **THEN** öffnet das System die Detailansicht mit 8 gewählten Portionen

### Requirement: Lade- und Fehlerzustände
Das System SHALL anzeigen, dass Daten geladen werden. Wenn das Laden oder Speichern fehlschlägt, MUST eine verständliche Fehlermeldung erscheinen, ohne dass der Rest der Ansicht verschwindet.

#### Scenario: Speichern schlägt fehl
- **WHEN** das Zuordnen eines Rezepts fehlschlägt
- **THEN** zeigt das System eine Fehlermeldung, und der Tag zeigt weiterhin seinen vorherigen Zustand

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

### Requirement: Rezept aus dem Katalog einplanen
Das System SHALL es ermöglichen, ein Rezept von der Rezeptliste und von der Detailansicht aus über einen Dialog „Einplanen“ direkt einem Tag und einer Mahlzeit im Wochenplan hinzuzufügen. Der Dialog MUST die sieben Tage einer Kalenderwoche zur Auswahl anbieten, mit der aktuellen Woche beginnen, heute vorauswählen und das Wechseln zur vorigen und nächsten Woche erlauben. Zusätzlich MUST jedes beliebige Datum wählbar sein. Zur Wahl MUST nur die in den Haushaltseinstellungen sichtbaren Mahlzeiten stehen. Die Mahlzeit MUST mit Abendessen vorbelegt sein, sofern diese Mahlzeit in den Haushaltseinstellungen sichtbar ist, sonst mit der ersten sichtbaren Mahlzeit. Die Portionen MUST mit den in der Detailansicht gewählten Portionen vorbelegt sein, sonst mit denen des Rezepts, und MUST änderbar sein; hat das Rezept keine Portionen, MUST der Eintrag ohne Portionenzahl gespeichert werden. Das neue Rezept MUST als letzter Eintrag der gewählten Mahlzeit erscheinen. Nach dem Einplanen MUST der Nutzer auf der aktuellen Seite bleiben und einen Hinweis mit Tag, Mahlzeit und einem Link zur betreffenden Woche sehen. Nicht mehr verfügbare Rezepte MUST NOT eingeplant werden können.

#### Scenario: Aus der Detailansicht einplanen
- **WHEN** der Nutzer in der Detailansicht von „Linsensuppe“ (6 Portionen) „Einplanen“ tippt, Mittwoch 21.10. wählt und bestätigt
- **THEN** steht „Linsensuppe“ mit 6 Portionen beim Abendessen am 21.10., und die Detailansicht zeigt „Für Mi 21.10. · Abendessen eingeplant“ mit Link zur Woche

#### Scenario: Aus der Rezeptliste einplanen
- **WHEN** der Nutzer in der Rezeptliste bei „Hähnchen-Curry“ das Kalender-Symbol tippt und bestätigt
- **THEN** steht „Hähnchen-Curry“ heute beim Abendessen, und die Rezeptliste bleibt mit Suchbegriff und Filtern sichtbar

#### Scenario: Andere Woche
- **WHEN** der Nutzer im Dialog zur nächsten Woche blättert und dort Montag wählt
- **THEN** plant das System das Rezept für den Montag der nächsten Woche ein

#### Scenario: Gewählte Portionen übernehmen
- **WHEN** der Nutzer in der Detailansicht von „Linsensuppe“ (Rezept: 6) 8 Portionen gewählt hat und „Einplanen“ öffnet
- **THEN** ist der Dialog mit 8 Portionen vorbelegt

#### Scenario: Abendessen ausgeblendet
- **WHEN** in den Haushaltseinstellungen nur Frühstück und Mittagessen sichtbar sind und der Nutzer „Einplanen“ öffnet
- **THEN** ist Frühstück vorausgewählt

#### Scenario: Abbrechen
- **WHEN** der Nutzer den Dialog „Einplanen“ ohne Bestätigen schließt
- **THEN** bleibt der Wochenplan unverändert

#### Scenario: Speichern schlägt fehl
- **WHEN** das Einplanen nicht gespeichert werden kann
- **THEN** bleibt der Dialog offen und zeigt eine Fehlermeldung, die Auswahl bleibt erhalten

#### Scenario: Entferntes Rezept
- **WHEN** der Nutzer die Detailansicht eines nicht mehr verfügbaren Rezepts öffnet
- **THEN** bietet die Ansicht „Einplanen“ nicht an
