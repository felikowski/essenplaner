# Essenplaner – Frontend

React + TypeScript (Vite). Zeigt den Wochenplan pro Kalenderwoche und den Rezeptkatalog.

Noch ohne Backend: Rezepte und Wochenpläne kommen aus `public/mock/*.json`. Änderungen am
Plan bleiben nur bis zum Neuladen der Seite erhalten.

## Voraussetzungen

- Node.js 22 oder neuer

## Starten

```bash
cd frontend
npm install
npm run dev
```

Die App läuft dann unter http://localhost:5173 und öffnet die aktuelle Kalenderwoche.

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
  api/MockPlannerApi.ts Implementierung mit den Dummy-Daten aus public/mock
  api/context.ts        React-Context, über den Komponenten die Implementierung erhalten
  lib/isoWeek.ts        Kalenderwochen nach ISO 8601 (nur lokale Kalenderdaten)
  pages/                Wochenplan, Rezeptliste, Rezeptdetail
  components/           Layout, Tageskarte, Auswahldialog, …
public/mock/            recipes.json, weeks.json, Beispielbilder und Beispiel-PDF
```

Routen: `/` leitet auf `/woche/<aktuelle Woche>` weiter (z. B. `/woche/2026-W40`),
dazu `/rezepte` und `/rezepte/:id`.

Die Tests laufen in der Zeitzone `Europe/Berlin` (siehe `vite.config.ts`), damit Fehler bei der
Zeitumstellung auffallen. Tests, die von „heute“ abhängen, setzen eine feste Uhr.
