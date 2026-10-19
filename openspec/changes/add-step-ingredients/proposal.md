## Why

In der Kochansicht stehen Zutaten und Schritte getrennt. Wer gerade „Zwiebel und Knoblauch fein hacken“ liest, muss in der Zutatenliste selbst suchen, wie viel davon gebraucht wird. Im Schritt-Modus liegt die Liste sogar hinter einem eigenen Overlay. `add-cooking-view` hat die automatische Erkennung der Zutaten eines Schritts bewusst ausgelassen. Diese Change holt sie als optionale Erweiterung nach, ohne den Kernpfad zu blockieren.

## What Changes

- Die Kochansicht erkennt, welche Zutaten ein Schritt erwähnt. Grundlage sind die Zutatennamen, mit Singular und Plural, Groß- und Kleinschreibung und zusammengesetzten Wörtern („Knoblauch“ findet „2 Knoblauchzehen“, „Reis“ findet „250 g Basmatireis“).
- Überblick: Ein Tippen auf den Text eines Schritts wählt ihn aus. Seine Zutaten werden in der Zutatenliste hervorgehoben und erscheinen zusätzlich mit umgerechneter Menge direkt unter dem Schritt. Erneutes Tippen hebt die Auswahl auf.
- Schritt-Modus: Unter dem aktuellen Schritt stehen immer seine Zutaten mit Menge. Im Overlay „Zutaten“ sind sie hervorgehoben.
- Zutaten unter einem Schritt lassen sich dort direkt abhaken. Das wirkt auf dieselbe Markierung wie in der Zutatenliste.
- Erwähnt ein Schritt keine erkennbare Zutat, steht dort „Keine Zutaten erkannt“.

Nicht Teil dieser Change: eine von Hand gepflegte Zuordnung von Zutaten zu Schritten im Rezept-Editor, das Auflösen von Sammelbegriffen („das Gemüse“, „alle Zutaten“), das Hervorheben der Zutatenwörter im Schritttext selbst und eine Erkennung per KI.

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `cooking-view`: neue Anforderungen zur Erkennung der Zutaten eines Schritts und zu ihrer Anzeige im Überblick und im Schritt-Modus; die bestehenden Anforderungen gelten unverändert

## Impact

- Frontend: neue reine Funktion in `lib/` für die Zuordnung (mit Tabellentests), Anpassungen in `pages/CookingPage.tsx` und `index.css`
- Backend, API und Datenmodell: keine Änderung
- Setzt `add-cooking-view` voraus (bereits archiviert)
