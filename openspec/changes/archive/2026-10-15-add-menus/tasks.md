## 1. Backend

- [x] 1.1 Gemeinsamen Eintragskern (`entryDraft`, Validierung, `insertDrafts` mit Reste-Abbildung) aus „Woche kopieren“ herauslösen; die bestehenden Tests für „Woche kopieren“ bleiben grün
- [x] 1.2 Migration: Tabellen `menus` und `menu_entries`; ein Test vergleicht die Eintragsspalten mit `plan_entries`
- [x] 1.3 Store: Menüs auflisten (mit Zahl der Tage und Rezepte), lesen, anlegen (leer und aus Zeitraum, Reste-Regel, leere Tage am Ende entfallen), umbenennen (eindeutiger Name), löschen; Tests
- [x] 1.4 Store: Menü-Einträge anlegen, ändern, verschieben und löschen; Tage anfügen und entfernen mit Aufrücken; Grenzen 1 und 28; Tests
- [x] 1.5 Store: Menü einplanen (Datum je Tag, ans Ende, Reste, übersprungene Titel, eine Transaktion); Tests für alle Szenarien aus „Menü einplanen“
- [x] 1.6 Endpunkte unter `/api/menus` inklusive `apply`; httptest-Tests

## 2. Frontend

- [x] 2.1 Typen und `PlannerApi`-Methoden für Menüs (Http und Mock); Tests
- [x] 2.2 Dialoge für Hinzufügen und Verschieben auf das Ziel-Interface (Plan oder Menü) umstellen; die bestehenden Tests sind grün, und neue Tests decken das Menü-Ziel ab
- [x] 2.3 Seite `/menues` mit Liste, leerer Ansicht, „Neues Menü“ und kontextuellem Link im Wochenplan; Tests
- [x] 2.4 Seite `/menues/:id` mit Tagen, Einträgen, Bearbeiten von Name und Beschreibung, Tag anfügen und entfernen, Löschen; Tests
- [x] 2.5 „Als Menü speichern“ im Wochenmenü mit Name und Zeitraum; Tests
- [x] 2.6 Dialog „Einplanen“ mit Startdatum, Vorschau, Sprung zur Woche und Hinweisen (übersprungen, ausgeblendete Mahlzeiten); Tests
- [x] 2.7 Im Browser-Pane (375 px): eine Woche als Menü speichern, im Menü einen Tag entfernen, das Menü in eine andere Woche einplanen; Screenshot

## 3. Abschluss

- [x] 3.1 `make test` grün; README ergänzen
