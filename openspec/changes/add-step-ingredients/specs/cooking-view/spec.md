## ADDED Requirements

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
