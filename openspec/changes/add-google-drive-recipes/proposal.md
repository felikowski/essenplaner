## Why

Die Familie sammelt ihre Rezepte als PDFs in Google Drive. Bis dahin gibt es Beispielrezepte, importierte Webseiten und eigene Rezepte. Damit auch die PDF-Sammlung im Essenplaner ankommt, müssen die Drive-PDFs automatisch als Rezepte erscheinen, ohne dass jemand sie von Hand einträgt.

## What Changes

- Ein konfigurierter Google-Drive-Ordner (inklusive Unterordnern) wird regelmäßig gelesen. Jede PDF darin wird zu einem Rezept, der Titel kommt aus dem Dateinamen.
- Nur Lesezugriff auf diesen Ordner
- Neue, umbenannte und entfernte PDFs werden bei der nächsten Synchronisierung übernommen. Entfernte Rezepte verschwinden aus Katalog und Auswahl, bleiben in bestehenden Wochenplänen aber lesbar.
- PDFs und Vorschaubilder werden über das Backend ausgeliefert. Familienmitglieder brauchen daher keinen eigenen Zugriff auf den Drive-Ordner.
- Synchronisierung auf Knopfdruck im Frontend, dazu der Zeitpunkt der letzten Synchronisierung und ihr Ergebnis
- Die Beispielrezepte aus `add-go-backend` werden nicht mehr angelegt, sobald Drive konfiguriert ist, und vorhandene Beispielrezepte werden beim ersten Sync als nicht mehr verfügbar markiert
- Von Hand nachgetragene Angaben (Zutaten, Portionen, Zubereitung, Einordnung) überschreibt die Synchronisierung nicht

## Capabilities

### New Capabilities
- `drive-recipe-source`: Rezepte aus einem Google-Drive-Ordner synchronisieren, PDFs und Vorschaubilder ausliefern, Status der Synchronisierung

### Modified Capabilities
<!-- keine: „nicht mehr verfügbar“ führt `add-recipe-url-import` ein, Drive nutzt es nur -->

## Impact

- Backend: neue Abhängigkeit `google.golang.org/api/drive/v3`, neue Spalten bzw. eine neue Tabelle für Drive-Metadaten und den Sync-Status, ein Hintergrund-Job
- API: neu sind `GET /api/recipes/{id}/pdf`, `GET /api/recipes/{id}/thumbnail`, `GET /api/sync/drive` und `POST /api/sync/drive`. Das Feld `available` gibt es bereits seit `add-recipe-url-import`.
- Konfiguration: Drive-Ordner-ID und Zugangsdaten eines Google-Dienstkontos. Einmalig muss der Ordner in Drive für das Dienstkonto freigegeben werden.
- Wird nach allen Funktions-Changes und vor `add-auth0-login` umgesetzt und läuft bis dahin nur lokal. Nutzt die geschützten Felder (`edited_fields`) aus `add-recipe-editor`. Öffentlich erreichbar dürfen die PDFs erst sein, wenn nur angemeldete Nutzer sie sehen (`add-auth0-login` schützt alle `/api/…`-Endpunkte, also auch die neuen).
