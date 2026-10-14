## Context

Zutaten haben nach `add-recipe-editor` Menge, Einheit und Namen in einer festen Einheitentabelle. Der Plan hat Einträge mit Arten und Portionen (`add-planner-flexibility`, `add-freezer`). Die Einkaufsliste merkt sich Namens-Zusammenführungen (`shopping_aliases`). Als Datenquelle bietet sich der Bundeslebensmittelschlüssel 4.0 an: rund 7140 Lebensmittel mit 138 Nährstoffen, seit dem 16.12.2025 kostenfrei vom Max Rubner-Institut. Die genaue Lizenz (Weitergabe, Quellenangabe) ist noch zu prüfen. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Kein externer Dienst zur Laufzeit, keine API-Schlüssel
- Brauchbare Werte für typische deutsche Familienrezepte nach wenigen Korrekturen
- Jede Zahl ist nachvollziehbar: welches Lebensmittel, wie viele Gramm

**Non-Goals:**
- Präzision wie in der Diätetik (Garverluste, Aufnahme von Fett beim Braten)
- Markenprodukte (Open Food Facts) und Barcode-Scan

## Decisions

**BLS 4.0 eingebettet statt Online-API.**
- Ein Skript `tools/bls/` liest die offizielle Download-Datei und schreibt eine kompakte Datei `internal/nutrition/foods.json.gz`. Sie enthält je Lebensmittel BLS-Code, Name, Dichte (falls angegeben) und die acht Nährwerte je 100 g.
- Das Go-Binary bettet die Datei per `embed` ein und lädt sie beim ersten Zugriff in den Speicher (einige MB RAM, Suche linear über ~7000 Namen in unter 1 ms).
- Alternativen:
  - USDA FoodData Central ist gemeinfrei, aber englisch, und die Zuordnung deutscher Zutatennamen wäre deutlich schlechter.
  - Open Food Facts enthält Markenprodukte statt Grundnahrungsmitteln und steht unter ODbL mit Share-Alike-Pflichten.
  - Eine Online-API (Edamam, Nutritionix) bringt Kosten, Schlüssel, Datenabfluss und Ausfallrisiko.
- Falls die BLS-Lizenz das Weitergeben im Repository oder Binary nicht erlaubt, gibt es den Fallback aus Task 1.1: Die Datei wird beim Deploy aus einem Pfad gelesen (`NUTRITION_DATA_PATH`) und nicht eingecheckt. Das Generator-Skript bleibt gleich.

**Automatische Zuordnung über Token-Bewertung.**
- Zutatenname und Lebensmittelnamen werden normalisiert: Kleinschreibung, Umlaute bleiben, Satzzeichen werden entfernt.
- Danach geht es in Tokens auf.
- Bewertung: Ein Treffer im ersten Token des Lebensmittelnamens zählt mehr. „roh“ bzw. „frisch“ gibt einen Bonus, Zubereitungen („gegart“, „frittiert“, „Konserve“) einen Abzug, sofern sie nicht im Zutatennamen stehen. Kürzere Namen werden bevorzugt.
- Unterhalb einer Schwelle gibt es keinen Treffer.
- Eine eingebaute Synonymtabelle (etwa 150 Einträge, zum Beispiel „Hähnchenbrust“ → Huhn Brustfleisch, „Schmand“, „Zucchini“) wird zuerst befragt.
- Ein Embedding- oder LLM-Abgleich wäre treffsicherer, verletzt aber das Ziel „kein externer Dienst“.

**Gelernte Werte pro Name.** `nutrition_mappings (key PK, food_code NULL, skip BOOLEAN)` mit demselben Schlüssel wie die Einkaufsliste, inklusive Alias-Auflösung über `shopping_aliases`. `nutrition_piece_weights (key, unit, grams, PK(key, unit))`. Eingebaute typische Gewichte (etwa 200 Einträge) sind eine statische Tabelle im Code. Der Nutzer überschreibt sie nur.

**Berechnung auf Abruf, ohne Speicherung.**
- `GET /api/recipes/{id}/nutrition` rechnet jedes Mal neu: Zutaten durchlaufen, Lebensmittel und Gramm bestimmen, Nährwerte summieren, durch Portionen teilen.
- Bei wenigen Zutaten ist das im Mikrosekundenbereich. Eine Speicherung müsste bei jeder Änderung an Zuordnungen, Gewichten oder Rezepten invalidiert werden.
- Die Wochenansicht ruft `GET /api/weeks/{week}/nutrition` auf, das dieselbe Funktion für alle beteiligten Rezepte nutzt.

**Pro Person = eine Portion je Eintrag.** Die Portionenzahl eines Eintrags gibt an, für wie viele gekocht wird, nicht wie viel eine Person isst. Für die Tagessumme pro Person zählt deshalb je Eintrag eine Portion des Rezepts. Das ist eine Vereinfachung, die in der Oberfläche erklärt wird.

**Frontend:**
- In der Detailansicht ein aufklappbarer Bereich mit einer Tabelle der acht Werte, der Abdeckung und der Liste „Wie berechnet?“ (Zutat → Lebensmittel, Gramm), jeweils mit „Ändern“.
- Der Dialog „Ändern“ bietet eine Lebensmittelsuche (Debounce 250 ms), Gewicht pro Einheit und „nicht berechnen“.
- Im Plan eine kleine Zeile unter dem Datum, nur bei eingeschalteter Einstellung.

## Risks / Trade-offs

- [Lizenz verbietet die Einbettung] → Fallback über eine Datei auf dem Server (siehe oben). Die Entscheidung fällt in Task 1.1, bevor Code geschrieben wird.
- [Falsche automatische Zuordnung führt zu falschen Werten] → „Wie berechnet?“ macht jede Zuordnung sichtbar. Eine Korrektur gilt für alle Rezepte. Die Werte sind deutlich als Schätzung gekennzeichnet.
- [Typische Stückgewichte schwanken stark] → Sie lassen sich pro Zutat überschreiben. Die Werte werden mit „≈“ angezeigt.
- [Binärgröße] → Nur acht Nährwerte und gzip, erwartet unter 1 MB.

## Migration Plan

Neue Tabellen, keine Datenänderung. Rollback: vorheriges Image deployen.

## Open Questions

- Welche Quellenangabe verlangt der BLS 4.0 genau? Die Antwort ändert nur den Text in der Oberfläche und in der README, nicht den Aufbau.
