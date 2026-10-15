# cooking-view Specification

## Purpose
Mit dem Handy in der Küche kochen: eine gut lesbare Ansicht, die wach bleibt, die gewählten Portionen übernimmt und Timer direkt aus den Schritten startet.

## Requirements

### Requirement: Kochansicht
Das System SHALL für jedes Rezept mit Zutaten oder Zubereitung eine Kochansicht anbieten, erreichbar über „Kochen“ in der Detailansicht und über den Eintrag im Wochenplan. Die Kochansicht MUST einen Überblick mit allen Zutaten und Schritten und einen Schritt-für-Schritt-Modus haben. Im Schritt-für-Schritt-Modus MUST genau ein Schritt groß angezeigt werden, mit „Schritt n von m“, Wechsel per Wischgeste und per Knöpfen. Zutaten und Schritte MUST sich antippen und als erledigt markieren lassen. Diese Markierungen MUST nur auf dem Gerät gelten und beim Verlassen der Kochansicht verworfen werden. Für Rezepte ohne Zutaten und Zubereitung MUST „Kochen“ fehlen.

#### Scenario: Schritt für Schritt
- **WHEN** der Nutzer in der Kochansicht von „Hähnchen-Curry“ den Schritt-Modus wählt und nach links wischt
- **THEN** zeigt das System „Schritt 2 von 5“ mit dem Text des zweiten Schritts

#### Scenario: Abhaken
- **WHEN** der Nutzer die Zutat „1 Zwiebel“ antippt
- **THEN** wird sie durchgestrichen, und auf anderen Geräten ändert sich nichts

#### Scenario: PDF-Rezept ohne Zutaten
- **WHEN** ein PDF-Rezept weder Zutaten noch Zubereitung hat
- **THEN** bietet die Detailansicht kein „Kochen“ an

### Requirement: Bildschirm bleibt an
Das System SHALL, solange die Kochansicht angezeigt wird, verhindern, dass der Bildschirm ausgeht, sofern der Browser das unterstützt. Kehrt der Nutzer aus einer anderen App zurück, MUST die Sperre erneut angefordert werden. Unterstützt der Browser das nicht, MUST die Ansicht einen dezenten Hinweis zeigen.

#### Scenario: Zurück aus anderer App
- **WHEN** der Nutzer während des Kochens kurz eine Nachricht beantwortet und zurückkehrt
- **THEN** bleibt der Bildschirm wieder an, ohne dass der Nutzer etwas tun muss

### Requirement: Portionen in der Kochansicht
Das System SHALL in der Kochansicht dieselbe Portionenauswahl und Umrechnung anbieten wie in der Detailansicht (siehe `servings-scaling`). Wird die Kochansicht aus der Detailansicht oder aus einem Planeintrag geöffnet, MUST die dort gewählte Portionenzahl voreingestellt sein.

#### Scenario: Aus dem Plan
- **WHEN** der Nutzer im Plan einen Eintrag „Linsensuppe · 8 Portionen“ (Rezept: 6) öffnet und „Kochen“ wählt
- **THEN** ist 8 voreingestellt, und die Mengen sind umgerechnet

### Requirement: Timer aus Schritten
Das System SHALL in Schritten Zeitangaben in Minuten und Stunden erkennen („10 Minuten“, „10 Min.“, „1 Std.“, „1 ½ Stunden“, „5–7 Minuten“) und sie als antippbares Element hervorheben. Ein Tippen MUST einen Timer mit dieser Dauer starten, bei Spannen mit der unteren Grenze. Benannt wird er nach dem Rezept und der Schrittnummer („Curry · Schritt 4“).

#### Scenario: Timer starten
- **WHEN** ein Schritt „10 Minuten köcheln lassen“ enthält und der Nutzer auf „10 Minuten“ tippt
- **THEN** läuft ein Timer „Hähnchen-Curry · Schritt 5“ über 10:00

#### Scenario: Spanne
- **WHEN** der Nutzer auf „5–7 Minuten“ tippt
- **THEN** startet ein Timer über 5:00

### Requirement: Timer
Das System SHALL beliebig viele gleichzeitig laufende Timer verwalten. Timer MUST sich auch frei mit Name und Dauer stellen, pausieren, um eine Minute verlängern und abbrechen lassen. Laufende Timer MUST auf jeder Seite der App in einer Leiste mit Name und Restzeit erscheinen, der kürzeste zuerst. Timer MUST ein Neuladen der Seite und das Schließen und Wiederöffnen der App überstehen und dabei die richtige Restzeit zeigen. Ist ein Timer abgelaufen, MUST das System, solange die App geöffnet ist, einen wiederholten Ton abspielen und vibrieren, bis der Nutzer ihn bestätigt. Hat der Nutzer Benachrichtigungen erlaubt, MUST zusätzlich eine Benachrichtigung erscheinen.

#### Scenario: Zwei Timer
- **WHEN** ein Timer über 10 Minuten und ein Timer über 25 Minuten laufen und der Nutzer zur Einkaufsliste wechselt
- **THEN** zeigt die Leiste beide Timer, den 10-Minuten-Timer zuerst

#### Scenario: Neu geladen
- **WHEN** der Nutzer bei einem laufenden Timer mit 4:30 Restzeit die Seite neu lädt
- **THEN** läuft der Timer mit etwa 4:30 weiter

#### Scenario: Abgelaufen
- **WHEN** ein Timer abläuft, während die App geöffnet ist
- **THEN** ertönt ein Signal, bis der Nutzer „Fertig“ tippt

### Requirement: Ersatz-Vorschläge
Das System SHALL für Zutaten, deren Name in einer eingebauten Liste gängiger Ersatzmöglichkeiten steht, in Detail- und Kochansicht einen Hinweis anzeigen, der beim Antippen die Alternativen mit Mengenverhältnis zeigt. Die Liste MUST mindestens 30 Zutaten umfassen.

#### Scenario: Buttermilch
- **WHEN** ein Rezept „200 ml Buttermilch“ enthält und der Nutzer auf den Hinweis tippt
- **THEN** zeigt das System zum Beispiel „200 ml Milch + 1 EL Zitronensaft, 10 Minuten stehen lassen“

### Requirement: Rezept teilen und drucken
Das System SHALL in der Detailansicht „Teilen“ anbieten, das Titel, Portionen, Zutaten (mit den gewählten Portionen), Schritte und gegebenenfalls den Quellenlink als Text über das Teilen-Menü des Geräts weitergibt, ohne Teilen-Menü über die Zwischenablage. Für Rezepte MUST es eine Druckansicht ohne Bedienelemente geben, die Zutaten und Schritte nebeneinander bzw. untereinander auf eine A4-Seite setzt.

#### Scenario: Teilen
- **WHEN** der Nutzer bei 8 Portionen „Teilen“ wählt
- **THEN** enthält der geteilte Text die Zutaten für 8 Portionen
