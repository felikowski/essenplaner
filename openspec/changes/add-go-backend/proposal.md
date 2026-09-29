## Why

Solange das Frontend nur Dummy-Daten hat, geht jede Planung beim Neuladen verloren, und jedes Familienmitglied sieht einen anderen Stand. Ein Backend speichert Rezepte und Wochenpläne zentral und ist die Grundlage für Login, Google Drive und den Rezept-Import.

## What Changes

- Neues Go-Backend unter `backend/` (net/http, SQLite)
- JSON-API für Rezepte und Wochenpläne, deren Schema den Frontend-Typen aus `add-frontend-mock-data` entspricht
- Wochenpläne werden dauerhaft gespeichert und sind für alle Nutzer gleich
- Das Backend liefert auch das gebaute Frontend aus, sodass ein einziges Binary deployt wird
- Die Dummy-Rezepte aus `frontend/public/mock/recipes.json` werden als Startdaten in die Datenbank übernommen, bis echte Quellen angebunden sind
- Frontend: `MockPlannerApi` wird durch `HttpPlannerApi` ersetzt; im Dev-Modus leitet ein Vite-Proxy `/api` an das Backend weiter
- Übernommen aus dem Prototyp: Aufbau `cmd/server` + `internal/…`, `Store`-Interface-Idee, Routing mit Pfadmustern von `http.ServeMux`, `writeJSON`

## Capabilities

### New Capabilities
- `planner-api`: HTTP-Schnittstelle für Rezepte und Wochenpläne inklusive Fehlerverhalten
- `deployment`: Auslieferung als ein Binary mit eingebettetem Frontend, Konfiguration über Umgebungsvariablen, Health-Check

### Modified Capabilities
- `meal-plan`: Zuordnungen werden dauerhaft gespeichert und sind für alle Nutzer sichtbar (neue Requirement, keine bestehende ändert sich)

## Impact

- Neuer Ordner `backend/`, Go-Abhängigkeit auf einen SQLite-Treiber
- Frontend: Datenzugriffsschicht wird ausgetauscht, Vite-Proxy kommt dazu, die Mock-Dateien werden nur noch in Tests verwendet
- Neue Build-Pipeline: Das Frontend wird gebaut, danach das Go-Binary mit eingebetteten Dateien
