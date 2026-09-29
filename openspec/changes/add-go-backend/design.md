## Context

Das Frontend aus `add-frontend-mock-data` spricht über das `PlannerApi`-Interface mit dem Datenmodell aus dessen design.md. Der Prototyp `family-dinner-planner/backend` zeigt einen sauberen Go-Aufbau, hält aber alles im Speicher, und sein `Store`-Interface kann keine Fehler melden.

## Goals / Non-Goals

**Goals:**
- Dasselbe JSON-Schema wie im Frontend, damit dort nur die Implementierung getauscht wird
- Wenige Abhängigkeiten, einfach zu betreiben (ein Binary, eine Datei als Datenbank)
- Die Rezeptquellen (Seed, später Drive und Web-Import) sind austauschbar, ohne dass sich API oder Plan-Logik ändern

**Non-Goals:**
- Login und Zugriffsschutz (kommt mit `add-google-login`; bis dahin nur lokal betreiben)
- Rezepte über die API anlegen oder bearbeiten
- Hosting und CI/CD für eine konkrete Plattform

## Decisions

**SQLite über `modernc.org/sqlite`** (reines Go, kein cgo). Ein Familienprojekt braucht keinen Datenbankserver, und das Backup ist eine einzige Datei. Ohne cgo bleibt das Cross-Compilieren und ein schlankes Container-Image einfach. Wir nutzen `database/sql` direkt, ohne ORM. Die Alternative `mattn/go-sqlite3` verwerfen wir wegen cgo, Postgres ist für diese Größe unnötig.

**Schema** (Migrationen als eingebettete SQL-Dateien, eine `schema_migrations`-Tabelle):
```sql
recipes(id TEXT PK, title TEXT NOT NULL, source_kind TEXT NOT NULL,  -- 'pdf' | 'web'
        source_ref TEXT NOT NULL,   -- pdfUrl bzw. url
        image_url TEXT, servings TEXT,
        ingredients_json TEXT, instructions_json TEXT,
        origin TEXT NOT NULL,       -- 'seed' | später 'drive' | 'web-import'
        created_at, updated_at)
plan_days(date TEXT PK /* YYYY-MM-DD */, recipe_id TEXT NOT NULL REFERENCES recipes(id))
```
Ein leerer Tag bedeutet, dass es keine Zeile gibt. Die Woche wird immer aus dem Datum berechnet und nicht gespeichert. `origin` bereitet die Synchronisierung mit Drive vor, weil sie nur eigene Einträge anfassen darf.

**Paketaufbau**, angelehnt an den Prototyp:
- `internal/isoweek`: Woche parsen/formatieren, Tage einer Woche (wird mit denselben Fällen getestet wie im Frontend)
- `internal/store`: SQLite-Zugriff; Interfaces `RecipeStore`, `PlanStore` mit `context.Context` und `error`
- `internal/seed`: übernimmt beim Start mit leerer Tabelle die Seed-Rezepte (eingebettete JSON-Datei, Kopie der Frontend-Mockdaten)
- `internal/httpapi`: Handler, `writeJSON`/`writeError`, Middleware (Logging, Recover)
- `internal/web`: `embed.FS` mit `frontend/dist`, SPA-Fallback

**API-Pfade:** `PUT /api/days/{date}` statt `/weeks/{week}/days/{date}`. Das Datum ist eindeutig, und eine verschachtelte Adresse würde nur eine Inkonsistenz ermöglichen (Datum passt nicht zur Woche).

**Frontend einbetten:** Das Build-Skript (`make build`) baut zuerst `frontend/dist` und kopiert es nach `backend/internal/web/dist`, danach wird `go build` ausgeführt. In der Entwicklung laufen Vite und Go getrennt, Vite leitet `/api` per Proxy weiter. Dadurch ist CORS weder im Dev-Modus noch in Produktion nötig; die CORS-Middleware aus dem Prototyp entfällt.

**Container:** Ein mehrstufiges `Dockerfile` (Node-Build → Go-Build → distroless), Datenbank auf einem Volume unter `/data`. So ist das Hosting später überall möglich, wo Container laufen.

## Risks / Trade-offs

- [SQLite bei gleichzeitigen Schreibzugriffen] → WAL-Modus und `busy_timeout`; bei ein paar Familienmitgliedern ist das unkritisch.
- [Ohne Login darf das Backend nicht öffentlich erreichbar sein] → Die README weist ausdrücklich darauf hin. Öffentlicher Betrieb erst nach `add-google-login`.
- [Seed-Rezepte vermischen sich mit echten Rezepten] → Sie sind über `origin = 'seed'` markiert, sodass ein späterer Change sie gezielt entfernen kann.

## Migration Plan

Es gibt keine Bestandsdaten. Plan-Änderungen, die mit dem Mock-Frontend gemacht wurden, lagen nur im Speicher und werden nicht übernommen.
