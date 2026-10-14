## Why

Rezepte kennt der Essenplaner bisher nur als Titel mit Zutaten als freiem Text. Drive-PDFs haben gar keine Zutaten. Familienrezepte, die weder als PDF noch auf einer Webseite existieren, lassen sich überhaupt nicht erfassen. Für die geplante Einkaufsliste und das Skalieren von Portionen (siehe `docs/plantoeat-abgleich.md`) braucht jede Zutat Menge, Einheit und Namen, und die Portionen müssen eine Zahl sein.

## What Changes

- Eigene Rezepte anlegen: Titel, Portionen, Zutaten und Zubereitung, ohne PDF oder Webseite. Sie bekommen die neue Quellenart „Eigenes Rezept“.
- Rezepte bearbeiten: Portionen, Zutaten und Zubereitung lassen sich bei allen Rezepten ändern oder nachtragen, auch bei Drive-PDFs und Web-Importen. Der Titel lässt sich nur bei eigenen Rezepten ändern, weil er bei Drive aus dem Dateinamen kommt.
- Strukturierte Zutaten: Jede Zutat wird als Zeile eingegeben („200 g Mehl“) und in Menge, Einheit und Namen zerlegt. Erkannt werden deutsche Schreibweisen wie `1,5`, `½`, `1/2` und Spannen wie `1–2` sowie gängige Einheiten. Zeilen ohne Menge („Salz und Pfeffer“) bleiben gültig.
- Die Zerlegung ist schon beim Tippen sichtbar, damit Fehler auffallen, bevor gespeichert wird.
- Eigene Rezepte lassen sich entfernen. Sie bleiben dann in bestehenden Plänen lesbar.
- Nachgetragene Angaben gehen bei der Drive-Synchronisierung und beim erneuten URL-Import nicht verloren.
- Bestehende Zutaten (Text) und Portionen („4 Portionen“) werden einmalig in die neue Form überführt.
- **BREAKING** (API): `ingredients` ist eine Liste von Objekten statt Strings, `servings` eine Zahl statt Text, `source.kind` kennt zusätzlich `manual`.

Nicht Teil dieser Change: Fotos hochladen, Kategorien und Tags, Suche nach Zutaten, Portionen in der Ansicht umrechnen (kommt mit `add-cooking-view`), Einkaufsliste (`add-shopping-list`).

## Capabilities

### New Capabilities
- `recipe-editor`: Eigene Rezepte anlegen, Rezepte bearbeiten und entfernen, Zerlegen von Zutatenzeilen, Schutz nachgetragener Angaben vor Synchronisierung und Import

### Modified Capabilities
- `recipe-catalog`: Quellenart „Eigenes Rezept“ in Liste und Detail; Detailansicht zeigt strukturierte Zutaten und bietet „Bearbeiten“ bzw. bei Rezepten ohne Zutaten „Zutaten nachtragen“ an
- `planner-api`: neues Datenschema für `ingredients`, `servings` und `source.kind`

## Impact

- Backend: neue Endpunkte `POST /api/recipes` und `PUT /api/recipes/{id}`, `DELETE /api/recipes/{id}` auch für eigene Rezepte; neues Paket für das Zerlegen von Zutaten; Migration mit Umbau der Tabelle `recipes` (CHECK auf `source_kind`, Spalte `servings` als Zahl, Spalte `edited_fields`) und Umwandlung der vorhandenen Daten
- Drive-Sync und URL-Import: überschreiben nur noch Felder, die nicht von Hand bearbeitet wurden
- Frontend: Typen `Recipe` und `Ingredient`, neue Seiten `/rezepte/neu` und `/rezepte/:id/bearbeiten`, Anpassung von Detailansicht, Liste und Mock-Daten
- Setzt `add-auth0-login`, `add-google-drive-recipes` und `add-recipe-url-import` voraus und wird in `openspec/config.yaml` hinten an die Reihenfolge angehängt
