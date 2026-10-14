## Why

Die Einkaufsliste ist die Funktion, die Plan to Eat im Alltag ausmacht: Man plant die Woche, und die Liste entsteht von selbst, zusammengefasst und nach Gängen im Laden sortiert. Heute schreibt die Familie die Zutaten von Hand ab. Mit den Zutaten aus `add-recipe-editor` und den Planeinträgen aus `add-planner-flexibility` sind alle Daten dafür vorhanden.

## What Changes

- Eine gemeinsame Einkaufsliste für den Haushalt, auf allen Geräten gleich, die sich beim Einkaufen laufend aktualisiert
- „Aus dem Plan übernehmen“: Für einen Zeitraum (voreingestellt die nächsten sieben Tage) werden die Zutaten aller Rezepteinträge, auf deren Portionen umgerechnet, und alle Einzelzutaten aus dem Plan übernommen. Reste werden übersprungen, ebenso Einträge, die schon übernommen wurden.
- Gleiche Zutaten werden zusammengefasst und Mengen gleicher Einheit addiert, g/kg und ml/l werden dabei umgerechnet („Zwiebeln: 5“, „Mehl: 700 g“). Unterschiedliche Einheiten bleiben nebeneinander stehen („Butter: 250 g + 2 EL“). Bei jedem Artikel ist sichtbar, aus welchen Rezepten er stammt.
- Eigene Artikel per Texteingabe ergänzen
- Kategorien nach Gängen im Laden (Obst & Gemüse, Kühlregal, …) mit eigener Reihenfolge. Die Liste merkt sich für jede Zutat die gewählte Kategorie und kennt für gängige Zutaten einen Vorschlag.
- Geschäfte (zum Beispiel „Wochenmarkt“, „Supermarkt“): Artikel lassen sich einem Geschäft zuordnen, die Liste lässt sich danach filtern, und die Zuordnung wird gemerkt.
- Beim Einkaufen: abhaken (erledigte Artikel rutschen nach unten), „Erledigte entfernen“, Bildschirm bleibt an
- Artikel zusammenführen, die dasselbe meinen („Zwiebel“ und „Zwiebeln“); die Liste merkt sich das für künftige Übernahmen
- Vorratsliste: Dinge, die man immer im Haus haben will. „Vorrat prüfen“ geht sie durch, und fehlende Artikel kommen mit einem Tippen auf die Liste.
- Liste teilen (als Text über das Teilen-Menü des Handys) und drucken

Nicht Teil dieser Change: Anbindung an Lieferdienste, Preise, mehrere parallele Listen, Offline-Einkauf ohne Netz.

## Capabilities

### New Capabilities
- `shopping-list`: Einkaufsliste, Übernahme aus dem Plan, Zusammenfassen, Kategorien, Geschäfte, Abhaken, Vorratsliste, Teilen und Drucken

### Modified Capabilities
<!-- keine: Plan und Rezepte werden nur gelesen -->

## Impact

- Backend: neue Tabellen für Artikel, Herkunft der Artikel, Kategorien, Geschäfte, gelernte Zuordnungen (Kategorie, Geschäft, Zusammenführung) und Vorrat; neues Paket für Mengen-Arithmetik; neue Endpunkte unter `/api/shopping/…`; eingebettete Startliste von Kategorie-Vorschlägen
- Frontend: neue Seite `/einkauf` mit Navigationseintrag, Seite `/einkauf/vorrat`, Wake Lock, Abfrage alle 10 Sekunden, solange die Seite sichtbar ist
- Setzt `add-recipe-editor` (Zutaten, Parser) und `add-planner-flexibility` (Einträge mit Portionen, Einzelzutaten, Reste) voraus
