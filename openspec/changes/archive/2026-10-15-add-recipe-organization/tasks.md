## 1. Backend

- [x] 1.1 Migration: Spalten `course`, `cuisine`, `rating`, `to_try`, `notes`, `total_minutes` mit CHECKs und Tabelle `recipe_tags`; Migrationstest
- [x] 1.2 Store: Einordnung lesen (inklusive Tags, `createdAt`, `lastPlannedOn` ohne N+1) und teilweise ändern; Tests für jedes Feld, Tag-Duplikate und Grenzen
- [x] 1.3 Store: Tags auflisten mit Anzahl, umbenennen (inklusive Zusammenführen) und löschen; Tests
- [x] 1.4 `PATCH /api/recipes/{id}/organization` und `/api/tags`-Endpunkte mit 422 und `field`; httptest-Tests für beide Szenarien aus „Organisations-API“
- [x] 1.5 JSON-LD-Import um `recipeCategory` (Synonymtabelle), `recipeCuisine`, `keywords` und `totalTime` (ISO-8601-Dauer) erweitern, nur leere Felder füllen; Tests mit den vorhandenen Fixtures und Einzelfällen („Ostern“, `PT1H15M`, Keywords als String und Liste)

## 2. Frontend: Logik

- [x] 2.1 Typen und `PlannerApi` um Einordnung und Tags erweitern (Http und Mock); Tests
- [x] 2.2 `lib/recipeQuery.ts`: Filter, Suche mit Gewichtung (Titel vor Tags, Küche und Zutaten), Sortierungen und Zutatensuche mit Aliassen und der Ganzwort-Regel unter vier Zeichen; Tabellentests für jedes Szenario aus den Specs
- [x] 2.3 Filterzustand aus und in URL-Parameter; Test für Neuladen mit Filtern

## 3. Frontend: Oberfläche

- [x] 3.1 Filterleiste mit Bottom-Sheet, Chips und „Filter zurücksetzen“ in der Rezeptliste; Sortierauswahl; Tests
- [x] 3.2 Dieselben Filter im Auswahldialog des Wochenplans (lokaler Zustand); Test
- [x] 3.3 Listeneintrag mit Sternen, Zeit und bis zu drei Tags; Test
- [x] 3.4 Detailansicht: Einordnung anzeigen, Sterne direkt antippen, „Ausprobieren“ umschalten, Notizen, „Wie war’s?“; Tests
- [x] 3.5 Formular: Abschnitt „Einordnung“ mit Gang, Küche (Vorschläge), Tag-Eingabe (Vorschläge), Zeit und Notizen; Fehlerbehandlung beim zweiten Aufruf; Tests
- [x] 3.6 Seite „Was habe ich da?“ (`/rezepte/zutaten`), erreichbar aus der Rezeptliste; Tests
- [x] 3.7 Ansicht „Ausprobieren“ als Schnellfilter in der Liste; Test
- [x] 3.8 Tag-Verwaltung in `/einstellungen`; Tests
- [x] 3.9 Im Browser-Pane (375 px): zehn Rezepte einordnen, filtern, sortieren und nach Zutaten suchen; Screenshot unter `docs/add-recipe-organization-mobile.jpg`; Datenbank anschließend wiederhergestellt

## 4. Abschluss

- [x] 4.1 `make test` grün; README ergänzen
