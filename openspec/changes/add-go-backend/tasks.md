## 1. Grundgerüst

- [x] 1.1 Go-Modul unter `backend/` mit `cmd/server` anlegen, Konfiguration aus Umgebungsvariablen (Port, DB-Pfad) mit Standardwerten; `go run ./cmd/server` startet und protokolliert den Port
- [x] 1.2 `internal/isoweek` umsetzen; Tabellentests decken dieselben Fälle wie das Frontend ab (KW 40/2026, KW 53/2026 → KW 1/2027, ungültige Eingaben)

## 2. Speicherung

- [x] 2.1 SQLite-Anbindung (WAL, busy_timeout) mit eingebetteten Migrationen; ein Test startet gegen eine temporäre Datei und prüft, dass das Schema angelegt ist
- [x] 2.2 `RecipeStore` und `PlanStore` umsetzen; Tests für Liste, Einzelabruf, Setzen, Entfernen, unbekanntes Rezept und Persistenz nach erneutem Öffnen der Datenbank
- [x] 2.3 Seed aus eingebetteter `recipes.json` (Kopie der Frontend-Mockdaten) bei leerer Tabelle; Test prüft, dass der Seed einmalig läuft und bei einem zweiten Start nichts dupliziert

## 3. API

- [x] 3.1 `writeJSON`/`writeError`, Logging- und Recover-Middleware; Test: ein Panic im Handler ergibt 500 mit `{"error":"internal error"}`
- [x] 3.2 `GET /api/recipes` und `GET /api/recipes/{id}`; httptest-Tests für 200 und 404
- [x] 3.3 `GET /api/weeks/{week}`; Tests für leere Woche, belegte Woche und 400 bei ungültiger Woche
- [x] 3.4 `PUT /api/days/{date}`; Tests für Zuordnen, Entfernen (`null`), 422 bei unbekanntem Rezept, 400 bei ungültigem Datum/Body
- [x] 3.5 `GET /healthz` mit Datenbankprüfung sowie 404-JSON für unbekannte `/api/`-Pfade; Tests

## 4. Frontend anbinden

- [x] 4.1 `HttpPlannerApi` umsetzen und als Standard setzen, `MockPlannerApi` nur noch für Tests; Vite-Proxy für `/api`; Frontend-Tests bleiben grün
- [x] 4.2 Manuell prüfen: Backend und Vite laufen, eine Zuordnung überlebt das Neuladen der Seite und einen Neustart des Backends

## 5. Auslieferung

- [x] 5.1 `internal/web` mit `embed.FS` und SPA-Fallback; Test: `/rezepte/abc` liefert index.html, `/api/x` liefert JSON-404
- [x] 5.2 `Makefile` (`dev`, `test`, `build`) und mehrstufiges `Dockerfile`; `make build` erzeugt ein Binary, das API und UI ausliefert, `docker build` läuft durch
- [x] 5.3 README aktualisieren (Start, Konfiguration, Warnhinweis: ohne Login nicht öffentlich betreiben)
