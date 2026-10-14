## 1. Zutaten zerlegen

- [ ] 1.1 `testdata/ingredient-cases.json` mit mindestens 40 Fällen anlegen (alle Szenarien aus `recipe-editor`, Brüche, gemischte Zahlen, Spannen mit `-`/`–`/„bis“, „ca.“, `200g`, Aufzählungszeichen, Einheiten in Ein- und Mehrzahl, „2 Dosen“ ohne Namen, unbekannte Einheit, Hinweis nach Komma, „Salz, Pfeffer“ ohne Menge); die Datei ist gültiges JSON
- [ ] 1.2 Go-Paket `internal/ingredient` mit `Parse(line) Ingredient` und Einheitentabelle; der Tabellentest über alle Fälle aus 1.1 ist grün
- [ ] 1.3 `frontend/src/lib/ingredient.ts` mit derselben Logik; der Vitest-Test über dieselbe Datei aus 1.1 ist grün

## 2. Datenmodell und Migration

- [ ] 2.1 Migrations-Runner um optionale Go-Schritte pro Version erweitern, die in derselben Transaktion nach dem SQL laufen; ein Test zeigt, dass ein Fehler im Go-Schritt auch das SQL zurückrollt
- [ ] 2.2 Migration: `recipes` neu aufbauen (CHECK mit `manual`, `servings INTEGER`, Spalte `edited_fields`, Indizes inklusive `canonical_url` erhalten), Go-Schritt zerlegt Zutaten und wandelt Portionen um; der Migrationstest mit einer Datenbank im alten Stand prüft Zutaten, „4 Portionen“ → 4, „eine Auflaufform“ → keine Angabe, bestehende Plan-Einträge und `PRAGMA foreign_key_check`
- [ ] 2.3 `store.Recipe` und `Ingredient` auf das neue Schema umstellen, `servings` als `*int`; die bestehenden Store-Tests sind angepasst und grün
- [ ] 2.4 Seed-Daten (`recipes.json`) auf Zahl-Portionen umstellen; Seed-Test grün

## 3. Store: Anlegen, Bearbeiten, geschützte Felder

- [ ] 3.1 `CreateManualRecipe` mit ID `m-` + 12 Hex-Zeichen; Test prüft ID-Format, `origin`, `source_kind = 'manual'` und zerlegte Zutaten
- [ ] 3.2 `UpdateRecipe` ersetzt Portionen, Zutaten und Schritte und ergänzt `edited_fields` nur für tatsächlich geänderte Felder; der Titel ist nur bei `manual` änderbar; Tests für alle drei Felder einzeln und für den Titel bei Drive
- [ ] 3.3 Drive-Sync und URL-Import schreiben über eine gemeinsame Upsert-Funktion, die Felder aus `edited_fields` auslässt; Tests für die Szenarien „Drive-Synchronisierung“ und „Erneuter Import“
- [ ] 3.4 Entfernen auf `manual` erweitern (Drive weiterhin 409); Test

## 4. API

- [ ] 4.1 Validierung gemäß „Eingaben prüfen“ mit 422 und `field`; Tabellentests für jede Grenze (Titel leer/201 Zeichen, Portionen 0/100/Text, 101 Zutaten, zu lange Zeile, Leerzeilen werden verworfen)
- [ ] 4.2 `POST /api/recipes` (201) und `PUT /api/recipes/{id}` (200, 404, 422 bei Titel einer fremden Quelle); httptest-Tests, beide Endpunkte hinter Login und CSRF-Schutz
- [ ] 4.3 `GET /api/recipes` liefert das neue Schema; Test für das Szenario „Strukturierte Zutat“ und für fehlende `quantity`/`unit`/`note`

## 5. Frontend

- [ ] 5.1 Typen `Recipe`, `Ingredient` und `RecipeSource` mit `manual`, `PlannerApi` um `createRecipe` und `updateRecipe` erweitern (Http und Mock); Mock-Daten umstellen; `npm test` grün
- [ ] 5.2 Komponente für die Zutatenliste mit einzelnen Feldern, Vorschau „Menge · Einheit · Name“, Enter für neue Zeile, Backspace in leerer Zeile, mehrzeiliges Einfügen; Tests für jede Interaktion
- [ ] 5.3 Seite `RecipeEditPage` für `/rezepte/neu` und `/rezepte/:id/bearbeiten` mit Titel (bei fremden Quellen als Text), Portionen, Zutaten und Zubereitung, Fehlern am Feld ohne Eingabeverlust, Nachfrage bei ungespeicherten Änderungen und Navigation zum Detail nach dem Speichern; Tests für Anlegen, Bearbeiten, Fehler und Abbrechen
- [ ] 5.4 Rezeptliste: „Neues Rezept“, Kennzeichnung „Eigenes Rezept“, Hinweis bei leerer Liste; Detailansicht: „Bearbeiten“, „Zutaten nachtragen“, „Entfernen“ bei eigenen Rezepten, Zutaten über `text`; Tests für die Szenarien aus `recipe-catalog`
- [ ] 5.5 Am Handy (Viewport 375 px, Browser-Pane) ein Rezept mit zehn Zutaten anlegen, bearbeiten und einplanen; Screenshot, und das Formular ist ohne horizontales Scrollen bedienbar

## 6. Abschluss

- [ ] 6.1 `openspec validate add-recipe-editor --strict` ist grün (die Reihenfolge in `openspec/config.yaml` ist bereits ergänzt)
- [ ] 6.2 README um das Bearbeiten von Rezepten und den Sicherungsschritt vor dem Deploy ergänzen
- [ ] 6.3 `make test` (Backend und Frontend) ist grün
