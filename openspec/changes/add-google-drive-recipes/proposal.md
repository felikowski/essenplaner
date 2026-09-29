## Why

Die Familie sammelt ihre Rezepte als PDFs in Google Drive. Bisher gibt es nur Beispielrezepte. Damit der Essenplaner wirklich nutzbar wird, müssen die Drive-PDFs automatisch als Rezepte erscheinen, ohne dass jemand sie von Hand einträgt.

## What Changes

- Ein konfigurierter Google-Drive-Ordner (inklusive Unterordnern) wird regelmäßig gelesen. Jede PDF darin wird zu einem Rezept, der Titel kommt aus dem Dateinamen.
- Nur Lesezugriff auf diesen Ordner
- Neue, umbenannte und entfernte PDFs werden bei der nächsten Synchronisierung übernommen. Entfernte Rezepte verschwinden aus Katalog und Auswahl, bleiben in bestehenden Wochenplänen aber lesbar.
- PDFs und Vorschaubilder werden über das Backend ausgeliefert. Familienmitglieder brauchen daher keinen eigenen Zugriff auf den Drive-Ordner.
- Synchronisierung auf Knopfdruck im Frontend, dazu der Zeitpunkt der letzten Synchronisierung und ihr Ergebnis
- Die Beispielrezepte aus `add-go-backend` werden nicht mehr angelegt, sobald Drive konfiguriert ist

## Capabilities

### New Capabilities
- `drive-recipe-source`: Rezepte aus einem Google-Drive-Ordner synchronisieren, PDFs und Vorschaubilder ausliefern, Status der Synchronisierung

### Modified Capabilities
- `recipe-catalog`: Rezepte können „nicht mehr verfügbar“ sein. Sie tauchen dann nicht mehr in Liste und Auswahl auf, bleiben im Plan aber sichtbar (neue Requirement)

## Impact

- Backend: neue Abhängigkeit `google.golang.org/api/drive/v3`, neue Spalten bzw. eine neue Tabelle für Drive-Metadaten und den Sync-Status, ein Hintergrund-Job
- API: neu sind `GET /api/recipes/{id}/pdf`, `GET /api/recipes/{id}/thumbnail`, `GET /api/sync/drive` und `POST /api/sync/drive`. Rezepte erhalten das Feld `available`.
- Konfiguration: Drive-Ordner-ID und Zugangsdaten eines Google-Dienstkontos. Einmalig muss der Ordner in Drive für das Dienstkonto freigegeben werden.
- Setzt `add-google-login` voraus: Die PDFs dürfen nur angemeldete Nutzer sehen.
