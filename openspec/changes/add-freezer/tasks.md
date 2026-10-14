## 1. Datenmodell

- [ ] 1.1 Migration: Tabelle `freezer_items`; `plan_entries` neu aufbauen mit Art `freezer` und Spalte `freezer_item_id`; der Migrationstest enthält Reste-Verweise und übernommene Einkaufseinträge und prüft `PRAGMA foreign_key_check`
- [ ] 1.2 Store: Bestand berechnen (verfügbar, reserviert, verbraucht) mit „heute“ in der Haushalts-Zeitzone; Tabellentests über den Tageswechsel
- [ ] 1.3 Store: Gerichte anlegen (Validierung, Datum nicht in der Zukunft), ändern, entnehmen (nicht mehr als verfügbar), löschen (409 bei Reservierungen in der Zukunft); Tests
- [ ] 1.4 Store: Gefrierfach-Einträge anlegen und ändern mit Prüfung des Bestands in der Transaktion; Löschen vergangener Einträge erhöht `taken`; Tests für alle Szenarien aus „Aus dem Gefrierfach einplanen“
- [ ] 1.5 „Als Menü speichern“ wandelt Gefrierfach-Einträge um; der Spaltenvergleichstest aus `add-menus` nennt die Ausnahme; Tests
- [ ] 1.6 Einkaufsliste und Verlauf: Tests, die belegen, dass Gefrierfach-Einträge ignoriert werden
- [ ] 1.7 Einstellung `freezerWarnMonths` in der Registry; Test

## 2. API

- [ ] 2.1 Endpunkte unter `/api/freezer` und `kind: freezer` in `/api/entries` sowie im Wochenplan; httptest-Tests für alle Szenarien aus „Gefrierfach-API“

## 3. Frontend

- [ ] 3.1 Typen und `PlannerApi`-Methoden (Http und Mock); Tests
- [ ] 3.2 Seite `/gefrierfach` mit Liste, Alter, Hervorhebung, leerer Ansicht, Hinzufügen, Entnehmen, Entfernen und Einplanen; Navigationseintrag; Tests
- [ ] 3.3 Aktion „Einfrieren“ am Rezepteintrag mit vorbelegtem Dialog; Test
- [ ] 3.4 Tab „Gefrierfach“ im Dialog „Hinzufügen“ und Hinweis „… im Gefrierfach – stattdessen auftauen?“ beim Einplanen eines Rezepts; Tests
- [ ] 3.5 Darstellung von Gefrierfach-Einträgen im Plan (❄, Portionen, Link zum Rezept); Test
- [ ] 3.6 Einstellung Lagerdauer in `/einstellungen`; Test
- [ ] 3.7 Im Browser-Pane (375 px): Gericht aus dem Plan einfrieren, für einen anderen Tag einplanen, Einkaufsliste übernehmen (kein Eintrag dafür), Eintrag entfernen und Bestand prüfen; Screenshot

## 4. Abschluss

- [ ] 4.1 `make test` grün; README ergänzen, inklusive Sicherung vor dem Deploy
