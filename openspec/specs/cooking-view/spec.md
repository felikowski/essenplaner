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

### Requirement: Zutaten eines Schritts erkennen
Das System SHALL für jeden Schritt eines Rezepts die Zutaten bestimmen, deren Name im Schritttext vorkommt. Groß- und Kleinschreibung, Umlaute, Singular und Plural MUST dabei keine Rolle spielen. Ein Wort im Schritt MUST auch dann passen, wenn es Anfang oder Ende eines zusammengesetzten Zutatennamens ist oder umgekehrt. Enthält eine Zutatenzeile mehrere Zutaten („Salz und Pfeffer“), MUST jede davon einzeln erkannt werden. Sammelbegriffe wie „das Gemüse“ MUST NOT zu Treffern führen.

#### Scenario: Mehrere Zutaten in einem Schritt
- **WHEN** „Hähnchen-Curry“ die Zutaten „600 g Hähnchenbrust“, „1 Zwiebel“ und „2 Knoblauchzehen“ hat und Schritt 2 „Hähnchen in Würfel schneiden, Zwiebel und Knoblauch fein hacken.“ lautet
- **THEN** sind diesem Schritt genau diese drei Zutaten zugeordnet

#### Scenario: Plural
- **WHEN** ein Rezept „3 Tomaten“ enthält und ein Schritt „Die Tomate würfeln“ lautet
- **THEN** ist „3 Tomaten“ diesem Schritt zugeordnet

#### Scenario: Zusammengesetzter Name
- **WHEN** ein Rezept „250 g Basmatireis“ enthält und Schritt 1 „Reis nach Packungsanweisung kochen.“ lautet
- **THEN** ist „250 g Basmatireis“ diesem Schritt zugeordnet

#### Scenario: Nicht erwähnt
- **WHEN** ein Schritt „Abschmecken und servieren.“ lautet
- **THEN** ist diesem Schritt keine Zutat zugeordnet, auch nicht „Salz und Pfeffer“

### Requirement: Schritt auswählen im Überblick
Das System SHALL im Überblick der Kochansicht erlauben, einen Schritt durch Tippen auf seinen Text auszuwählen. Die zugeordneten Zutaten MUST dann in der Zutatenliste hervorgehoben werden und zusätzlich mit der für die gewählten Portionen umgerechneten Menge direkt unter dem Schritt erscheinen. Es MUST höchstens ein Schritt ausgewählt sein. Erneutes Tippen auf den ausgewählten Schritt MUST die Auswahl aufheben.

#### Scenario: Schritt antippen
- **WHEN** der Nutzer im Überblick von „Hähnchen-Curry“ den Text von Schritt 2 antippt
- **THEN** sind „600 g Hähnchenbrust“, „1 Zwiebel“ und „2 Knoblauchzehen“ in der Zutatenliste hervorgehoben und stehen auch unter Schritt 2

#### Scenario: Anderen Schritt wählen
- **WHEN** Schritt 2 ausgewählt ist und der Nutzer Schritt 4 antippt
- **THEN** ist nur noch Schritt 4 ausgewählt, und nur seine Zutaten sind hervorgehoben

#### Scenario: Auswahl aufheben
- **WHEN** der Nutzer den bereits ausgewählten Schritt erneut antippt
- **THEN** ist kein Schritt mehr ausgewählt, und keine Zutat ist hervorgehoben

#### Scenario: Portionen umgestellt
- **WHEN** Schritt 2 ausgewählt ist und der Nutzer von 4 auf 8 Portionen wechselt
- **THEN** steht unter Schritt 2 „1,2 kg Hähnchenbrust“ statt „600 g Hähnchenbrust“

#### Scenario: Timer im ausgewählten Schritt
- **WHEN** der Nutzer in einem Schritt auf eine Zeitangabe wie „10 Minuten“ tippt
- **THEN** startet der Timer wie bisher, und die Auswahl der Schritte ändert sich dadurch nicht

### Requirement: Auswahl nur auf dem Gerät
Das System SHALL die Auswahl eines Schritts nur auf dem Gerät halten, auf dem sie getroffen wurde. Beim Verlassen der Kochansicht MUST sie verworfen werden.

#### Scenario: Zurück zum Rezept
- **WHEN** der Nutzer Schritt 2 auswählt, zur Detailansicht wechselt und wieder „Kochen“ wählt
- **THEN** ist kein Schritt ausgewählt, und auf anderen Geräten war zu keinem Zeitpunkt etwas hervorgehoben

### Requirement: Zutaten im Schritt-Modus
Das System SHALL im Schritt-Modus unter dem angezeigten Schritt immer dessen zugeordnete Zutaten mit der umgerechneten Menge anzeigen, ohne dass der Nutzer etwas antippen muss. Im Overlay „Zutaten“ MUST dieselben Zutaten hervorgehoben sein. Beim Wechsel zu einem anderen Schritt MUST die Anzeige sofort zu dessen Zutaten wechseln.

#### Scenario: Zutaten des aktuellen Schritts
- **WHEN** der Nutzer im Schritt-Modus von „Hähnchen-Curry“ bei „Schritt 4 von 5“ ist
- **THEN** stehen unter dem Schritt „1 EL Currypulver“ und „400 ml Kokosmilch“

#### Scenario: Overlay
- **WHEN** der Nutzer bei Schritt 4 auf „Zutaten“ tippt
- **THEN** sind in der Liste „1 EL Currypulver“ und „400 ml Kokosmilch“ hervorgehoben

### Requirement: Zutaten am Schritt abhaken
Das System SHALL die unter einem Schritt angezeigten Zutaten antippbar machen. Ein Tippen MUST die Zutat als erledigt markieren oder die Markierung aufheben, und zwar dieselbe Markierung wie in der Zutatenliste. Für diese Markierung gelten dieselben Regeln wie für das Abhaken in der Zutatenliste.

#### Scenario: Unter dem Schritt abhaken
- **WHEN** der Nutzer unter Schritt 2 auf „1 Zwiebel“ tippt
- **THEN** ist „1 Zwiebel“ sowohl unter dem Schritt als auch in der Zutatenliste durchgestrichen

### Requirement: Schritt ohne erkannte Zutaten
Das System SHALL für einen ausgewählten Schritt im Überblick und für den aktuellen Schritt im Schritt-Modus den Hinweis „Keine Zutaten erkannt“ anzeigen, wenn ihm keine Zutat zugeordnet ist. Hat das Rezept gar keine Zutaten, MUST dieser Hinweis entfallen.

#### Scenario: Kein Treffer
- **WHEN** der Nutzer einen Schritt „Abschmecken und servieren.“ auswählt
- **THEN** steht unter dem Schritt „Keine Zutaten erkannt“, und in der Zutatenliste ist nichts hervorgehoben
