# Essenplaner – Frontend

React + TypeScript (Vite). Zeigt den Wochenplan pro Kalenderwoche und den Rezeptkatalog.

Die Daten kommen vom Go-Backend unter `/api`. Im Dev-Modus leitet Vite `/api` an
`http://localhost:8080` weiter (änderbar über `BACKEND_URL`). Wie beides zusammen startet,
steht in der [README im Projektordner](../README.md).

## Voraussetzungen

- Node.js 22 oder neuer

## Starten

```bash
cd frontend
npm install
npm run dev
```

Die App läuft dann unter http://localhost:5173 und öffnet die aktuelle Kalenderwoche.
Dafür muss das Backend laufen (`make dev` im Projektordner startet beides).

## Befehle

| Befehl               | Zweck                                             |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Entwicklungsserver mit Hot Reload                 |
| `npm test`           | Tests einmal ausführen (Vitest + Testing Library) |
| `npm run test:watch` | Tests im Watch-Modus                              |
| `npm run lint`       | oxlint, Warnungen gelten als Fehler               |
| `npm run build`      | Typprüfung und Produktions-Build nach `dist/`     |
| `npm run preview`    | Den Build lokal ausliefern                        |

## Aufbau

```
src/
  types.ts              Datenmodell (Recipe, WeekPlan), Grundlage für die spätere API
  api/PlannerApi.ts     Interface für den Datenzugriff
  api/HttpPlannerApi.ts Implementierung gegen die Go-API (Standard)
  api/MockPlannerApi.ts Implementierung mit den Dummy-Daten aus public/mock (nur für Tests)
  api/context.ts        React-Context, über den Komponenten die Implementierung erhalten
  lib/isoWeek.ts        Kalenderwochen nach ISO 8601 (nur lokale Kalenderdaten)
  pages/                Wochenplan, Rezeptliste, Rezeptdetail
  components/           Layout, Tageskarte, Auswahldialog, …
public/mock/            recipes.json, weeks.json, Beispielbilder und Beispiel-PDF
                        (recipes.json ist zugleich der Seed des Backends)
```

Routen: `/` leitet auf `/woche/<aktuelle Woche>` weiter (z. B. `/woche/2026-W40`),
dazu `/rezepte` und `/rezepte/:id`.

Die Tests laufen in der Zeitzone `Europe/Berlin` (siehe `vite.config.ts`), damit Fehler bei der
Zeitumstellung auffallen. Tests, die von „heute“ abhängen, setzen eine feste Uhr.
