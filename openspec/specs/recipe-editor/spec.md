# recipe-editor Specification

## Purpose
Rezepte im Essenplaner selbst erfassen und vervollständigen: eigene Familienrezepte anlegen und bei allen Rezepten Portionen, Zutaten und Zubereitung so pflegen, dass Einkaufsliste und Skalieren darauf aufbauen können.

## Requirements

### Requirement: Eigenes Rezept anlegen
Das System SHALL unter `POST /api/recipes` ein Rezept mit der Quellenart `manual` anlegen. Der Body MUST `title` enthalten und MAY `servings`, `ingredients` (Liste von Zeilen als Text) und `instructions` (Liste von Schritten) enthalten. Die Antwort MUST das angelegte Rezept mit Status 201 enthalten, mit bereits zerlegten Zutaten. Im Frontend MUST das Anlegen über „Neues Rezept“ in der Rezeptliste erreichbar sein und nach dem Speichern die Detailansicht des neuen Rezepts zeigen.

#### Scenario: Anlegen
- **WHEN** ein Nutzer ein Rezept mit dem Titel „Omas Gulasch“, 4 Portionen und den Zutaten „1 kg Rindergulasch“ und „3 Zwiebeln“ speichert
- **THEN** erscheint „Omas Gulasch“ mit der Quellenart „Eigenes Rezept“ in der Rezeptliste und lässt sich einplanen

#### Scenario: Nur Titel
- **WHEN** ein Nutzer ein Rezept nur mit Titel speichert
- **THEN** legt das System das Rezept ohne Portionen, Zutaten und Zubereitung an

### Requirement: Rezept bearbeiten
Das System SHALL unter `PUT /api/recipes/{id}` die Portionen, Zutaten und Zubereitung eines Rezepts ersetzen, unabhängig von seiner Quellenart. Den Titel MUST das System nur bei Rezepten der Quellenart `manual` ändern. Die Antwort MUST das vollständige, aktualisierte Rezept mit Status 200 enthalten. Im Frontend MUST das Bearbeiten über „Bearbeiten“ in der Detailansicht erreichbar sein. Verlässt der Nutzer das Formular mit ungespeicherten Änderungen, MUST das System nachfragen.

#### Scenario: Zutaten zu einem PDF-Rezept nachtragen
- **WHEN** ein Nutzer bei einem PDF-Rezept 4 Portionen und fünf Zutaten einträgt und speichert
- **THEN** zeigt die Detailansicht die Zutaten und weiterhin den Link „PDF öffnen“

#### Scenario: Titel eines PDF-Rezepts
- **WHEN** ein Client `PUT /api/recipes/{id}` für ein PDF-Rezept mit einem geänderten `title` sendet
- **THEN** antwortet das System mit 422, und das Rezept bleibt unverändert

#### Scenario: Unbekanntes Rezept
- **WHEN** ein Client `PUT /api/recipes/does-not-exist` aufruft
- **THEN** antwortet das System mit 404

#### Scenario: Ungespeicherte Änderungen
- **WHEN** ein Nutzer im Formular eine Zutat ändert und auf „Abbrechen“ tippt
- **THEN** fragt das System, ob die Änderungen verworfen werden sollen

### Requirement: Eingaben prüfen
Das System SHALL Rezepte nur speichern, wenn die Eingaben gültig sind: Der Titel MUST nach Entfernen von Leerzeichen 1 bis 200 Zeichen lang sein. `servings` MUST eine ganze Zahl von 1 bis 99 sein oder fehlen. Es MUST höchstens 100 Zutaten und höchstens 50 Schritte geben, jede Zutat höchstens 200 und jeder Schritt höchstens 2000 Zeichen lang. Leere Zutaten und leere Schritte MUST verworfen werden. Bei ungültigen Eingaben MUST das System mit 422 und einer Meldung antworten, die das betroffene Feld nennt. Das Frontend MUST die Meldung am Formular anzeigen, ohne Eingaben zu verlieren.

#### Scenario: Ohne Titel
- **WHEN** ein Nutzer ein neues Rezept ohne Titel speichern will
- **THEN** zeigt das Formular „Bitte einen Titel eingeben“, und es wird nichts gespeichert

#### Scenario: Ungültige Portionen
- **WHEN** ein Client `servings: 0` oder `servings: "vier"` sendet
- **THEN** antwortet das System mit 422 und einer Meldung zu den Portionen

#### Scenario: Leerzeilen
- **WHEN** ein Nutzer zwischen zwei Zutaten eine leere Zeile lässt
- **THEN** speichert das System nur die beiden Zutaten

### Requirement: Zutatenzeilen zerlegen
Das System SHALL jede Zutatenzeile in Menge, Einheit und Namen zerlegen und die eingegebene Zeile unverändert als Text behalten. Mengen MUST als ganze Zahl, Dezimalzahl mit Komma oder Punkt, Bruch (`1/2`), Unicode-Bruch (`½`), gemischte Zahl (`1 1/2`) oder Spanne (`1–2`, `1-2`) erkannt werden. Bei einer Spanne MUST die obere Grenze als Menge gelten. Einheiten MUST aus einer festen Liste gängiger Küchen­einheiten erkannt werden, unabhängig von Groß- und Kleinschreibung und von Einzahl oder Mehrzahl, und auf eine einheitliche Schreibweise gebracht werden. Eine Zeile ohne erkennbare Menge MUST als Zutat nur mit Namen gelten. Was nach Menge und Einheit folgt, ist der Name. Ein durch Komma abgetrennter Zusatz („, gehackt“) MUST als Hinweis vom Namen getrennt werden.

#### Scenario: Menge, Einheit und Name
- **WHEN** die Zeile „200 g Mehl“ lautet
- **THEN** ist die Menge 200, die Einheit „g“ und der Name „Mehl“

#### Scenario: Bruch und Einheit in Mehrzahl
- **WHEN** die Zeile „½ Teelöffel Salz“ lautet
- **THEN** ist die Menge 0,5, die Einheit „TL“ und der Name „Salz“

#### Scenario: Ohne Einheit
- **WHEN** die Zeile „3 Zwiebeln, fein gewürfelt“ lautet
- **THEN** ist die Menge 3, es gibt keine Einheit, der Name ist „Zwiebeln“ und der Hinweis „fein gewürfelt“

#### Scenario: Spanne
- **WHEN** die Zeile „1-2 Knoblauchzehen“ lautet
- **THEN** ist die Menge 2, und die Zeile wird weiterhin als „1-2 Knoblauchzehen“ angezeigt

#### Scenario: Ohne Menge
- **WHEN** die Zeile „Salz und Pfeffer“ lautet
- **THEN** gibt es weder Menge noch Einheit, und der Name ist „Salz und Pfeffer“

### Requirement: Zerlegung beim Eingeben sichtbar
Das Frontend SHALL im Formular unter jeder Zutatenzeile anzeigen, wie sie zerlegt wird (Menge, Einheit, Name), solange der Nutzer tippt. Das Ergebnis MUST mit der Zerlegung durch das Backend übereinstimmen.

#### Scenario: Vorschau
- **WHEN** ein Nutzer „2 EL Olivenöl“ eintippt
- **THEN** zeigt das Formular unter der Zeile „2 · EL · Olivenöl“

#### Scenario: Gleiches Ergebnis wie das Backend
- **WHEN** dieselben Testzeilen im Frontend und im Backend zerlegt werden
- **THEN** stimmen Menge, Einheit, Name und Hinweis überein

### Requirement: Eigenes Rezept entfernen
Das System SHALL unter `DELETE /api/recipes/{id}` auch Rezepte der Quellenart `manual` als nicht mehr verfügbar markieren. Im Frontend MUST das Entfernen nach einer Bestätigung in der Detailansicht möglich sein. PDF-Rezepte MUST sich weiterhin nicht entfernen lassen.

#### Scenario: Entfernen
- **WHEN** ein Nutzer ein eigenes Rezept entfernt, das in einem Wochenplan steht
- **THEN** verschwindet es aus Katalog und Auswahl, und der Plan zeigt es mit dem Hinweis „Nicht mehr verfügbar“

### Requirement: Nachgetragene Angaben bleiben erhalten
Das System SHALL von Hand gespeicherte Portionen, Zutaten und Zubereitung bei einem erneuten Import derselben URL nicht überschreiben. Felder, die nie von Hand bearbeitet wurden, MUST weiterhin aus der Quelle aktualisiert werden.

#### Scenario: Erneuter Import
- **WHEN** ein Nutzer die Zutaten eines importierten Rezepts korrigiert hat und dieselbe URL erneut importiert
- **THEN** bleiben die korrigierten Zutaten erhalten

### Requirement: Bestehende Daten übernehmen
Das System SHALL beim ersten Start nach dieser Änderung vorhandene Zutaten (Text) zerlegen und vorhandene Portionsangaben in eine Zahl umwandeln. Lässt sich aus einer Portionsangabe keine Zahl lesen, MUST die Angabe entfallen. Der Text der Zutaten MUST dabei unverändert bleiben.

#### Scenario: Portionen als Text
- **WHEN** ein Rezept vor der Änderung `servings: "4 Portionen"` hatte
- **THEN** hat es danach `servings: 4`

#### Scenario: Portionen ohne Zahl
- **WHEN** ein Rezept vor der Änderung `servings: "eine Auflaufform"` hatte
- **THEN** hat es danach keine Portionsangabe
