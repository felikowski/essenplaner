# Übergabe: nächste Change im Essenplaner

Stand 2026-10-15, `main` nach `add-cooking-view`. Diese Notiz richtet sich an einen Coding-Agenten (z. B. Codex),
der die nächste geplante Change umsetzt. Sie fasst zusammen, was nicht direkt aus dem Code hervorgeht.

## Projekt in Kürze

- Web-App, mit der eine Familie ihren Wochenplan und die Einkaufsliste führt. Eigenständiger Nachbau der
  Funktionen von Plan to Eat (kein Reverse Engineering; Abgleich in `docs/plantoeat-abgleich.md`).
- `backend/`: Go, `net/http` aus der Standardbibliothek, SQLite über `modernc.org/sqlite`.
- `frontend/`: React 19, TypeScript, Vite, React Router; Tests mit Vitest und Testing Library.
- Läuft vorerst nur lokal. Login (Auth0) und Deployment kommen ganz am Ende.
- Sprache: Oberfläche, Commit-Nachrichten und OpenSpec-Artefakte auf Deutsch; Code-Bezeichner englisch.
  Kommentare im Code sind deutsch.

## Was als Nächstes dran ist

Reihenfolge laut `openspec/config.yaml` (jeweils erst umsetzen und archivieren, dann die nächste):

1. `add-freezer` ← **nächste**
2. `add-nutrition` (optional; zuerst Task 1.1, Lizenz des BLS 4.0 prüfen, sonst Fallback aus design.md)
3. `add-auth0-login`
4. `add-vps-deployment`

Auth0 und Deployment brauchen Zugangsdaten und teilweise gemeinsame manuelle Schritte mit dem Nutzer.

Fertig umgesetzt: Rezeptimport per URL, Rezepteditor mit zerlegten Zutaten, flexibler Planer (Mahlzeiten,
Notizen, Einzelzutaten, Reste, Woche kopieren), Portionen umrechnen, Einkaufsliste, Rezeptorganisation,
Menüs und Kochansicht.

## Ablauf pro Change

1. Artefakte lesen: `openspec/changes/<change>/{proposal,design,tasks}.md` und `specs/*/spec.md`.
2. **Mit dem Code abgleichen.** Die Changes wurden geplant, bevor die früheren umgesetzt waren. Weichen
   Namen, Endpunkte oder Annahmen ab, zuerst die Artefakte anpassen. `openspec validate <change> --strict`
   muss grün bleiben. Überschriften und SHALL/MUST bleiben englisch, der Rest deutsch.
3. Branch `feature/<change>` von `main`.
4. Umsetzen, mit einem Test für jedes Szenario aus den Specs:
   - Backend: Go-Tests, für die API `httptest` (Helfer `newTestAPI`, `do`, `decode`, `assertError` in
     `backend/internal/httpapi/server_test.go`).
   - Frontend: Vitest + Testing Library; `renderApp(path, api)` aus `src/test/renderApp.tsx` rendert die
     ganze App mit `MockPlannerApi` und den Dummy-Daten aus `public/mock/`.
5. `make test` muss grün sein (go vet, go test, vitest, `oxlint --deny-warnings`).
6. Im Browser bei 375 px Breite prüfen (siehe unten).
7. Tasks in `tasks.md` abhaken; was nicht geprüft wurde, offen lassen oder ausdrücklich vermerken.
8. Commit auf dem Branch, `openspec archive <change> --yes`, Archiv-Commit, Fast-Forward in `main`,
   Branch löschen. Push nur nach Rückfrage beim Nutzer.

Commit-Stil (siehe `git log`): `feat(einkauf): …`, `feat(plan): …`, `feat(rezepte): …`,
`docs(openspec): <change> archivieren`.

## Architektur und Muster

### Backend

- `internal/store`: alles rund um SQLite.
  - Migrationen sind nummerierte Dateien `migrations/NNN_name.sql` (aktuell bis `005_shopping.sql`).
    Optional gibt es pro Version einen Go-Schritt in `goMigrations` (`sqlite.go`), der in derselben
    Transaktion läuft (Beispiele: `migrateRecipeEditor`, `seedShoppingCategories`).
  - Während einer Migration sind Fremdschlüssel aus; vor dem Commit läuft `PRAGMA foreign_key_check`.
  - Migrationstests: `openAtVersion` in `migrate_test.go` baut eine Datenbank bis zu einer Version auf.
  - Store-Interfaces stehen in `model.go` (`RecipeStore`, `PlanStore`, `SettingsStore`) und in
    `shopping.go` (`ShoppingStore`). `DB` implementiert alle.
  - Fachliche Fehler sind eigene Typen (`ErrInvalidEntry`, `ErrInvalidShopping`, `ErrInvalidSetting`)
    oder `ErrNotFound`; die API macht daraus 422 bzw. 404.
  - Haushalts-Einstellungen: neue Schlüssel nur in `settingsRegistry` (`settings.go`) eintragen.
  - Sortieren mit Umlauten in Go (`titleSortKey`), nicht in SQL.
- `internal/httpapi`: Router in `server.go` (Go-1.22-Muster wie `"PATCH /api/entries/{id}"`).
  Fehler immer als `{"error": "…"}` über `writeError`; Validierungsfehler mit Feld über `writeFieldError`
  (`{"error": "…", "field": "servings"}`). Status 500 nur über `internalError`.
- `internal/ingredient`: Zutatenparser; dieselbe Logik gibt es in `frontend/src/lib/ingredient.ts`, beide
  werden gegen `testdata/ingredient-cases.json` getestet. Änderungen immer an beiden Stellen.
- `internal/quantity` (Mengen summieren und formatieren) und `internal/shopping` (Schlüssel, Kategorien,
  Vorschläge) gehören zur Einkaufsliste.
- `internal/webimport`: JSON-LD-Import; Netzzugriffe nur über `internal/safefetch` (SSRF-Schutz).

### Frontend

- Komponenten kennen nur das Interface `PlannerApi` (`src/api/PlannerApi.ts`). Jede neue Methode braucht
  drei Teile: `HttpPlannerApi` (echtes Backend), `MockPlannerApi` (In-Memory, verhält sich wie das
  Backend, nur für Tests) und Tests in `HttpPlannerApi.test.ts`. Größere Mock-Logik in eine eigene Datei
  auslagern (Beispiel: `src/api/mockShopping.ts`).
- Daten laden mit `useAsyncData` (`src/lib/useAsyncData.ts`); `load` muss mit `useCallback` stabil sein.
- Dialoge über `Modal` (`src/components/Modal.tsx`), Lade- und Fehleranzeigen über `Status.tsx`.
- Styling: eine Datei `src/index.css` mit CSS-Variablen (`--color-*`, `--space-*`), BEM-artige Klassen.
  Mindestens 44 px Tippflächen. Dunkler Modus über `prefers-color-scheme`.
- oxlint meldet `setState` direkt im Effekt als Fehler; Zustand aus Antworten erst nach `await` setzen.
- Datum: nur lokale Kalenderdaten über `src/lib/isoWeek.ts`, nie UTC.

### Fallstricke

- **Kopfzeile auf dem Handy ist voll.** Mit „Woche, Rezepte, Einkauf, ⚙“ passt sie bei 375 px gerade so
  (eigene Regeln unter 30rem und 22rem in `index.css`). Ein weiterer Hauptnavigationspunkt (etwa für
  Menüs oder das Gefrierfach) würde wieder seitlich herausragen. Dann lieber einen Eintrag unter
  bestehenden Seiten verlinken oder die Navigation grundsätzlich umbauen und das in design.md festhalten.
- `add-recipe-organization` nutzt laut design.md `GET /api/shopping/aliases`. Der Endpunkt liefert
  `{fromKey, fromName, toName}`, **kein** `toKey`. Für die Zutatensuche reicht `toName` klein geschrieben
  (`shopping.Key` = Kleinschreibung mit zusammengezogenem Leerraum), sonst das Feld ergänzen.
- `MockPlannerApi` lädt `public/mock/weeks.json` (KW 40 und 41/2026 mit Einträgen). Tests, die mit Daten
  rechnen, entweder Zeiträume außerhalb dieser Wochen wählen oder die Mock-Einträge einkalkulieren.
- Für Tests mit festem Datum: `vi.useFakeTimers({ toFake: ['Date'] })` und `vi.setSystemTime(...)`.

## Lokal starten und im Browser prüfen

- Backend: `cd backend && PORT=18090 go run ./cmd/server` (Datenbank `backend/data/essenplaner.db`).
- Frontend: `BACKEND_URL=http://localhost:18090 npm run dev --prefix frontend -- --port 5173`.
  Beides steht auch in `.claude/launch.json`.
- **Port 8080 nicht benutzen und nichts darauf beenden**; dort läuft manchmal ein anderer Prototyp.
- **Vor Browser-Tests `backend/data/essenplaner.db` sichern und danach zurückspielen** (dabei
  `-wal`/`-shm` entfernen), damit keine Testdaten in der Datenbank des Nutzers bleiben. Das ist die
  echte lokale Datenbank des Nutzers.
- Geprüft wird in 375 px Breite. Am Ende `document.documentElement.scrollWidth` prüfen, es darf nicht
  größer als 375 sein.

## Wichtige Dateien

| Zweck | Datei |
|---|---|
| Reihenfolge und Projektkontext | `openspec/config.yaml` |
| Gültige Specs | `openspec/specs/*/spec.md` |
| Abgleich mit Plan to Eat | `docs/plantoeat-abgleich.md` |
| Router | `backend/internal/httpapi/server.go` |
| Datenmodell und Interfaces | `backend/internal/store/model.go`, `plan.go`, `shopping.go` |
| Frontend-Routen | `frontend/src/App.tsx` |
| API-Interface | `frontend/src/api/PlannerApi.ts` |
| Typen | `frontend/src/types.ts` |
