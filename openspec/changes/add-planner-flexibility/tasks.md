## 1. Datenmodell

- [x] 1.1 Migration: Tabelle `plan_entries` mit CHECKs je Art und Index, Übernahme aus `plan_days` als Abendessen mit Portionen des Rezepts, `plan_days` löschen; der Migrationstest prüft die übernommenen Einträge und `PRAGMA foreign_key_check`
- [x] 1.2 Migration: Tabelle `household_settings`; Test, dass sie leer startet
- [x] 1.3 Store: Wochen lesen (sortiert nach Mahlzeit und Position), Eintrag anlegen (Position ans Ende, Portionen aus dem Rezept), ändern, verschieben und löschen (abhängige Reste werden zu Notizen); Tests für jedes Szenario aus `meal-plan`
- [x] 1.4 Store: Woche kopieren (append/replace, Reste-Abbildung, nicht verfügbare Rezepte überspringen, eine Transaktion); Tests für leere und belegte Zielwoche, Reste und übersprungene Einträge
- [x] 1.5 Store: Verlauf eines Rezepts ohne Reste; Test
- [x] 1.6 Einstellungs-Registry mit `visibleMeals` (Standard `["dinner"]`, nicht leer, nur bekannte Werte); Tests für Standardwert, gültige und ungültige Werte

## 2. API

- [x] 2.1 `GET /api/weeks/{week}` im neuen Schema; die bestehenden Tests sind angepasst und grün
- [x] 2.2 `POST`, `PATCH` und `DELETE /api/entries…` mit Validierung (400/404/422) und `{"weeks": […]}` als Antwort; httptest-Tests für alle Szenarien aus `planner-api`
- [x] 2.3 `POST /api/weeks/{week}/copy`; Tests für append, replace, gleiche Woche (422) und `skipped`
- [x] 2.4 `GET /api/recipes/{id}/history` und `GET`/`PATCH /api/settings`; Tests
- [x] 2.5 `PUT /api/days/{date}` entfernen; ein Test stellt sicher, dass die Route 404 oder 405 liefert

## 3. Frontend: Daten

- [x] 3.1 Typen `PlanEntry`, `Meal`, `WeekPlan` (Tage mit Eintragslisten), `HouseholdSettings`; `PlannerApi` um Einträge, Kopieren, Verlauf und Einstellungen erweitern (Http und Mock); Tests der Mock-Implementierung
- [x] 3.2 Settings-Context, der die Einstellungen beim Start lädt; Test

## 4. Frontend: Oberfläche

- [x] 4.1 `DayCard` mit Mahlzeiten-Abschnitten, Einträgen aller Arten, „+“ je Mahlzeit und Eintragsmenü; Überschrift entfällt bei nur einer Mahlzeit; Tests
- [x] 4.2 Dialog „Hinzufügen“ mit den Tabs Rezept, Notiz und Zutat; Tests für alle drei und für Abbrechen
- [x] 4.3 Portionen ändern im Eintragsmenü; Anzeige bei Abweichung vom Rezept; Test
- [x] 4.4 Ziel-Dialog für Verschieben und Reste einplanen; Tests für beide, auch mit Ziel in einer anderen Woche
- [x] 4.5 „Woche kopieren“ mit Rückfrage Ergänzen/Ersetzen und Hinweis auf übersprungene Einträge; Test
- [x] 4.6 Verlauf in der Rezeptdetailansicht („Zuletzt geplant …“, aufklappbare Liste mit Links); Tests
- [x] 4.7 Seite `/einstellungen` mit den Mahlzeiten als Checkboxen und Navigationseintrag; Test, auch für „letzte Mahlzeit abwählen“
- [x] 4.8 Druck-Stylesheet (umgesetzt und per Test für den Druckknopf geprüft; Druckvorschau im Browser noch nicht angesehen) und Knopf „Drucken“; im Browser-Pane per Druckvorschau (`emulateMedia print`) prüfen und Screenshot
- [ ] 4.9 Am Handy (375 px) mit Mittag- und Abendessen eine Woche planen, Reste einplanen, Eintrag verschieben und Woche kopieren; Screenshot

## 5. Abschluss

- [x] 5.1 `make test` ist grün
- [x] 5.2 Beim Archivieren das Szenario „Neu zuordnen“ in `openspec/specs/recipe-catalog/spec.md` auf `POST /api/entries` umstellen
- [x] 5.3 README: Mahlzeiten, Einstellungen und geänderte API beschreiben
