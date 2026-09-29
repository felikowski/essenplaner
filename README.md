# Essenplaner

Web-App, mit der die Familie pro Kalenderwoche plant, was es an jedem Tag zum Abendessen gibt.

> **⚠️ Nicht öffentlich betreiben.** Es gibt noch keinen Login: Wer den Server erreicht, kann den
> Plan lesen und ändern. Bis `add-auth0-login` umgesetzt ist, den Server nur lokal oder in einem
> privaten Netz laufen lassen.

- [`frontend/`](frontend/README.md) – React-Frontend (Vite)
- [`backend/`](backend/) – Go-Server mit SQLite, liefert API und gebautes Frontend aus
- [`openspec/`](openspec/) – Anforderungen und geplante Änderungen (OpenSpec)

## Voraussetzungen

- Go 1.26 oder neuer
- Node.js 22 oder neuer
- optional Docker

## Entwicklung

```bash
make dev
```

Startet das Backend auf http://localhost:8080 und den Vite-Dev-Server auf http://localhost:5173.
Im Browser die Vite-Adresse öffnen; Vite leitet `/api` an das Backend weiter. Die Datenbank liegt
in `backend/data/essenplaner.db` und wird beim ersten Start mit Beispielrezepten gefüllt.

Läuft das Backend auf einem anderen Port, gibt `BACKEND_URL` dem Vite-Proxy die Adresse:

```bash
cd backend && PORT=9000 go run ./cmd/server
```

```bash
cd frontend && BACKEND_URL=http://localhost:9000 npm run dev
```

Tests und Lint für beide Teile:

```bash
make test
```

## Bauen und Betreiben

```bash
make build
```

Erzeugt `backend/bin/essenplaner`: ein einzelnes Binary, das unter `/api/…` die API und unter allen
anderen Pfaden das Frontend ausliefert.

```bash
./backend/bin/essenplaner
```

Alternativ als Container (Datenbank auf einem Volume unter `/data`):

```bash
docker build -t essenplaner .
```

```bash
docker run --rm -p 8080:8080 -v essenplaner-data:/data essenplaner
```

### Konfiguration

| Variable        | Standard                | Bedeutung                                   |
| --------------- | ----------------------- | ------------------------------------------- |
| `PORT`          | `8080`                  | Port des HTTP-Servers                       |
| `DATABASE_PATH` | `./data/essenplaner.db` | SQLite-Datei; das Verzeichnis wird angelegt |

Im Container ist `DATABASE_PATH=/data/essenplaner.db` gesetzt. Ein Backup ist eine Kopie dieser
Datei (bei laufendem Server zusammen mit `-wal` und `-shm`, oder per `sqlite3 … ".backup …"`).

`GET /healthz` liefert 200, wenn der Server läuft und die Datenbank erreichbar ist, sonst 503.

## API

| Methode | Pfad                  | Beschreibung                                                   |
| ------- | --------------------- | -------------------------------------------------------------- |
| GET     | `/api/recipes`        | alle Rezepte, nach Titel sortiert                              |
| GET     | `/api/recipes/{id}`   | ein Rezept, 404 wenn unbekannt                                 |
| GET     | `/api/weeks/{week}`   | Plan einer Woche (`2026-W40`), alle sieben Tage, leer = `null` |
| PUT     | `/api/days/{date}`    | Body `{"recipeId": "…"}` oder `{"recipeId": null}`             |

Fehler haben immer die Form `{"error": "…"}`.
