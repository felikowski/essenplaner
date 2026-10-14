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
| POST    | `/api/recipes`        | eigenes Rezept anlegen (siehe unten)                           |
| PUT     | `/api/recipes/{id}`   | Portionen, Zutaten, Zubereitung (und Titel eigener Rezepte)    |
| GET     | `/api/weeks/{week}`   | Plan einer Woche (`2026-W40`), alle sieben Tage, leer = `null` |
| PUT     | `/api/days/{date}`    | Body `{"recipeId": "…"}` oder `{"recipeId": null}`             |
| POST    | `/api/recipes/import` | Body `{"url": "…"}`: Rezept von einer Webseite importieren      |
| DELETE  | `/api/recipes/{id}`   | importiertes oder eigenes Rezept entfernen (bleibt in Plänen)   |

Fehler haben immer die Form `{"error": "…"}`. Validierungsfehler (422) nennen zusätzlich das
betroffene Feld: `{"error": "…", "field": "servings"}`.

Rezepte anlegen und bearbeiten (`POST`/`PUT`) nehmen
`{"title": "…", "servings": 4, "ingredients": ["200 g Mehl", "…"], "instructions": ["…"]}`.
Zutaten kommen als Zeilen und werden vom Server zerlegt. In Antworten ist jede Zutat ein Objekt
`{"text": "200 g Mehl", "quantity": 200, "unit": "g", "name": "Mehl"}` (`quantity`, `unit` und
`note` fehlen, wenn nichts erkannt wurde), `servings` ist eine Zahl.

## Rezepte anlegen und bearbeiten

„Neues Rezept“ im Katalog legt ein eigenes Rezept an. Über „Bearbeiten“ lassen sich bei allen Rezepten
Portionen, Zutaten und Zubereitung ändern oder nachtragen, auch bei PDF- und Web-Rezepten. Den Titel
ändert man nur bei eigenen Rezepten, bei den übrigen kommt er aus der Quelle.

Zutaten werden Zeile für Zeile eingegeben („200 g Mehl“, „½ TL Salz“, „1-2 Knoblauchzehen“, „Salz und
Pfeffer“). Unter jeder Zeile zeigt das Formular, wie sie in Menge, Einheit und Name zerlegt wird. Das ist
die Grundlage für Einkaufsliste und Portionen. Die Regeln stehen in `backend/internal/ingredient` und
`frontend/src/lib/ingredient.ts`. Beide prüfen dieselben Fälle aus `testdata/ingredient-cases.json`.

Von Hand geänderte Angaben bleiben erhalten, wenn ein Rezept erneut per Link importiert wird.

**Vor einem Update mit Datenbank-Migration sichern.** Manche Versionen bauen beim Start Tabellen um
(zum Beispiel die Umstellung auf zerlegte Zutaten). Die alte Version kann die neue Datenbank danach nicht
mehr lesen, ein Rollback heißt also: Sicherung zurückspielen. Sicherung bei laufendem Server:
`sqlite3 data/essenplaner.db ".backup data/essenplaner-$(date +%F).db"`.

## Rezepte per Link importieren

„Rezept hinzufügen“ im Rezeptkatalog übernimmt Titel, Bild, Portionen, Zutaten und Zubereitung von
einer Rezeptseite. Grundlage sind die strukturierten Rezeptdaten (schema.org `Recipe` als JSON-LD), die
fast alle großen Rezeptseiten für Suchmaschinen ausliefern, etwa Chefkoch, Lecker, BBC Good Food,
Allrecipes und Kochblogs mit WordPress-Rezept-Plugins. Seiten ohne solche Daten (zum Beispiel
Übersichtsseiten) werden mit „Auf dieser Seite wurden keine Rezeptdaten gefunden.“ abgelehnt.

- Dieselbe Seite wird nicht doppelt importiert, auch nicht mit Tracking-Parametern wie `utm_source`.
- Entfernte Rezepte verschwinden aus Katalog und Auswahl, bleiben in bestehenden Plänen aber mit dem
  Hinweis „Nicht mehr verfügbar“ lesbar. Ein erneuter Import macht sie wieder verfügbar.
- Der Server ruft nur Adressen im öffentlichen Internet über Port 80/443 ab (keine internen
  Netzadressen, auch nicht nach Weiterleitungen), höchstens 10 Sekunden lang und bis 5 MB.
- Bilder werden direkt von der Rezeptseite geladen (ohne Referrer).
