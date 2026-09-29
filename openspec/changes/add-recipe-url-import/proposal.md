## Why

Viele Rezepte, die die Familie kochen möchte, liegen nicht als PDF vor, sondern auf Rezeptseiten wie Chefkoch. Sie sollen sich genauso einplanen lassen wie Drive-Rezepte, ohne dass jemand Titel und Zutaten abtippt.

## What Changes

- Rezept per URL hinzufügen: Link einfügen, und das Backend liest Titel, Bild, Portionen, Zutaten und Zubereitung aus den strukturierten Rezeptdaten der Seite (schema.org `Recipe` als JSON-LD, das nahezu alle großen Rezeptseiten ausliefern)
- Dieselbe Seite wird nicht doppelt importiert, stattdessen erscheint das vorhandene Rezept
- Importierte Rezepte lassen sich wieder entfernen. Wie bei Drive bleiben sie in bestehenden Plänen lesbar.
- Das Backend ruft fremde Seiten nur abgesichert ab: keine internen Netzadressen, mit Zeit- und Größenbegrenzung
- Frontend: „Rezept hinzufügen“ im Katalog mit URL-Feld, Ladezustand, verständlichen Fehlermeldungen und anschließender Detailansicht

## Capabilities

### New Capabilities
- `recipe-url-import`: Rezepte von Webseiten per URL importieren, Duplikate erkennen, importierte Rezepte entfernen, sicheres Abrufen fremder Seiten

### Modified Capabilities
<!-- keine: Web-Rezepte und die Anzeige nicht verfügbarer Rezepte sind in `recipe-catalog` bereits spezifiziert -->

## Impact

- Backend: neue Endpunkte `POST /api/recipes/import` und `DELETE /api/recipes/{id}`, ausgehende HTTP-Anfragen ins Internet, Abhängigkeit `golang.org/x/net/html`
- Datenbank: Spalte `recipes.canonical_url` (eindeutig für `origin = 'web-import'`)
- Frontend: neuer Dialog im Katalog, „Entfernen“ im Detail von Web-Rezepten
- Setzt `add-google-login` (Schutz der Endpunkte) und `add-google-drive-recipes` (Feld `available`) voraus
