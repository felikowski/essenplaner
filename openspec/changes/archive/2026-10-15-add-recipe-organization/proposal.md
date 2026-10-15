## Why

Mit Web-Importen, eigenen Rezepten und später den Drive-PDFs wächst der Katalog schnell auf mehrere hundert Rezepte. Eine Suche nur im Titel reicht dann nicht mehr. Die Familie will „schnelle Hauptgerichte, die alle mögen“ finden, „was mache ich mit der Zucchini?“ beantworten und neue Rezepte zum Ausprobieren vormerken. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Rezeptbuch.

## What Changes

- Neue Angaben pro Rezept, bei allen Quellen bearbeitbar:
  - Gang aus einer festen Liste (Hauptgericht, Beilage, Suppe, Salat, Vorspeise, Dessert, Frühstück, Snack, Gebäck, Getränk, Sauce & Dip)
  - Küche (frei, mit Vorschlägen aus vorhandenen Werten)
  - Tags (beliebig viele)
  - Bewertung (1–5 Sterne)
  - „Ausprobieren“-Markierung
  - Notizen der Familie („mit weniger Chili“)
  - Zubereitungszeit in Minuten
- Beim URL-Import werden Gang, Küche, Tags und Zeit aus den Rezeptdaten vorbelegt, soweit sie vorhanden und noch nicht gesetzt sind.
- Filter in Rezeptliste und Auswahldialog: Gang, Tags, Mindestbewertung, Ausprobieren, Quelle, maximale Zeit. Die Filter stehen in der URL, damit Zurück und Teilen funktionieren.
- Sortierung nach Titel, Bewertung, zuletzt geplant und zuletzt hinzugefügt
- Die Suche findet auch Tags, Küche und Zutaten, nicht nur den Titel.
- „Was habe ich da?“: Zutaten eingeben und Rezepte finden, die sie verwenden, sortiert nach der Zahl der Treffer, mit Anzeige der fehlenden Zutaten
- Tags verwalten: umbenennen, zusammenführen, löschen (in den Einstellungen)

Nicht Teil dieser Change: frei definierbare Kategorien-Felder, automatische Tags aus Drive-Ordnern, Rezepte zwischen Haushalten teilen.

## Capabilities

### New Capabilities
- `recipe-organization`: Gang, Küche, Tags, Bewertung, Ausprobieren, Notizen, Zeit; Filtern, Sortieren, Suche nach Zutaten, Tag-Verwaltung

### Modified Capabilities
- `recipe-catalog`: Die Suche umfasst Tags, Küche und Zutaten. Die Rezeptliste bietet Filter und Sortierung.

## Impact

- Backend: neue Spalten an `recipes` (`course`, `cuisine`, `rating`, `to_try`, `notes`, `total_minutes`), Tabelle `recipe_tags`, `PATCH /api/recipes/{id}/organization`, Tag-Endpunkte, `lastPlannedOn` und `createdAt` in der Rezept-Antwort, Ergänzung des JSON-LD-Imports
- Frontend: Filterleiste und Sortierung in Liste und Auswahl, Bereich „Einordnung“ in Formular und Detailansicht, Seite „Was habe ich da?“, Tag-Verwaltung in den Einstellungen
- Setzt `add-recipe-editor`, `add-planner-flexibility` (Verlauf) und `add-shopping-list` (gemerkte Zusammenführungen für die Zutatensuche) voraus
