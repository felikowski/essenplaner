## Why

Viele Rezepte, die die Familie kochen möchte, liegen nicht als PDF vor, sondern auf Rezeptseiten wie Chefkoch. Sie sollen sich genauso einplanen lassen wie die übrigen Rezepte, ohne dass jemand Titel und Zutaten abtippt.

## What Changes

- Rezept per URL hinzufügen: Link einfügen, und das Backend liest Titel, Bild, Portionen, Zutaten und Zubereitung aus den strukturierten Rezeptdaten der Seite (schema.org `Recipe` als JSON-LD, das nahezu alle großen Rezeptseiten ausliefern)
- Dieselbe Seite wird nicht doppelt importiert, stattdessen erscheint das vorhandene Rezept
- Importierte Rezepte lassen sich wieder entfernen. Sie gelten dann als „nicht mehr verfügbar“: Sie verschwinden aus Katalog und Auswahl, bleiben in bestehenden Plänen aber lesbar. Dieses Konzept führt diese Change ein; spätere Changes (eigene Rezepte, Drive) nutzen es mit.
- Das Backend ruft fremde Seiten nur abgesichert ab: keine internen Netzadressen, mit Zeit- und Größenbegrenzung
- Frontend: „Rezept hinzufügen“ im Katalog mit URL-Feld, Ladezustand, verständlichen Fehlermeldungen und anschließender Detailansicht

## Capabilities

### New Capabilities
- `recipe-url-import`: Rezepte von Webseiten per URL importieren, Duplikate erkennen, importierte Rezepte entfernen, sicheres Abrufen fremder Seiten

### Modified Capabilities
- `recipe-catalog`: Rezepte können „nicht mehr verfügbar“ sein (neue Requirement)

## Impact

- Backend: neue Endpunkte `POST /api/recipes/import` und `DELETE /api/recipes/{id}`, ausgehende HTTP-Anfragen ins Internet, Abhängigkeit `golang.org/x/net/html`
- Datenbank: Spalten `recipes.available` (Standard 1) und `recipes.canonical_url` (eindeutig für `origin = 'web-import'`)
- API: Rezepte erhalten das Feld `available`; die Liste enthält nur verfügbare Rezepte
- Frontend: neuer Dialog im Katalog, „Entfernen“ im Detail von Web-Rezepten, Hinweis „Nicht mehr verfügbar“ im Plan und im Detail
- Erste Change nach `add-go-backend`. Der Schutz der Endpunkte kommt später mit `add-auth0-login`, bis dahin läuft die App nur lokal.
