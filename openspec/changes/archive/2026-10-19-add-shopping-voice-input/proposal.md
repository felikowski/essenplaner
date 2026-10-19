## Why

Was im Haushalt fehlt, fällt einem meist nebenbei auf: beim Blick in den Kühlschrank, mit vollen Händen in der Küche. Jeden Artikel einzeln in das Eingabefeld der Einkaufsliste zu tippen, ist dann lästig, und eine Diktier-Funktion der Tastatur liefert einen einzigen langen Artikel statt vieler. Mit einer Ansage wie „zwei Gurken, Feta, noch Bier und Spülmittel“ sollen alle Artikel auf einmal auf die Liste kommen.

Das Zerlegen der Zeilen, die Kategorien und das Zusammenfassen gleicher Artikel kann die Einkaufsliste bereits (`add-shopping-list`). Es fehlt nur der Schritt von gesprochener Sprache zu einzelnen Artikelzeilen. Dafür nutzt die Change einen externen Sprachdienst (OpenAI). Das ist eine bewusste Ausnahme vom bisherigen Grundsatz „kein externer Dienst“ (siehe design.md). Die Change ist optional, blockiert nichts und ist ohne API-Schlüssel einfach ausgeschaltet.

## What Changes

- Knopf „Einkauf ansagen“ auf der Seite „Einkauf“: Aufnahme bis 60 Sekunden, alternativ ein Freitextfeld für eine eingefügte oder getippte Liste
- Der Server lässt die Aufnahme transkribieren und den Text von einem Sprachmodell in einzelne Artikelzeilen im Format des Eingabefelds zerlegen („2 Gurken“, „Feta“, „Bier“, „Spülmittel“)
- Vorschau vor dem Speichern: Zeilen ändern, entfernen oder ergänzen; je Zeile die Kategorie, in die der Artikel kommt, und ein Hinweis, wenn er mit einem vorhandenen Artikel zusammengefasst wird
- „Hinzufügen“ übernimmt alle Zeilen in einem Schritt, nach denselben Regeln wie das bestehende Eingabefeld (Zerlegen, gemerkte Kategorie, Zusammenfassen)
- Ohne konfigurierten Schlüssel fehlt der Knopf; der Rest der App ist unverändert

Nicht Teil dieser Change: Kategorien durch das Sprachmodell (das bleibt bei gemerkter Wahl und eingebauten Vorschlägen), Abhaken oder Löschen per Sprache, Sprachsteuerung der Kochansicht, eine Spracherkennung im Browser ohne externen Dienst.

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `shopping-list`: neue Anforderungen für Spracheingabe, Vorschau und das gesammelte Hinzufügen mehrerer Artikel; die bestehenden Anforderungen gelten unverändert
- `deployment`: neue Anforderung für die optionale Konfiguration des Sprachdienstes; bestehende Anforderungen unverändert

## Impact

- Backend: neues Paket für den Sprachdienst (Transkription und Zerlegung über die OpenAI-API mit `net/http`, ohne neue Go-Abhängigkeit), Endpunkte `GET /api/shopping/voice`, `POST /api/shopping/voice/parse` und `POST /api/shopping/items/batch`, Store-Funktion für mehrere Artikel in einer Transaktion, optionale Umgebungsvariablen
- Frontend: Knopf und Dialog auf `ShoppingPage`, Erweiterung von `PlannerApi` samt `HttpPlannerApi` und `MockPlannerApi`
- Betrieb: `OPENAI_API_KEY` in `/etc/essenplaner/production.env`; ein Budget-Limit im OpenAI-Konto
- Setzt `add-shopping-list` und `add-auth0-login` voraus (beide archiviert)
