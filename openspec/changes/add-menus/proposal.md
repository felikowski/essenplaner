## Why

Viele Familien kochen in wiederkehrenden Mustern: eine bewährte „Herbstwoche“, ein Wochenende mit Gästen, ein Plan für die Prüfungswochen. Heute muss man so eine Woche jedes Mal neu zusammenklicken oder eine alte Woche suchen und kopieren. Menüs speichern solche Pläne unter einem Namen und legen sie mit einem Tippen in eine beliebige Woche. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Planer.

## What Changes

- Menüs sind benannte, wiederverwendbare Pläne aus einer beliebigen Zahl von Tagen (1 bis 28) mit Einträgen pro Tag und Mahlzeit: Rezepte mit Portionen, Notizen und Einzelzutaten, wie im Wochenplan.
- „Als Menü speichern“ übernimmt eine Woche (oder einen gewählten Zeitraum) aus dem Plan in ein neues Menü.
- Menüs lassen sich direkt bearbeiten: Name, Beschreibung, Einträge hinzufügen, entfernen und verschieben, Tage anfügen und entfernen.
- „Menü einplanen“ legt alle Einträge ab einem gewählten Startdatum in den Plan, ergänzend zu vorhandenen Einträgen. Nicht mehr verfügbare Rezepte werden übersprungen und genannt.
- Neue Seite „Menüs“ mit Liste, Detailansicht und Bearbeitung

Nicht Teil dieser Change: Menüs mit anderen teilen, vorgefertigte Menüs, automatisches Wiederholen.

## Capabilities

### New Capabilities
- `menus`: Menüs anlegen, aus dem Plan speichern, bearbeiten, löschen und einplanen

### Modified Capabilities
<!-- keine: der Plan wird nur über die vorhandenen Eintragsarten beschrieben -->

## Impact

- Backend: Tabellen `menus` und `menu_entries`, Endpunkte unter `/api/menus`, Einplanen in einer Transaktion
- Frontend: Seiten `/menues`, `/menues/:id`, Aktion „Als Menü speichern“ im Wochenmenü, Navigationseintrag
- Setzt `add-planner-flexibility` voraus (Eintragsarten, Mahlzeiten, Reste-Logik beim Kopieren)
