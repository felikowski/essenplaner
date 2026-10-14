## Context

Das Frontend lädt heute alle Rezepte mit `GET /api/recipes` und filtert die Suche im Browser (`lib/recipes.ts`). Nach `add-recipe-editor` enthalten Rezepte strukturierte Zutaten, und `edited_fields` schützt Felder vor Drive-Sync und Import. Nach `add-planner-flexibility` gibt es den Verlauf, nach `add-shopping-list` die gemerkten Zusammenführungen (`shopping_aliases`). Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Filtern ohne spürbare Verzögerung am Handy, bei bis zu etwa 1000 Rezepten
- Einordnen geht schnell: Sterne und „Ausprobieren“ mit einem Tippen, Tags mit Vorschlägen

**Non-Goals:**
- Serverseitige Suche mit Volltextindex (FTS5). Bei dieser Datenmenge ist das unnötig.
- Frei konfigurierbare Felder
- Mehrere Bewertungen pro Person

## Decisions

**Filtern und Suchen im Browser.** Die Liste ist ohnehin vollständig geladen, und 1000 Rezepte mit Zutaten sind deutlich unter 1 MB JSON. Filter, Suche, Sortierung und „Was habe ich da?“ sind reine Funktionen in `lib/recipeQuery.ts` über die geladene Liste. Das spart Endpunkte und Round-Trips über Mobilfunk. Die gemerkten Zusammenführungen holt das Frontend einmal über den vorhandenen Endpunkt `GET /api/shopping/aliases`. Ein serverseitiger Filter-Endpunkt wäre erst bei deutlich größeren Katalogen nötig. Die API-Felder sind schon so geschnitten, dass er sich später ergänzen lässt.

**Spalten statt Schlüssel-Wert-Paaren.** `course`, `cuisine`, `rating`, `to_try`, `notes`, `total_minutes` werden Spalten an `recipes`, jeweils mit CHECK-Constraints. Tags kommen in `recipe_tags (recipe_id, tag, tag_key)` mit PK `(recipe_id, tag_key)`, wobei `tag_key` die Kleinschreibung ist. Die Schreibweise des ersten Vorkommens gewinnt. Beim Umbenennen und Zusammenführen ändert ein einziges `UPDATE … ON CONFLICT` alle Rezepte.

**Getrennter Endpunkt für die Einordnung.** `PATCH /api/recipes/{id}/organization` statt `PUT /api/recipes/{id}` zu erweitern. Das `PUT` aus `add-recipe-editor` ersetzt das ganze Rezept. Für ein einzelnes Sternetippen wäre das unpassend, und Einordnung ist bei Drive-Rezepten ohnehin immer erlaubt. Im Formular „Bearbeiten“ wird die Einordnung als eigener Abschnitt gespeichert, mit `PUT` und `PATCH` nacheinander. Schlägt der zweite Aufruf fehl, meldet das Formular den Fehler gezielt für diesen Abschnitt.

**Schutz vor Überschreiben ohne `edited_fields`.** Die neuen Felder kommen aus keiner Quelle außer dem Import. Die Import-Funktion setzt sie nur, wenn sie `NULL` sind, und bei Tags nur, wenn das Rezept keine hat. Der Drive-Sync fasst sie nie an.

**Gang-Zuordnung beim Import.** Es gibt eine Tabelle mit deutschen und englischen Synonymen je Gang („Hauptspeise“, „Hauptgericht“, „Main Course“, „Abendessen“ → Hauptgericht; „Nachtisch“, „Dessert“ → Dessert; …). Der Vergleich ignoriert Groß- und Kleinschreibung. Ohne eindeutigen Treffer bleibt der Gang leer. `keywords` kann ein String mit Kommas oder eine Liste sein. Es werden die ersten zehn eindeutigen Einträge von 2 bis 30 Zeichen genommen.

**Filter in der URL.** Die Parameter sind `?gang=…&tag=…&tag=…&min=4&probieren=1&quelle=pdf&zeit=30&sort=bewertung&q=…`. Sie werden über `useSearchParams` gelesen und geschrieben (mit `replace`, damit nicht jeder Tastendruck einen History-Eintrag erzeugt). Der Auswahldialog im Plan nutzt dieselbe Filterkomponente, aber mit lokalem Zustand, weil er keine eigene URL hat.

**„Zuletzt geplant“** liefert die Rezept-Antwort als `lastPlannedOn`, berechnet per `LEFT JOIN (SELECT recipe_id, MAX(date) … WHERE kind = 'recipe' GROUP BY recipe_id)`. Das ist eine Abfrage für die ganze Liste, kein N+1.

**„Wie war’s?“** fragt die Detailansicht, wenn `toTry` gesetzt ist und `lastPlannedOn` in der Vergangenheit liegt. Dafür braucht es keine eigene Speicherung.

## Risks / Trade-offs

- [Filterleiste nimmt am Handy zu viel Platz] → Eingeklappt als Knopf „Filter (2)“ mit Bottom-Sheet. Aktive Filter erscheinen als entfernbare Chips über der Liste.
- [Freitext-Küche führt zu Varianten wie „italienisch“ und „Italienisch“] → Die Eingabe schlägt vorhandene Werte vor. Gespeichert wird die Schreibweise mit Großbuchstaben am Anfang.
- [Zutatensuche mit Teilwörtern liefert Falschtreffer („Ei“ in „Eisbergsalat“)] → Bei Eingaben unter vier Zeichen wird nur auf ganze Wörter geprüft. Das ist im Tabellentest abgedeckt.

## Migration Plan

Neue Spalten mit NULL bzw. 0 als Standard und eine neue Tabelle. Bestehende Daten bleiben unverändert. Rollback: vorheriges Image deployen. Die zusätzlichen Spalten stören die alte Version nicht.
